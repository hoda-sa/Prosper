/**
 * NOTE: Features like Craete and Delete categories are for future versions of the app.
 */

const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    // User reference (null for system/default categories)
    userId: {
        type: String,
        index: true,
        sparse: true // Allows null values but ensures uniqueness when present
    },

    // Basic category information
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: [50, 'Category name cannot exceed 50 characters']
    },

    description: {
        type: String,
        trim: true,
        maxlength: [200, 'Description cannot exceed 200 characters']
    },

    // Category type
    type: {
        type: String,
        required: true,
        enum: ['income', 'expense'],
        index: true
    },

    // Category hierarchy
    parentCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },

    subcategories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    }],

    level: {
        type: Number,
        default: 0,
        min: 0,
        max: 3 // Limit nesting depth
    },

    // Visual representation
    icon: {
        type: String,
        default: 'folder'
    },

    color: {
        type: String,
        default: '#6c757d',
        match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color format']
    },

    // Category status
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },

    isSystem: {
        type: Boolean,
        default: false,
        index: true
    },

    isDefault: {
        type: Boolean,
        default: false
    },

    // Usage statistics
    usage: {
        transactionCount: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 },
        averageAmount: { type: Number, default: 0 },
        lastUsed: Date,
        monthlyUsage: [{
            month: String, // YYYY-MM format
            count: Number,
            amount: Number
        }]
    },

    // Auto-categorization rules
    rules: {
        keywords: [String], // Keywords to match in transaction descriptions
        merchants: [String], // Merchant names that should use this category
        amountRange: {
            min: Number,
            max: Number
        },
        patterns: [String] // Regex patterns for matching
    },

    // Budget integration
    budgetSettings: {
        hasDefaultBudget: { type: Boolean, default: false },
        defaultBudgetAmount: Number,
        budgetPeriod: {
            type: String,
            enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
            default: 'monthly'
        },
        alertThreshold: { type: Number, min: 0, max: 100, default: 80 }
    },

    // Sorting and organization
    sortOrder: {
        type: Number,
        default: 0
    },

    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],

    // Metadata
    metadata: {
        createdBy: String,
        source: {
            type: String,
            enum: ['user', 'system', 'import', 'suggestion'],
            default: 'user'
        },
        template: String,
        customFields: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Compound indexes
categorySchema.index({ userId: 1, name: 1 }, { unique: true, sparse: true });
categorySchema.index({ userId: 1, type: 1, isActive: 1 });
categorySchema.index({ isSystem: 1, type: 1 });
categorySchema.index({ parentCategory: 1 });

// Virtual for full category path
categorySchema.virtual('fullPath').get(function () {
    // This would be populated by a separate method that traverses the hierarchy
    return this.name;
});

// Virtual for subcategory count
categorySchema.virtual('subcategoryCount').get(function () {
    return this.subcategories ? this.subcategories.length : 0;
});

// Virtual for average monthly usage
categorySchema.virtual('averageMonthlyUsage').get(function () {
    if (!this.usage.monthlyUsage || this.usage.monthlyUsage.length === 0) return 0;

    const totalUsage = this.usage.monthlyUsage.reduce((sum, month) => sum + month.count, 0);
    return Math.round(totalUsage / this.usage.monthlyUsage.length);
});

// Pre-save middleware
categorySchema.pre('save', function (next) {
    // Ensure system categories cannot be modified by users
    if (this.isSystem && this.isModified() && !this.isNew) {
        const modifiedPaths = this.modifiedPaths();
        const allowedModifications = ['usage', 'metadata.lastAccessed'];

        const hasUnallowedModifications = modifiedPaths.some(path =>
            !allowedModifications.some(allowed => path.startsWith(allowed))
        );

        if (hasUnallowedModifications) {
            return next(new Error('System categories cannot be modified'));
        }
    }

    // Calculate level based on parent hierarchy
    if (this.parentCategory) {
        // This would require a database query to get parent level
        // For now, we'll set it manually or calculate it in the application layer
    }

    // Update sort order if not set
    if (this.sortOrder === 0 && this.isNew) {
        this.sortOrder = Date.now();
    }

    next();
});

// Static method to get default categories
categorySchema.statics.getDefaultCategories = function () {
    return [
        // Income Categories
        { name: 'Salary', type: 'income', icon: 'briefcase', color: '#28a745', isSystem: true, isDefault: true },
        { name: 'Freelance', type: 'income', icon: 'laptop', color: '#17a2b8', isSystem: true, isDefault: true },
        { name: 'Investment', type: 'income', icon: 'trending-up', color: '#ffc107', isSystem: true, isDefault: true },
        { name: 'Rental', type: 'income', icon: 'home', color: '#6f42c1', isSystem: true, isDefault: true },
        { name: 'Other Income', type: 'income', icon: 'plus-circle', color: '#6c757d', isSystem: true, isDefault: true },

        // Expense Categories
        { name: 'Groceries', type: 'expense', icon: 'shopping-cart', color: '#28a745', isSystem: true, isDefault: true },
        { name: 'Restaurants', type: 'expense', icon: 'utensils', color: '#dc3545', isSystem: true, isDefault: true },
        { name: 'Transportation', type: 'expense', icon: 'car', color: '#007bff', isSystem: true, isDefault: true },
        { name: 'Gas', type: 'expense', icon: 'fuel', color: '#fd7e14', isSystem: true, isDefault: true },
        { name: 'Utilities', type: 'expense', icon: 'zap', color: '#ffc107', isSystem: true, isDefault: true },
        { name: 'Entertainment', type: 'expense', icon: 'play-circle', color: '#e83e8c', isSystem: true, isDefault: true },
        { name: 'Shopping', type: 'expense', icon: 'shopping-bag', color: '#6f42c1', isSystem: true, isDefault: true },
        { name: 'Healthcare', type: 'expense', icon: 'heart', color: '#dc3545', isSystem: true, isDefault: true },
        { name: 'Insurance', type: 'expense', icon: 'shield', color: '#17a2b8', isSystem: true, isDefault: true },
        { name: 'Education', type: 'expense', icon: 'book', color: '#28a745', isSystem: true, isDefault: true },
        { name: 'Home & Garden', type: 'expense', icon: 'home', color: '#20c997', isSystem: true, isDefault: true },
        { name: 'Personal Care', type: 'expense', icon: 'user', color: '#6c757d', isSystem: true, isDefault: true },
        { name: 'Subscriptions', type: 'expense', icon: 'repeat', color: '#fd7e14', isSystem: true, isDefault: true },
        { name: 'Travel', type: 'expense', icon: 'map', color: '#007bff', isSystem: true, isDefault: true },
        { name: 'Other Expenses', type: 'expense', icon: 'more-horizontal', color: '#6c757d', isSystem: true, isDefault: true }
    ];
};

// Static method to initialize user categories
categorySchema.statics.initializeUserCategories = async function (userId) {
    const defaultCategories = this.getDefaultCategories();

    const userCategories = defaultCategories.map(cat => ({
        ...cat,
        userId,
        isSystem: false, // User copies are not system categories
        metadata: {
            source: 'system',
            createdBy: userId
        }
    }));

    return this.insertMany(userCategories);
};

// Static method to get categories for user
categorySchema.statics.getUserCategories = function (userId, type = null) {
    const query = {
        $or: [
            { userId: userId },
            { isSystem: true, isDefault: true }
        ],
        isActive: true
    };

    if (type) {
        query.type = type;
    }

    return this.find(query)
        .populate('parentCategory', 'name')
        .populate('subcategories', 'name')
        .sort({ type: 1, sortOrder: 1, name: 1 });
};

// Static method to get category hierarchy
categorySchema.statics.getCategoryHierarchy = function (userId, type = null) {
    const query = {
        $or: [
            { userId: userId },
            { isSystem: true, isDefault: true }
        ],
        isActive: true,
        parentCategory: null // Only root categories
    };

    if (type) {
        query.type = type;
    }

    return this.find(query)
        .populate({
            path: 'subcategories',
            populate: {
                path: 'subcategories'
            }
        })
        .sort({ type: 1, sortOrder: 1, name: 1 });
};

// Instance method to update usage statistics
categorySchema.methods.updateUsage = function (amount) {
    this.usage.transactionCount += 1;
    this.usage.totalAmount += amount;
    this.usage.averageAmount = this.usage.totalAmount / this.usage.transactionCount;
    this.usage.lastUsed = new Date();

    // Update monthly usage
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    const monthlyEntry = this.usage.monthlyUsage.find(entry => entry.month === currentMonth);

    if (monthlyEntry) {
        monthlyEntry.count += 1;
        monthlyEntry.amount += amount;
    } else {
        this.usage.monthlyUsage.push({
            month: currentMonth,
            count: 1,
            amount: amount
        });
    }

    // Keep only last 12 months
    this.usage.monthlyUsage = this.usage.monthlyUsage
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, 12);

    return this.save();
};

// Instance method to add subcategory
categorySchema.methods.addSubcategory = function (subcategoryData) {
    const subcategory = new this.constructor({
        ...subcategoryData,
        userId: this.userId,
        parentCategory: this._id,
        level: this.level + 1,
        type: this.type
    });

    this.subcategories.push(subcategory._id);

    return Promise.all([
        subcategory.save(),
        this.save()
    ]);
};

// Instance method to check if category can be deleted
categorySchema.methods.canDelete = function () {
    if (this.isSystem) return false;
    if (this.usage.transactionCount > 0) return false;
    if (this.subcategories && this.subcategories.length > 0) return false;

    return true;
};

// Instance method to get full category path
categorySchema.methods.getFullPath = async function () {
    const path = [this.name];
    let current = this;

    while (current.parentCategory) {
        current = await this.constructor.findById(current.parentCategory);
        if (current) {
            path.unshift(current.name);
        } else {
            break;
        }
    }

    return path.join(' > ');
};

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;