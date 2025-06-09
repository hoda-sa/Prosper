/**
 * NOTE: Currently using Auth0 for user management and profile data.
 * This schema is prepared for future user data storage and advanced features
 * but most user information is handled directly through Auth0's user profile.
 * Features like financial profiles, subscription management, and usage stats
 * are designed for future app versions when we move beyond basic Auth0 integration.
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    // Auth0 user ID - this is the primary identifier
    auth0Id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Basic user information from Auth0
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },

    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },

    nickname: {
        type: String,
        trim: true,
        maxlength: [50, 'Nickname cannot exceed 50 characters']
    },

    picture: {
        type: String,
        trim: true
    },

    emailVerified: {
        type: Boolean,
        default: false
    },

    // User preferences and settings
    preferences: {
        currency: {
            type: String,
            default: 'USD',
            enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'CHF']
        },

        dateFormat: {
            type: String,
            default: 'MM/DD/YYYY',
            enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']
        },

        language: {
            type: String,
            default: 'en',
            enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh']
        },

        timezone: {
            type: String,
            default: 'America/New_York'
        },

        notifications: {
            email: {
                budgetAlerts: { type: Boolean, default: true },
                goalReminders: { type: Boolean, default: true },
                weeklyReports: { type: Boolean, default: false },
                monthlyReports: { type: Boolean, default: true }
            },

            push: {
                budgetAlerts: { type: Boolean, default: false },
                goalReminders: { type: Boolean, default: false }
            }
        },

        privacy: {
            shareData: { type: Boolean, default: false },
            analyticsOptOut: { type: Boolean, default: false }
        }
    },

    // Financial profile
    financialProfile: {
        monthlyIncome: {
            type: Number,
            min: 0,
            default: 0
        },

        employmentStatus: {
            type: String,
            enum: ['employed', 'self-employed', 'unemployed', 'student', 'retired', 'other'],
            default: 'employed'
        },

        riskTolerance: {
            type: String,
            enum: ['conservative', 'moderate', 'aggressive'],
            default: 'moderate'
        },

        financialGoals: [{
            name: { type: String, required: true },
            targetAmount: { type: Number, required: true, min: 0 },
            currentAmount: { type: Number, default: 0, min: 0 },
            targetDate: Date,
            priority: {
                type: String,
                enum: ['low', 'medium', 'high'],
                default: 'medium'
            }
        }]
    },

    // Account status and metadata
    accountStatus: {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'pending'],
        default: 'active'
    },

    subscription: {
        plan: {
            type: String,
            enum: ['free', 'premium', 'enterprise'],
            default: 'free'
        },

        startDate: {
            type: Date,
            default: Date.now
        },

        endDate: Date,

        isActive: {
            type: Boolean,
            default: true
        }
    },

    // Connected services
    connectedAccounts: {
        plaid: {
            accessToken: String,
            itemId: String,
            connectedAt: Date,
            lastSync: Date,
            isActive: { type: Boolean, default: false }
        },

        bank: {
            institutionName: String,
            accountCount: { type: Number, default: 0 },
            lastSync: Date,
            isActive: { type: Boolean, default: false }
        }
    },

    // Usage statistics
    stats: {
        totalTransactions: { type: Number, default: 0 },
        totalBudgets: { type: Number, default: 0 },
        lastActiveDate: { type: Date, default: Date.now },
        loginCount: { type: Number, default: 0 },
        dataExports: { type: Number, default: 0 }
    }
}, {
    timestamps: true, // Automatically adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better query performance
userSchema.index({ auth0Id: 1 });
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'stats.lastActiveDate': -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function () {
    return this.name || this.nickname || this.email.split('@')[0];
});

// Virtual for account age
userSchema.virtual('accountAge').get(function () {
    return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for subscription status
userSchema.virtual('isSubscriptionActive').get(function () {
    return this.subscription.isActive &&
        (!this.subscription.endDate || this.subscription.endDate > new Date());
});

// Pre-save middleware to update stats
userSchema.pre('save', function (next) {
    // Update last active date if this is an update (not initial creation)
    if (!this.isNew && this.isModified()) {
        this.stats.lastActiveDate = new Date();
    }

    // Ensure financial goals have valid data
    if (this.financialProfile && this.financialProfile.financialGoals) {
        this.financialProfile.financialGoals.forEach(goal => {
            if (goal.currentAmount > goal.targetAmount) {
                goal.currentAmount = goal.targetAmount;
            }
        });
    }

    next();
});

// Static method to find user by Auth0 ID
userSchema.statics.findByAuth0Id = function (auth0Id) {
    return this.findOne({ auth0Id });
};

// Static method to create user from Auth0 profile
userSchema.statics.createFromAuth0Profile = function (profile) {
    const userData = {
        auth0Id: profile.sub,
        email: profile.email,
        name: profile.name || profile.nickname || profile.email.split('@')[0],
        nickname: profile.nickname,
        picture: profile.picture,
        emailVerified: profile.email_verified || false
    };

    return this.create(userData);
};

// Instance method to update login stats
userSchema.methods.recordLogin = function () {
    this.stats.loginCount += 1;
    this.stats.lastActiveDate = new Date();
    return this.save();
};

// Instance method to update transaction count
userSchema.methods.updateTransactionCount = function (increment = 1) {
    this.stats.totalTransactions += increment;
    return this.save();
};

// Instance method to update budget count
userSchema.methods.updateBudgetCount = function (increment = 1) {
    this.stats.totalBudgets += increment;
    return this.save();
};

// Instance method to check if user can create more budgets (based on plan)
userSchema.methods.canCreateBudget = function () {
    const limits = {
        free: 5,
        premium: 50,
        enterprise: Infinity
    };

    const limit = limits[this.subscription.plan] || limits.free;
    return this.stats.totalBudgets < limit;
};

// Instance method to get user's currency symbol
userSchema.methods.getCurrencySymbol = function () {
    const symbols = {
        USD: '$',
        EUR: '€',
        GBP: '£',
        CAD: 'C',
        AUD: 'A',
        JPY: '¥',
        INR: '₹',
        CHF: 'CHF'
    };

    return symbols[this.preferences.currency] || '';
};

// Remove sensitive data when converting to JSON
userSchema.methods.toJSON = function () {
    const user = this.toObject();

    // Remove sensitive fields
    delete user.connectedAccounts.plaid.accessToken;
    delete user.__v;

    return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User;