const express = require('express');
const Category = require('../models/Category');
const { asyncHandler, sendSuccess, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/categories - Get user categories
router.get('/',
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { type } = req.query;

        console.log(`🔄 Fetching categories for user: ${userId}, type: ${type || 'all'}`);

        try {
            const categories = await Category.getUserCategories(userId, type);
            console.log(`✅ Found ${categories.length} categories`);

            sendSuccess(res, categories, 'Categories retrieved successfully');
        } catch (error) {
            console.error('❌ Error fetching categories:', error);
            throw new AppError('Failed to fetch categories', 500, 'CATEGORIES_FETCH_ERROR');
        }
    })
);

// POST /api/categories/initialize - Initialize default categories for user
router.post('/initialize',
    asyncHandler(async (req, res) => {
        const userId = req.user.id;

        console.log(`🔄 Initializing categories for user: ${userId}`);

        try {
            // Check if user already has categories
            const existingCategories = await Category.find({
                $or: [
                    { userId: userId },
                    { isSystem: true, isDefault: true }
                ]
            });

            if (existingCategories.length > 0) {
                console.log(`ℹ️ User already has ${existingCategories.length} categories`);
                return sendSuccess(res, existingCategories, 'Categories already exist');
            }

            // Initialize default categories for the user
            const userCategories = await Category.initializeUserCategories(userId);
            console.log(`✅ Initialized ${userCategories.length} categories for user`);

            sendSuccess(res, userCategories, 'Default categories initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing categories:', error);
            throw new AppError('Failed to initialize categories', 500, 'CATEGORIES_INIT_ERROR');
        }
    })
);

// POST /api/categories - Create new category
router.post('/',
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { name, type, description, icon, color } = req.body;

        console.log(`🔄 Creating category for user: ${userId}`, { name, type });

        try {
            // Check if category already exists for this user
            const existingCategory = await Category.findOne({
                userId: userId,
                name: name,
                type: type
            });

            if (existingCategory) {
                throw new AppError('Category with this name already exists', 400, 'CATEGORY_EXISTS');
            }

            const category = new Category({
                userId,
                name,
                type,
                description,
                icon: icon || 'folder',
                color: color || '#6c757d',
                metadata: {
                    source: 'user',
                    createdBy: userId
                }
            });

            await category.save();
            console.log(`✅ Created category: ${category._id}`);

            sendSuccess(res, category, 'Category created successfully');
        } catch (error) {
            console.error('❌ Error creating category:', error);
            if (error.isOperational) {
                throw error;
            }
            throw new AppError('Failed to create category', 500, 'CATEGORY_CREATE_ERROR');
        }
    })
);

// GET /api/categories/stats - Get category usage statistics
router.get('/stats',
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { period = 'month' } = req.query;

        console.log(`🔄 Fetching category stats for user: ${userId}, period: ${period}`);

        try {
            const categories = await Category.find({
                $or: [
                    { userId: userId },
                    { isSystem: true, isDefault: true }
                ],
                isActive: true
            }).select('name type usage');

            const stats = categories.map(cat => ({
                name: cat.name,
                type: cat.type,
                transactionCount: cat.usage.transactionCount,
                totalAmount: cat.usage.totalAmount,
                averageAmount: cat.usage.averageAmount,
                lastUsed: cat.usage.lastUsed
            }));

            sendSuccess(res, stats, 'Category statistics retrieved successfully');
        } catch (error) {
            console.error('❌ Error fetching category stats:', error);
            throw new AppError('Failed to fetch category statistics', 500, 'CATEGORY_STATS_ERROR');
        }
    })
);

// PUT /api/categories/:id - Update category
router.put('/:id',
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const categoryId = req.params.id;
        const updates = req.body;

        console.log(`🔄 Updating category: ${categoryId} for user: ${userId}`);

        try {
            const category = await Category.findOne({
                _id: categoryId,
                $or: [
                    { userId: userId },
                    { isSystem: true }
                ]
            });

            if (!category) {
                throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND');
            }

            if (category.isSystem) {
                throw new AppError('System categories cannot be modified', 403, 'SYSTEM_CATEGORY_READONLY');
            }

            Object.assign(category, updates);
            await category.save();

            console.log(`✅ Updated category: ${categoryId}`);
            sendSuccess(res, category, 'Category updated successfully');
        } catch (error) {
            console.error('❌ Error updating category:', error);
            if (error.isOperational) {
                throw error;
            }
            throw new AppError('Failed to update category', 500, 'CATEGORY_UPDATE_ERROR');
        }
    })
);

// DELETE /api/categories/:id - Delete category
router.delete('/:id',
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const categoryId = req.params.id;

        console.log(`🔄 Deleting category: ${categoryId} for user: ${userId}`);

        try {
            const category = await Category.findOne({
                _id: categoryId,
                userId: userId
            });

            if (!category) {
                throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND');
            }

            if (!category.canDelete()) {
                throw new AppError('Category cannot be deleted (has transactions or subcategories)', 400, 'CATEGORY_IN_USE');
            }

            await Category.findByIdAndDelete(categoryId);
            console.log(`✅ Deleted category: ${categoryId}`);

            sendSuccess(res, null, 'Category deleted successfully');
        } catch (error) {
            console.error('❌ Error deleting category:', error);
            if (error.isOperational) {
                throw error;
            }
            throw new AppError('Failed to delete category', 500, 'CATEGORY_DELETE_ERROR');
        }
    })
);

module.exports = router;