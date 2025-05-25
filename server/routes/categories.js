const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const { asyncHandler, sendSuccess, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Validation middleware
const validateCategory = [
    body('name')
        .isLength({ min: 1, max: 50 })
        .trim()
        .withMessage('Category name is required and must be less than 50 characters'),

    body('type')
        .isIn(['income', 'expense'])
        .withMessage('Type must be either income or expense'),

    body('description')
        .optional()
        .isLength({ max: 200 })
        .trim()
        .withMessage('Description cannot exceed 200 characters'),

    body('color')
        .optional()
        .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
        .withMessage('Color must be a valid hex color code'),

    body('parentCategory')
        .optional()
        .isMongoId()
        .withMessage('Parent category must be a valid ID')
];

// Helper function to check validation results
const checkValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};

// GET /api/categories - Get user's categories
router.get('/',
    query('type')
        .optional()
        .isIn(['income', 'expense'])
        .withMessage('Type must be income or expense'),

    query('includeSystem')
        .optional()
        .isBoolean()
        .withMessage('includeSystem must be boolean'),

    query('hierarchical')
        .optional()
        .isBoolean()
        .withMessage('hierarchical must be boolean'),

    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { type, includeSystem = 'true', hierarchical = 'false' } = req.query;

        let categories;

        if (hierarchical === 'true') {
            categories = await Category.getCategoryHierarchy(userId, type);
        } else {
            categories = await Category.getUserCategories(userId, type);
        }

        // Filter out system categories if not requested
        if (includeSystem === 'false') {
            categories = categories.filter(cat => !cat.isSystem);
        }

        sendSuccess(res, categories, 'Categories retrieved successfully');
    })
);

// POST /api/categories/initialize - Initialize default categories for user
router.post('/initialize',
    asyncHandler(async (req, res) => {
        const userId = req.user.id;

        // Check if user already has categories
        const existingCategories = await Category.find({ userId }).limit(1);

        if (existingCategories.length > 0) {
            throw new AppError('User already has categories initialized', 409, 'CATEGORIES_EXIST');
        }

        // Initialize default categories
        const categories = await Category.initializeUserCategories(userId);

        sendSuccess(res, categories, 'Default categories initialized successfully', 201);
    })
);

// GET /api/categories/stats - Get category usage statistics
router.get('/stats',
    query('period')
        .optional()
        .isIn(['week', 'month', 'quarter', 'year'])
        .withMessage('Period must be week, month, quarter, or year'),

    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const period = req.query.period || 'month';

        // Calculate date range based on period
        const endDate = new Date();
        const startDate = new Date();

        switch (period) {
            case 'week':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case 'quarter':
                startDate.setMonth(startDate.getMonth() - 3);
                break;
            case 'year':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
        }

        // Get category usage from transactions
        const categoryStats = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    date: { $gte: startDate, $lte: endDate },
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: { category: '$category', type: '$type' },
                    totalAmount: { $sum: '$amount' },
                    transactionCount: { $sum: 1 },
                    avgAmount: { $avg: '$amount' },
                    lastUsed: { $max: '$date' }
                }
            },
            {
                $sort: { totalAmount: -1 }
            }
        ]);

        // Get top categories by spending/income
        const topExpenseCategories = categoryStats
            .filter(stat => stat._id.type === 'expense')
            .slice(0, 10);

        const topIncomeCategories = categoryStats
            .filter(stat => stat._id.type === 'income')
            .slice(0, 10);

        // Calculate total amounts
        const totalExpenses = topExpenseCategories.reduce((sum, cat) => sum + cat.totalAmount, 0);
        const totalIncome = topIncomeCategories.reduce((sum, cat) => sum + cat.totalAmount, 0);

        sendSuccess(res, {
            period,
            dateRange: { startDate, endDate },
            summary: {
                totalIncome,
                totalExpenses,
                netIncome: totalIncome - totalExpenses,
                categoriesUsed: categoryStats.length
            },
            topCategories: {
                expenses: topExpenseCategories,
                income: topIncomeCategories
            },
            allCategories: categoryStats
        }, 'Category statistics retrieved successfully');
    })
);

// GET /api/categories/:id - Get specific category
router.get('/:id',
    param('id').isMongoId().withMessage('Invalid category ID'),
    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const categoryId = req.params.id;

        const category = await Category.findOne({
            _id: categoryId,
            $or: [{ userId }, { isSystem: true }]
        }).populate('parentCategory subcategories');

        if (!category) {
            throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND');
        }

        // Get recent transactions for this category
        const recentTransactions = await Transaction.find({
            userId,
            category: category.name,
            status: 'completed'
        })
            .sort({ date: -1 })
            .limit(10)
            .lean();

        // Get full category path
        const fullPath = await category.getFullPath();

        sendSuccess(res, {
            category,
            fullPath,
            recentTransactions,
            canDelete: category.canDelete()
        }, 'Category retrieved successfully');
    })
);

// POST /api/categories - Create new category
router.post('/',
    validateCategory,
    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;

        // Check if category with same name already exists for user
        const existingCategory = await Category.findOne({
            userId,
            name: new RegExp(`^${req.body.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
            type: req.body.type
        });

        if (existingCategory) {
            throw new AppError('Category with this name already exists', 409, 'CATEGORY_EXISTS');
        }

        // Validate parent category if provided
        if (req.body.parentCategory) {
            const parentCategory = await Category.findOne({
                _id: req.body.parentCategory,
                $or: [{ userId }, { isSystem: true }],
                type: req.body.type
            });

            if (!parentCategory) {
                throw new AppError('Parent category not found', 404, 'PARENT_CATEGORY_NOT_FOUND');
            }

            // Check depth limit
            if (parentCategory.level >= 2) {
                throw new AppError('Maximum nesting depth exceeded', 400, 'MAX_DEPTH_EXCEEDED');
            }
        }

        const categoryData = {
            ...req.body,
            userId,
            metadata: {
                source: 'user',
                createdBy: userId
            }
        };

        const category = new Category(categoryData);
        await category.save();

        // Update parent category if applicable
        if (req.body.parentCategory) {
            await Category.findByIdAndUpdate(
                req.body.parentCategory,
                { $push: { subcategories: category._id } }
            );
        }

        sendSuccess(res, category, 'Category created successfully', 201);
    })
);

// PUT /api/categories/:id - Update category
router.put('/:id',
    param('id').isMongoId().withMessage('Invalid category ID'),
    validateCategory,
    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const categoryId = req.params.id;

        const category = await Category.findOne({
            _id: categoryId,
            userId // Only user categories can be updated
        });

        if (!category) {
            throw new AppError('Category not found or cannot be modified', 404, 'CATEGORY_NOT_FOUND');
        }

        // Check if new name conflicts with existing categories
        if (req.body.name && req.body.name !== category.name) {
            const existingCategory = await Category.findOne({
                userId,
                name: new RegExp(`^${req.body.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
                type: req.body.type || category.type,
                _id: { $ne: categoryId }
            });

            if (existingCategory) {
                throw new AppError('Category with this name already exists', 409, 'CATEGORY_EXISTS');
            }
        }

        // Update category
        Object.assign(category, req.body);
        await category.save();

        sendSuccess(res, category, 'Category updated successfully');
    })
);

// DELETE /api/categories/:id - Delete category
router.delete('/:id',
    param('id').isMongoId().withMessage('Invalid category ID'),
    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const categoryId = req.params.id;

        const category = await Category.findOne({
            _id: categoryId,
            userId // Only user categories can be deleted
        });

        if (!category) {
            throw new AppError('Category not found or cannot be deleted', 404, 'CATEGORY_NOT_FOUND');
        }

        // Check if category can be deleted
        if (!category.canDelete()) {
            throw new AppError('Category cannot be deleted - it has transactions or subcategories', 400, 'CATEGORY_IN_USE');
        }

        // Remove from parent category's subcategories
        if (category.parentCategory) {
            await Category.findByIdAndUpdate(
                category.parentCategory,
                { $pull: { subcategories: categoryId } }
            );
        }

        await Category.findByIdAndDelete(categoryId);

        sendSuccess(res, null, 'Category deleted successfully');
    })
);

// POST /api/categories/:id/subcategory - Add subcategory
router.post('/:id/subcategory',
    param('id').isMongoId().withMessage('Invalid category ID'),
    body('name')
        .isLength({ min: 1, max: 50 })
        .trim()
        .withMessage('Subcategory name is required and must be less than 50 characters'),

    body('description')
        .optional()
        .isLength({ max: 200 })
        .trim()
        .withMessage('Description cannot exceed 200 characters'),

    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const parentCategoryId = req.params.id;

        const parentCategory = await Category.findOne({
            _id: parentCategoryId,
            $or: [{ userId }, { isSystem: true }]
        });

        if (!parentCategory) {
            throw new AppError('Parent category not found', 404, 'PARENT_CATEGORY_NOT_FOUND');
        }

        // Check depth limit
        if (parentCategory.level >= 2) {
            throw new AppError('Maximum nesting depth exceeded', 400, 'MAX_DEPTH_EXCEEDED');
        }

        // Check if subcategory with same name already exists
        const existingSubcategory = await Category.findOne({
            userId,
            name: new RegExp(`^${req.body.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
            parentCategory: parentCategoryId
        });

        if (existingSubcategory) {
            throw new AppError('Subcategory with this name already exists', 409, 'SUBCATEGORY_EXISTS');
        }

        const subcategoryData = {
            name: req.body.name,
            description: req.body.description,
            type: parentCategory.type,
            color: req.body.color || parentCategory.color,
            icon: req.body.icon || parentCategory.icon
        };

        const [subcategory] = await parentCategory.addSubcategory(subcategoryData);

        sendSuccess(res, subcategory, 'Subcategory created successfully', 201);
    })
);

// GET /api/categories/suggest - Get category suggestions based on description
router.get('/suggest',
    query('description')
        .isLength({ min: 1 })
        .trim()
        .withMessage('Description is required for suggestions'),

    query('type')
        .optional()
        .isIn(['income', 'expense'])
        .withMessage('Type must be income or expense'),

    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { description, type } = req.query;

        // Get user's existing categories for matching
        const userCategories = await Category.find({
            $or: [{ userId }, { isSystem: true, isDefault: true }],
            isActive: true,
            ...(type && { type })
        });

        // Simple suggestion algorithm based on keywords
        const suggestions = suggestCategories(description, userCategories);

        sendSuccess(res, {
            description,
            suggestions: suggestions.slice(0, 5), // Top 5 suggestions
            allCategories: userCategories.map(cat => ({
                id: cat._id,
                name: cat.name,
                type: cat.type,
                color: cat.color,
                icon: cat.icon
            }))
        }, 'Category suggestions generated successfully');
    })
);

// POST /api/categories/bulk-update - Update multiple categories
router.post('/bulk-update',
    body('updates')
        .isArray({ min: 1, max: 50 })
        .withMessage('Updates must be an array with 1-50 items'),

    body('updates.*.id')
        .isMongoId()
        .withMessage('Each update must have a valid category ID'),

    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { updates } = req.body;

        const results = [];

        for (const update of updates) {
            try {
                const category = await Category.findOne({
                    _id: update.id,
                    userId
                });

                if (!category) {
                    results.push({
                        id: update.id,
                        success: false,
                        error: 'Category not found'
                    });
                    continue;
                }

                // Apply updates
                Object.assign(category, update.data);
                await category.save();

                results.push({
                    id: update.id,
                    success: true,
                    category
                });
            } catch (error) {
                results.push({
                    id: update.id,
                    success: false,
                    error: error.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const errorCount = results.filter(r => !r.success).length;

        sendSuccess(res, {
            results,
            summary: {
                total: updates.length,
                successful: successCount,
                failed: errorCount
            }
        }, `Bulk update completed: ${successCount} successful, ${errorCount} failed`);
    })
);

// GET /api/categories/export - Export categories
router.get('/export',
    query('format')
        .optional()
        .isIn(['json', 'csv'])
        .withMessage('Format must be json or csv'),

    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const format = req.query.format || 'json';

        const categories = await Category.find({
            userId,
            isActive: true
        })
            .populate('parentCategory', 'name')
            .sort({ type: 1, name: 1 })
            .lean();

        if (format === 'csv') {
            const csvHeader = 'Name,Type,Description,Color,Icon,Parent Category,Usage Count,Total Amount,Created Date\n';
            const csvData = categories.map(cat =>
                `"${cat.name}","${cat.type}","${cat.description || ''}","${cat.color}","${cat.icon}","${cat.parentCategory?.name || ''}",${cat.usage?.transactionCount || 0},${cat.usage?.totalAmount || 0},"${cat.createdAt.toISOString().split('T')[0]}"`
            ).join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=categories.csv');
            return res.send(csvHeader + csvData);
        }

        sendSuccess(res, categories, 'Categories exported successfully');
    })
);

// Helper function to suggest categories based on description
function suggestCategories(description, categories) {
    const descLower = description.toLowerCase();
    const suggestions = [];

    categories.forEach(category => {
        let score = 0;

        // Check if category name is in description
        if (descLower.includes(category.name.toLowerCase())) {
            score += 100;
        }

        // Check category rules/keywords
        if (category.rules?.keywords) {
            for (const keyword of category.rules.keywords) {
                if (descLower.includes(keyword.toLowerCase())) {
                    score += 50;
                }
            }
        }

        // Check category rules/merchants
        if (category.rules?.merchants) {
            for (const merchant of category.rules.merchants) {
                if (descLower.includes(merchant.toLowerCase())) {
                    score += 75;
                }
            }
        }

        // Basic keyword matching for common categories
        const categoryKeywords = getCategoryKeywords(category.name);
        for (const keyword of categoryKeywords) {
            if (descLower.includes(keyword)) {
                score += 25;
            }
        }

        if (score > 0) {
            suggestions.push({
                category: {
                    id: category._id,
                    name: category.name,
                    type: category.type,
                    color: category.color,
                    icon: category.icon
                },
                score,
                confidence: Math.min(score / 100, 1) // Normalize to 0-1
            });
        }
    });

    return suggestions
        .sort((a, b) => b.score - a.score)
        .map(s => ({ ...s.category, confidence: s.confidence }));
}

function getCategoryKeywords(categoryName) {
    const keywordMap = {
        'groceries': ['grocery', 'supermarket', 'food', 'walmart', 'costco', 'safeway'],
        'restaurants': ['restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'dining'],
        'gas': ['gas', 'fuel', 'shell', 'exxon', 'bp', 'chevron'],
        'utilities': ['electric', 'water', 'gas bill', 'internet', 'phone', 'utility'],
        'entertainment': ['movie', 'netflix', 'spotify', 'games', 'concert', 'show'],
        'shopping': ['amazon', 'store', 'mall', 'purchase', 'retail', 'clothes'],
        'healthcare': ['hospital', 'doctor', 'pharmacy', 'medical', 'health', 'clinic'],
        'transportation': ['uber', 'lyft', 'taxi', 'bus', 'metro', 'train', 'transport'],
        'salary': ['salary', 'paycheck', 'wages', 'income', 'pay'],
        'freelance': ['freelance', 'consulting', 'contract', 'gig'],
        'investment': ['dividend', 'stock', 'bond', 'investment', 'return'],
        'rental': ['rent', 'rental', 'property', 'lease']
    };

    const categoryLower = categoryName.toLowerCase();
    return keywordMap[categoryLower] || [categoryLower];
}

module.exports = router;