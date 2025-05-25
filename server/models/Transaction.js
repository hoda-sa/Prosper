const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    // User reference
    userId: {
        type: String,
        required: true,
        index: true
    },

    // Basic transaction information
    type: {
        type: String,
        required: true,
        enum: ['income', 'expense'],
        index: true
    },

    amount: {
        type: Number,
        required: true,
        min: [0.01, 'Amount must be greater than 0']
    },

    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: [200, 'Description cannot exceed 200 characters']
    },

    // Category information
    category: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    subcategory: {
        type: String,
        trim: true
    },

    // Date information
    date: {
        type: Date,
        required: true,
        index: true,
        default: Date.now
    },

    // Location and merchant info
    merchant: {
        name: String,
        location: {
            address: String,
            city: String,
            state: String,
            country: String,
            coordinates: {
                latitude: Number,
                longitude: Number
            }
        }
    },

    // Payment method
    paymentMethod: {
        type: String,
        enum: ['cash', 'credit_card', 'debit_card', 'bank_transfer', 'check', 'digital_wallet', 'other'],
        default: 'other'
    },

    // Account information (if connected to bank)
    account: {
        accountId: String,
        accountName: String,
        institutionName: String,
        accountType: {
            type: String,
            enum: ['checking', 'savings', 'credit', 'investment', 'loan', 'other']
        }
    },

    // Transaction source
    source: {
        type: String,
        enum: ['manual', 'plaid', 'csv_import', 'api'],
        default: 'manual',
        index: true
    },

    // External reference (for bank transactions)
    externalId: {
        type: String,
        sparse: true, // Allows multiple null values but ensures uniqueness when present
        index: true
    },

    // Transaction status
    status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled', 'failed'],
        default: 'completed',
        index: true
    },

    // Tags for additional categorization
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],

    // Notes and attachments
    notes: {
        type: String,
        maxlength: [500, 'Notes cannot exceed 500 characters']
    },

    attachments: [{
        fileName: String,
        fileUrl: String,
        fileType: String,
        fileSize: Number,
        uploadedAt: { type: Date, default: Date.now }
    }],

    // Recurring transaction info
    recurring: {
        isRecurring: { type: Boolean, default: false },
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'bi-weekly', 'monthly', 'quarterly', 'yearly']
        },
        nextDueDate: Date,
        endDate: Date,
        parentTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }
    },

    // Budget tracking
    budgetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Budget'
    },

    budgetImpact: {
        affectsBudget: { type: Boolean, default: true },
        budgetCategory: String,
        remainingBudget: Number
    },

    // Financial analysis flags
    analysis: {
        isAnomaly: { type: Boolean, default: false },
        anomalyReason: String,
        confidence: { type: Number, min: 0, max: 1 },
        predictedCategory: String,
        tags: [String]
    },

    // Metadata
    metadata: {
        importBatch: String,
        originalData: mongoose.Schema.Types.Mixed,
        processingFlags: [String],
        lastModifiedBy: String
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Compound indexes for better query performance
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, type: 1, date: -1 });
transactionSchema.index({ userId: 1, category: 1, date: -1 });
transactionSchema.index({ userId: 1, source: 1 });
transactionSchema.index({ externalId: 1, userId: 1 });
transactionSchema.index({ 'recurring.isRecurring': 1, 'recurring.nextDueDate': 1 });

// Virtual for formatted amount with currency
transactionSchema.virtual('formattedAmount').get(function () {
    return `$${this.amount.toFixed(2)}`;
});

// Virtual for transaction age in days
transactionSchema.virtual('ageInDays').get(function () {
    return Math.floor((Date.now() - this.date) / (1000 * 60 * 60 * 24));
});

// Virtual for month/year grouping
transactionSchema.virtual('monthYear').get(function () {
    const date = new Date(this.date);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
});

// Pre-save middleware
transactionSchema.pre('save', function (next) {
    // Ensure category is properly formatted
    if (this.category) {
        this.category = this.category.toLowerCase().trim();
    }

    // Set subcategory to category if not provided
    if (!this.subcategory && this.category) {
        this.subcategory = this.category;
    }

    // Validate amount based on type
    if (this.type === 'expense' && this.amount < 0) {
        this.amount = Math.abs(this.amount);
    }

    // Clean up tags
    if (this.tags && this.tags.length > 0) {
        this.tags = this.tags
            .filter(tag => tag && tag.trim())
            .map(tag => tag.toLowerCase().trim())
            .filter((tag, index, self) => self.indexOf(tag) === index); // Remove duplicates
    }

    next();
});

// Static method to get transactions by date range
transactionSchema.statics.getByDateRange = function (userId, startDate, endDate, options = {}) {
    const query = {
        userId,
        date: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        }
    };

    if (options.type) {
        query.type = options.type;
    }

    if (options.category) {
        query.category = options.category;
    }

    if (options.status) {
        query.status = options.status;
    }

    return this.find(query)
        .sort({ date: -1 })
        .limit(options.limit || 100);
};

// Static method to get monthly summary
transactionSchema.statics.getMonthlySummary = function (userId, year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    return this.aggregate([
        {
            $match: {
                userId,
                date: { $gte: startDate, $lte: endDate },
                status: 'completed'
            }
        },
        {
            $group: {
                _id: '$type',
                total: { $sum: '$amount' },
                count: { $sum: 1 },
                avgAmount: { $avg: '$amount' },
                categories: { $addToSet: '$category' }
            }
        }
    ]);
};

// Static method to get category breakdown
transactionSchema.statics.getCategoryBreakdown = function (userId, startDate, endDate, type = null) {
    const matchQuery = {
        userId,
        date: { $gte: new Date(startDate), $lte: new Date(endDate) },
        status: 'completed'
    };

    if (type) {
        matchQuery.type = type;
    }

    return this.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: { category: '$category', type: '$type' },
                total: { $sum: '$amount' },
                count: { $sum: 1 },
                avgAmount: { $avg: '$amount' }
            }
        },
        {
            $sort: { total: -1 }
        }
    ]);
};

// Instance method to categorize transaction automatically
transactionSchema.methods.autoCategorizе = function () {
    // Simple categorization logic based on description and merchant
    const description = this.description.toLowerCase();
    const merchantName = this.merchant?.name?.toLowerCase() || '';

    // Define category keywords
    const categoryRules = {
        'groceries': ['grocery', 'supermarket', 'walmart', 'costco', 'kroger'],
        'restaurants': ['restaurant', 'cafe', 'coffee', 'pizza', 'burger'],
        'gas': ['gas', 'fuel', 'shell', 'exxon', 'bp'],
        'utilities': ['electric', 'water', 'gas bill', 'internet', 'phone'],
        'entertainment': ['movie', 'netflix', 'spotify', 'games'],
        'shopping': ['amazon', 'store', 'mall', 'purchase'],
        'healthcare': ['hospital', 'doctor', 'pharmacy', 'medical'],
        'transportation': ['uber', 'lyft', 'taxi', 'bus', 'metro']
    };

    for (const [category, keywords] of Object.entries(categoryRules)) {
        if (keywords.some(keyword =>
            description.includes(keyword) || merchantName.includes(keyword)
        )) {
            this.category = category;
            this.analysis.predictedCategory = category;
            this.analysis.confidence = 0.7;
            break;
        }
    }

    return this;
};

// Instance method to check if transaction is duplicate
transactionSchema.methods.isDuplicate = async function () {
    const duplicateQuery = {
        userId: this.userId,
        amount: this.amount,
        date: {
            $gte: new Date(this.date.getTime() - 24 * 60 * 60 * 1000), // 1 day before
            $lte: new Date(this.date.getTime() + 24 * 60 * 60 * 1000)  // 1 day after
        },
        _id: { $ne: this._id }
    };

    if (this.externalId) {
        duplicateQuery.externalId = this.externalId;
    }

    const duplicate = await this.constructor.findOne(duplicateQuery);
    return !!duplicate;
};

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;