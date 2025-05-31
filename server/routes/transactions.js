const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Category = require('../models/Category');
const { asyncHandler, sendSuccess, sendPaginatedResponse, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Validation middleware
const validateTransaction = [
    body('type')
        .isIn(['income', 'expense'])
        .withMessage('Type must be either income or expense'),

    body('amount')
        .isFloat({ min: 0.01 })
        .withMessage('Amount must be a positive number greater than 0'),

    body('description')
        .isLength({ min: 1, max: 200 })
        .trim()
        .withMessage('Description is required and must be less than 200 characters'),

    body('category')
        .isLength({ min: 1, max: 50 })
        .trim()
        .withMessage('Category is required and must be less than 50 characters'),

    body('date')
        .optional()
        .isISO8601()
        .withMessage('Date must be a valid ISO date'),

    body('paymentMethod')
        .optional()
        .isIn(['cash', 'credit_card', 'debit_card', 'bank_transfer', 'check', 'digital_wallet', 'other'])
        .withMessage('Invalid payment method'),

    body('tags')
        .optional()
        .isArray()
        .withMessage('Tags must be an array'),

    body('notes')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Notes cannot exceed 500 characters')
];

const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 1000 }) // Increased max limit to 1000
        .withMessage('Limit must be between 1 and 1000'),

    query('sortBy')
        .optional()
        .isIn(['date', 'amount', 'category', 'createdAt'])
        .withMessage('Invalid sort field'),

    query('sortOrder')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Sort order must be asc or desc')
];

const validateDateRange = [
    query('startDate')
        .optional()
        .isDate({ format: 'YYYY-MM-DD' })
        .withMessage('Start date must be in YYYY-MM-DD format'),

    query('endDate')
        .optional()
        .isDate({ format: 'YYYY-MM-DD' })
        .withMessage('End date must be in YYYY-MM-DD format')
];

// Helper function to check validation results
const checkValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('❌ Validation errors:', errors.array());
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};

// GET /api/transactions - Get user's transactions
router.get('/',
    validatePagination,
    validateDateRange,
    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const {
            page = 1,
            limit = 20,
            sortBy = 'date',
            sortOrder = 'desc',
            type,
            category,
            startDate,
            endDate,
            search,
            minAmount,
            maxAmount,
            paymentMethod,
            tags
        } = req.query;

        console.log('📊 Transaction query params:', {
            userId,
            startDate,
            endDate,
            limit,
            type,
            category
        });

        // Build query
        const query = { userId };

        // Filter by type
        if (type) {
            query.type = type;
        }

        // Filter by category
        if (category) {
            query.category = new RegExp(category, 'i');
        }

        // Filter by date range - FIXED DATE HANDLING
        if (startDate || endDate) {
            query.date = {};
            if (startDate) {
                // Ensure startDate includes full day from 00:00:00
                query.date.$gte = new Date(startDate + 'T00:00:00.000Z');
            }
            if (endDate) {
                // Ensure endDate includes full day until 23:59:59
                query.date.$lte = new Date(endDate + 'T23:59:59.999Z');
            }
            console.log('📅 Date filter applied:', query.date);
        }

        // Filter by amount range
        if (minAmount || maxAmount) {
            query.amount = {};
            if (minAmount) query.amount.$gte = parseFloat(minAmount);
            if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
        }

        // Filter by payment method
        if (paymentMethod) {
            query.paymentMethod = paymentMethod;
        }

        // Filter by tags
        if (tags) {
            const tagArray = Array.isArray(tags) ? tags : [tags];
            query.tags = { $in: tagArray };
        }

        // Search in description and merchant name
        if (search) {
            query.$or = [
                { description: new RegExp(search, 'i') },
                { 'merchant.name': new RegExp(search, 'i') }
            ];
        }

        // Only show completed transactions by default
        query.status = 'completed';

        console.log('🔍 Final query:', JSON.stringify(query, null, 2));

        // Execute query with pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortObj = {};
        sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const [transactions, total] = await Promise.all([
            Transaction.find(query)
                .sort(sortObj)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Transaction.countDocuments(query)
        ]);

        console.log('✅ Transactions found:', transactions.length, 'of', total, 'total');

        sendPaginatedResponse(res, transactions, page, limit, total, 'Transactions retrieved successfully');
    })
);

// GET /api/transactions/summary - Get transaction summary
router.get('/summary',
    validateDateRange,
    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { startDate, endDate, groupBy = 'month' } = req.query;

        // Default to current month if no dates provided
        const now = new Date();
        const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const defaultEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const start = startDate ? new Date(startDate + 'T00:00:00.000Z') : defaultStartDate;
        const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : defaultEndDate;

        // Get summary data
        const summary = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    date: { $gte: start, $lte: end },
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

        // Get category breakdown
        const categoryBreakdown = await Transaction.getCategoryBreakdown(
            userId, start, end
        );

        // Calculate net income
        const income = summary.find(s => s._id === 'income')?.total || 0;
        const expenses = summary.find(s => s._id === 'expense')?.total || 0;
        const netIncome = income - expenses;

        sendSuccess(res, {
            summary: {
                income,
                expenses,
                netIncome,
                totalTransactions: summary.reduce((sum, s) => sum + s.count, 0)
            },
            breakdown: {
                byType: summary,
                byCategory: categoryBreakdown
            },
            period: {
                startDate: start,
                endDate: end
            }
        }, 'Transaction summary retrieved successfully');
    })
);

// GET /api/transactions/:id - Get specific transaction
router.get('/:id',
    param('id').isMongoId().withMessage('Invalid transaction ID'),
    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const transactionId = req.params.id;

        const transaction = await Transaction.findOne({
            _id: transactionId,
            userId
        });

        if (!transaction) {
            throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
        }

        sendSuccess(res, transaction, 'Transaction retrieved successfully');
    })
);

// POST /api/transactions - Create new transaction
router.post('/',
    validateTransaction,
    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const transactionData = {
            ...req.body,
            userId,
            date: req.body.date || new Date()
        };

        // Auto-categorize if category not provided or is generic
        const transaction = new Transaction(transactionData);
        if (!req.body.category || req.body.category.toLowerCase() === 'other') {
            transaction.autoCategorizе();
        }

        // Check for duplicates
        const isDuplicate = await transaction.isDuplicate();
        if (isDuplicate) {
            throw new AppError('Duplicate transaction detected', 409, 'DUPLICATE_TRANSACTION');
        }

        // Save transaction
        await transaction.save();

        // Update budget if applicable
        if (transaction.type === 'expense') {
            const budget = await Budget.findOne({
                userId,
                categories: transaction.category,
                status: 'active',
                startDate: { $lte: transaction.date },
                endDate: { $gte: transaction.date }
            });

            if (budget) {
                await budget.addTransaction(transaction.amount);
                transaction.budgetId = budget._id;
                await transaction.save();
            }
        }

        // Update category usage
        const category = await Category.findOne({
            $or: [{ userId }, { isSystem: true }],
            name: new RegExp(`^${transaction.category}$`, 'i')
        });

        if (category) {
            await category.updateUsage(transaction.amount);
        }

        sendSuccess(res, transaction, 'Transaction created successfully', 201);
    })
);

// PUT /api/transactions/:id - Update transaction
router.put('/:id',
    param('id').isMongoId().withMessage('Invalid transaction ID'),
    validateTransaction,
    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const transactionId = req.params.id;

        const transaction = await Transaction.findOne({
            _id: transactionId,
            userId
        });

        if (!transaction) {
            throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
        }

        // Store old values for budget updates
        const oldAmount = transaction.amount;
        const oldCategory = transaction.category;

        // Update transaction
        Object.assign(transaction, req.body);
        await transaction.save();

        // Update budgets if amount or category changed
        if (transaction.type === 'expense' && (oldAmount !== transaction.amount || oldCategory !== transaction.category)) {
            // Remove from old budget
            if (transaction.budgetId) {
                const oldBudget = await Budget.findById(transaction.budgetId);
                if (oldBudget) {
                    oldBudget.currentPeriod.spent -= oldAmount;
                    oldBudget.currentPeriod.transactionCount -= 1;
                    await oldBudget.save();
                }
            }

            // Add to new budget
            const newBudget = await Budget.findOne({
                userId,
                categories: transaction.category,
                status: 'active',
                startDate: { $lte: transaction.date },
                endDate: { $gte: transaction.date }
            });

            if (newBudget) {
                await newBudget.addTransaction(transaction.amount);
                transaction.budgetId = newBudget._id;
                await transaction.save();
            } else {
                transaction.budgetId = null;
                await transaction.save();
            }
        }

        sendSuccess(res, transaction, 'Transaction updated successfully');
    })
);

// DELETE /api/transactions/:id - Delete transaction
router.delete('/:id',
    param('id').isMongoId().withMessage('Invalid transaction ID'),
    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const transactionId = req.params.id;

        const transaction = await Transaction.findOne({
            _id: transactionId,
            userId
        });

        if (!transaction) {
            throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
        }

        // Update budget if applicable
        if (transaction.budgetId && transaction.type === 'expense') {
            const budget = await Budget.findById(transaction.budgetId);
            if (budget) {
                budget.currentPeriod.spent -= transaction.amount;
                budget.currentPeriod.transactionCount -= 1;
                await budget.save();
            }
        }

        // Delete transaction
        await Transaction.findByIdAndDelete(transactionId);

        sendSuccess(res, null, 'Transaction deleted successfully');
    })
);

// POST /api/transactions/bulk - Create multiple transactions
router.post('/bulk',
    body('transactions')
        .isArray({ min: 1, max: 100 })
        .withMessage('Transactions must be an array with 1-100 items'),

    body('transactions.*.type')
        .isIn(['income', 'expense'])
        .withMessage('Type must be either income or expense'),

    body('transactions.*.amount')
        .isFloat({ min: 0.01 })
        .withMessage('Amount must be a positive number'),

    body('transactions.*.description')
        .isLength({ min: 1, max: 200 })
        .withMessage('Description is required'),

    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { transactions } = req.body;

        // Prepare transactions with user ID
        const transactionsToCreate = transactions.map(t => ({
            ...t,
            userId,
            date: t.date || new Date(),
            source: 'bulk_import'
        }));

        // Insert all transactions
        const createdTransactions = await Transaction.insertMany(transactionsToCreate);

        sendSuccess(res, {
            created: createdTransactions.length,
            transactions: createdTransactions
        }, 'Bulk transactions created successfully', 201);
    })
);

// GET /api/transactions/export - Export transactions
router.get('/export',
    validateDateRange,
    query('format')
        .optional()
        .isIn(['json', 'csv'])
        .withMessage('Format must be json or csv'),
    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { startDate, endDate, format = 'json' } = req.query;

        const query = { userId, status: 'completed' };

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate + 'T00:00:00.000Z');
            if (endDate) query.date.$lte = new Date(endDate + 'T23:59:59.999Z');
        }

        const transactions = await Transaction.find(query)
            .sort({ date: -1 })
            .lean();

        if (format === 'csv') {
            // Convert to CSV format
            const csvHeader = 'Date,Type,Amount,Description,Category,Payment Method,Notes\n';
            const csvData = transactions.map(t =>
                `${t.date.toISOString().split('T')[0]},${t.type},${t.amount},"${t.description}","${t.category}","${t.paymentMethod || ''}","${t.notes || ''}"`
            ).join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
            return res.send(csvHeader + csvData);
        }

        sendSuccess(res, transactions, 'Transactions exported successfully');
    })
);

module.exports = router;