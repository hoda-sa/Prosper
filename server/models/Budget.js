const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
    // User reference
    userId: {
        type: String,
        required: true,
        index: true
    },

    // Basic budget information
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'Budget name cannot exceed 100 characters']
    },

    description: {
        type: String,
        trim: true,
        maxlength: [300, 'Description cannot exceed 300 characters']
    },

    // Budget amount and period
    amount: {
        type: Number,
        required: true,
        min: [0.01, 'Budget amount must be greater than 0']
    },

    period: {
        type: String,
        required: true,
        enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
        default: 'monthly'
    },

    // Date range
    startDate: {
        type: Date,
        required: true,
        index: true
    },

    endDate: {
        type: Date,
        required: true,
        index: true
    },

    // Category filtering
    categories: [{
        type: String,
        required: true,
        trim: true,
        lowercase: true
    }],

    // Optional subcategory filtering
    subcategories: [{
        type: String,
        trim: true,
        lowercase: true
    }],

    // Budget type and behavior
    type: {
        type: String,
        enum: ['expense', 'income', 'savings'],
        default: 'expense',
        required: true
    },

    // Budget limits and alerts
    alertThresholds: {
        warning: {
            percentage: { type: Number, min: 0, max: 100, default: 75 },
            enabled: { type: Boolean, default: true }
        },
        critical: {
            percentage: { type: Number, min: 0, max: 100, default: 90 },
            enabled: { type: Boolean, default: true }
        }
    },

    // Rollover settings
    rollover: {
        enabled: { type: Boolean, default: false },
        carryOverUnused: { type: Boolean, default: true },
        maxRolloverAmount: { type: Number, min: 0 },
        resetOnNewPeriod: { type: Boolean, default: true }
    },

    // Current period tracking
    currentPeriod: {
        spent: { type: Number, default: 0, min: 0 },
        remaining: { type: Number, default: 0 },
        transactionCount: { type: Number, default: 0 },
        lastTransactionDate: Date,
        rolloverAmount: { type: Number, default: 0 }
    },

    // Budget status
    status: {
        type: String,
        enum: ['active', 'paused', 'completed', 'exceeded'],
        default: 'active',
        index: true
    },

    // Auto-renewal settings
    autoRenew: {
        enabled: { type: Boolean, default: true },
        adjustAmount: { type: Boolean, default: false },
        adjustmentPercentage: { type: Number, min: -50, max: 100, default: 0 }
    },

    // Historical tracking
    history: [{
        period: String, // e.g., "2024-01", "2024-Q1"
        budgetAmount: Number,
        actualSpent: Number,
        variance: Number,
        variancePercentage: Number,
        transactionCount: Number,
        startDate: Date,
        endDate: Date,
        notes: String
    }],

    // Goals and targets
    goals: {
        targetSavings: Number,
        targetReduction: Number, // Percentage reduction from previous period
        milestone: {
            amount: Number,
            description: String,
            achieved: { type: Boolean, default: false },
            achievedDate: Date
        }
    },

    // Analytics and insights
    analytics: {
        averageSpent: Number,
        trendDirection: { type: String, enum: ['up', 'down', 'stable'] },
        seasonalPattern: String,
        riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
        recommendations: [String]
    },

    // Sharing and collaboration
    sharing: {
        isShared: { type: Boolean, default: false },
        sharedWith: [{
            userId: String,
            email: String,
            permission: { type: String, enum: ['view', 'edit'], default: 'view' },
            sharedAt: { type: Date, default: Date.now }
        }]
    },

    // Metadata
    metadata: {
        createdFrom: { type: String, enum: ['manual', 'template', 'suggestion', 'import'] },
        templateId: String,
        tags: [String],
        color: { type: String, default: '#3498db' },
        icon: String,
        lastCalculated: { type: Date, default: Date.now }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better query performance
budgetSchema.index({ userId: 1, status: 1 });
budgetSchema.index({ userId: 1, startDate: 1, endDate: 1 });
budgetSchema.index({ userId: 1, categories: 1 });
budgetSchema.index({ endDate: 1, status: 1 }); // For finding expired budgets

// Virtual for budget utilization percentage
budgetSchema.virtual('utilizationPercentage').get(function () {
    if (!this.amount || this.amount === 0) return 0;
    return Math.round((this.currentPeriod.spent / this.amount) * 100);
});

// Virtual for remaining amount
budgetSchema.virtual('remainingAmount').get(function () {
    return Math.max(0, this.amount - this.currentPeriod.spent + (this.currentPeriod.rolloverAmount || 0));
});

// Virtual for budget health status
budgetSchema.virtual('healthStatus').get(function () {
    const utilization = this.utilizationPercentage;

    if (utilization >= this.alertThresholds.critical.percentage) return 'critical';
    if (utilization >= this.alertThresholds.warning.percentage) return 'warning';
    if (utilization < 50) return 'good';
    return 'ok';
});

// Virtual for days remaining
budgetSchema.virtual('daysRemaining').get(function () {
    const now = new Date();
    const endDate = new Date(this.endDate);
    return Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
});

// Virtual for daily spending rate
budgetSchema.virtual('dailySpendingRate').get(function () {
    const now = new Date();
    const startDate = new Date(this.startDate);
    const daysPassed = Math.max(1, Math.ceil((now - startDate) / (1000 * 60 * 60 * 24)));
    return this.currentPeriod.spent / daysPassed;
});

// Virtual for projected end amount
budgetSchema.virtual('projectedEndAmount').get(function () {
    const totalDays = Math.ceil((new Date(this.endDate) - new Date(this.startDate)) / (1000 * 60 * 60 * 24));
    return this.dailySpendingRate * totalDays;
});

// Pre-save middleware
budgetSchema.pre('save', function (next) {
    // Calculate remaining amount
    this.currentPeriod.remaining = this.remainingAmount;

    // Update status based on utilization
    const utilization = this.utilizationPercentage;
    if (utilization >= 100) {
        this.status = 'exceeded';
    } else if (new Date() > new Date(this.endDate)) {
        this.status = 'completed';
    } else if (this.status === 'exceeded' && utilization < 100) {
        this.status = 'active';
    }

    // Update metadata
    this.metadata.lastCalculated = new Date();

    next();
});

// Static method to find active budgets for user
budgetSchema.statics.findActiveBudgets = function (userId) {
    const now = new Date();
    return this.find({
        userId,
        status: 'active',
        startDate: { $lte: now },
        endDate: { $gte: now }
    }).sort({ createdAt: -1 });
};

// Static method to find budgets by category
budgetSchema.statics.findBudgetsByCategory = function (userId, category) {
    return this.find({
        userId,
        categories: category,
        status: { $in: ['active', 'exceeded'] }
    });
};

// Static method to get budget summary
budgetSchema.statics.getBudgetSummary = function (userId) {
    return this.aggregate([
        {
            $match: {
                userId,
                status: { $in: ['active', 'exceeded'] }
            }
        },
        {
            $group: {
                _id: null,
                totalBudget: { $sum: '$amount' },
                totalSpent: { $sum: '$currentPeriod.spent' },
                averageUtilization: { $avg: { $multiply: [{ $divide: ['$currentPeriod.spent', '$amount'] }, 100] } },
                activeBudgets: { $sum: 1 },
                exceededBudgets: {
                    $sum: {
                        $cond: [{ $eq: ['$status', 'exceeded'] }, 1, 0]
                    }
                }
            }
        }
    ]);
};

// Instance method to add transaction to budget
budgetSchema.methods.addTransaction = function (transactionAmount) {
    this.currentPeriod.spent += transactionAmount;
    this.currentPeriod.transactionCount += 1;
    this.currentPeriod.lastTransactionDate = new Date();

    // Update remaining amount
    this.currentPeriod.remaining = Math.max(0, this.amount - this.currentPeriod.spent);

    return this.save();
};

// Instance method to check if budget needs alert
budgetSchema.methods.needsAlert = function () {
    const utilization = this.utilizationPercentage;

    if (this.alertThresholds.critical.enabled && utilization >= this.alertThresholds.critical.percentage) {
        return { level: 'critical', message: `Budget exceeded ${this.alertThresholds.critical.percentage}%` };
    }

    if (this.alertThresholds.warning.enabled && utilization >= this.alertThresholds.warning.percentage) {
        return { level: 'warning', message: `Budget reached ${this.alertThresholds.warning.percentage}%` };
    }

    return null;
};

// Instance method to renew budget for next period
budgetSchema.methods.renewForNextPeriod = function () {
    if (!this.autoRenew.enabled) {
        return null;
    }

    // Archive current period to history
    this.history.push({
        period: this.getPeriodString(),
        budgetAmount: this.amount,
        actualSpent: this.currentPeriod.spent,
        variance: this.amount - this.currentPeriod.spent,
        variancePercentage: ((this.amount - this.currentPeriod.spent) / this.amount) * 100,
        transactionCount: this.currentPeriod.transactionCount,
        startDate: this.startDate,
        endDate: this.endDate,
        notes: `Auto-renewed budget period`
    });

    // Calculate new dates
    const periodInDays = this.getPeriodInDays();
    this.startDate = new Date(this.endDate);
    this.startDate.setDate(this.startDate.getDate() + 1);
    this.endDate = new Date(this.startDate);
    this.endDate.setDate(this.endDate.getDate() + periodInDays - 1);

    // Adjust amount if enabled
    if (this.autoRenew.adjustAmount) {
        this.amount += (this.amount * this.autoRenew.adjustmentPercentage / 100);
    }

    // Handle rollover
    let rolloverAmount = 0;
    if (this.rollover.enabled && this.rollover.carryOverUnused) {
        rolloverAmount = Math.max(0, this.amount - this.currentPeriod.spent);
        if (this.rollover.maxRolloverAmount) {
            rolloverAmount = Math.min(rolloverAmount, this.rollover.maxRolloverAmount);
        }
    }

    // Reset current period
    this.currentPeriod = {
        spent: 0,
        remaining: this.amount + rolloverAmount,
        transactionCount: 0,
        rolloverAmount: rolloverAmount
    };

    this.status = 'active';

    return this.save();
};

// Instance method to get period string
budgetSchema.methods.getPeriodString = function () {
    const date = new Date(this.startDate);

    switch (this.period) {
        case 'weekly':
            return `${date.getFullYear()}-W${this.getWeekNumber(date)}`;
        case 'monthly':
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        case 'quarterly':
            return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
        case 'yearly':
            return `${date.getFullYear()}`;
        default:
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
};

// Helper method to get period in days
budgetSchema.methods.getPeriodInDays = function () {
    switch (this.period) {
        case 'weekly': return 7;
        case 'monthly': return 30;
        case 'quarterly': return 90;
        case 'yearly': return 365;
        default: return 30;
    }
};

// Helper method to get week number
budgetSchema.methods.getWeekNumber = function (date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

const Budget = mongoose.model('Budget', budgetSchema);

module.exports = Budget;