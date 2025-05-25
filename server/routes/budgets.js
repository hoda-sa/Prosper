const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const { asyncHandler, sendSuccess, sendPaginatedResponse, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Validation middleware
const validateBudget = [
    body('name')
        .isLength({ min: 1, max: 100 })
        .trim()
        .withMessage('Budget name is required and must be less than 100 characters'),

    body('amount')
        .isFloat({ min: 0.01 })
        .withMessage('Budget amount must be a positive number greater than 0'),

    body('period')
        .isIn(['weekly', 'monthly', 'quarterly', 'yearly'])
        .withMessage('Period must be weekly, monthly, quarterly, or yearly'),

    body('startDate')
        .isISO8601()
        .withMessage('Start date must be a valid ISO date'),

    body('endDate')
        .isISO8601()
        .withMessage('End date must be a valid ISO date'),

    body('categories')
        .isArray({ min: 1 })
        .withMessage('At least one category is required'),

    body('categories.*')
        .isLength({ min: 1 })
        .trim()
        .withMessage('Category names cannot be empty'),

    body('type')
        .optional()
        .isIn(['expense', 'income', 'savings'])
        .withMessage('Type must be expense, income, or savings'),

    body('alertThresholds.warning.percentage')
        .optional()
        .isInt({ min: 0, max: 100 })
        .withMessage('Warning threshold must be between 0 and 100'),

    body('alertThresholds.critical.percentage')
        .optional()
        .isInt({ min: 0, max: 100 })
        .withMessage('Critical threshold must be between 0 and 100')
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

// GET /api/budgets - Get user's budgets
router.get('/',
    query('status')
        .optional()
        .isIn(['active', 'paused', 'completed', 'exceeded'])
        .withMessage('Invalid status'),

    query('period')
        .optional()
        .isIn(['weekly', 'monthly', 'quarterly', 'yearly'])
        .withMessage('Invalid period'),

    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { status, period, includeHistory = false } = req.query;

        const query = { userId };

        if (status) {
            query.status = status;
        }

        if (period) {
            query.period = period;
        }

        let budgetQuery = Budget.find(query).sort({ createdAt: -1 });

        // Optionally exclude history for better performance
        if (includeHistory !== 'true') {
            budgetQuery = budgetQuery.select('-history');
        }

        const budgets = await budgetQuery.lean();

        // Calculate additional metrics for each budget
        const enrichedBudgets = budgets.map(budget => ({
            ...budget,
            utilizationPercentage: budget.amount > 0 ? Math.round((budget.currentPeriod.spent / budget.amount) * 100) : 0,
            remainingAmount: Math.max(0, budget.amount - budget.currentPeriod.spent + (budget.currentPeriod.rolloverAmount || 0)),
            daysRemaining: Math.max(0, Math.ceil((new Date(budget.endDate) - new Date()) / (1000 * 60 * 60 * 24))),
            healthStatus: getHealthStatus(budget)
        }));

        sendSuccess(res, enrichedBudgets, 'Budgets retrieved successfully');
    })
);

// GET /api/budgets/summary - Get budget summary
router.get('/summary',
    asyncHandler(async (req, res) => {
        const userId = req.user.id;

        const summary = await Budget.getBudgetSummary(userId);

        // Get active budgets that need attention
        const alertBudgets = await Budget.find({
            userId,
            status: { $in: ['active', 'exceeded'] }
        }).lean();

        const budgetsNeedingAttention = alertBudgets
            .map(budget => {
                const utilizationPercentage = budget.amount > 0 ? (budget.currentPeriod.spent / budget.amount) * 100 : 0;
                const alert = getBudgetAlert(budget, utilizationPercentage);
                return alert ? { ...budget, alert } : null;
            })
            .filter(Boolean);

        const summaryData = summary.length > 0 ? summary[0] : {
            totalBudget: 0,
            totalSpent: 0,
            averageUtilization: 0,
            activeBudgets: 0,
            exceededBudgets: 0
        };

        sendSuccess(res, {
            ...summaryData,
            budgetsNeedingAttention,
            totalRemaining: summaryData.totalBudget - summaryData.totalSpent
        }, 'Budget summary retrieved successfully');
    })
);

// GET /api/budgets/:id - Get specific budget
router.get('/:id',
    param('id').isMongoId().withMessage('Invalid budget ID'),
    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const budgetId = req.params.id;

        const budget = await Budget.findOne({
            _id: budgetId,
            userId
        });

        if (!budget) {
            throw new AppError('Budget not found', 404, 'BUDGET_NOT_FOUND');
        }

        // Get related transactions
        const transactions = await Transaction.find({
            userId,
            category: { $in: budget.categories },
            date: {
                $gte: budget.startDate,
                $lte: budget.endDate
            },
            type: budget.type === 'savings' ? 'income' : budget.type,
            status: 'completed'
        })
            .sort({ date: -1 })
            .limit(50)
            .lean();

        // Calculate daily spending trend
        const dailySpending = calculateDailySpending(transactions, budget.startDate, budget.endDate);

        sendSuccess(res, {
            budget,
            transactions,
            dailySpending,
            utilizationPercentage: budget.utilizationPercentage,
            remainingAmount: budget.remainingAmount,
            healthStatus: budget.healthStatus
        }, 'Budget retrieved successfully');
    })
);

// POST /api/budgets - Create new budget
router.post('/',
    validateBudget,
    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;

        // Check if user can create more budgets (based on subscription)
        // This would be implemented based on your subscription logic

        const budgetData = {
            ...req.body,
            userId
        };

        // Validate date range
        const startDate = new Date(budgetData.startDate);
        const endDate = new Date(budgetData.endDate);

        if (endDate <= startDate) {
            throw new AppError('End date must be after start date', 400, 'INVALID_DATE_RANGE');
        }

        // Check for overlapping budgets with same categories
        const overlappingBudget = await Budget.findOne({
            userId,
            categories: { $in: budgetData.categories },
            $or: [
                {
                    startDate: { $lte: endDate },
                    endDate: { $gte: startDate }
                }
            ],
            status: { $in: ['active', 'paused'] }
        });

        if (overlappingBudget) {
            throw new AppError(
                'A budget for these categories already exists in the specified time period',
                409,
                'OVERLAPPING_BUDGET'
            );
        }

        const budget = new Budget(budgetData);
        await budget.save();

        // Calculate current period spending if budget starts in the past
        if (startDate <= new Date()) {
            await recalculateBudgetSpending(budget);
        }

        sendSuccess(res, budget, 'Budget created successfully', 201);
    })
);

// PUT /api/budgets/:id - Update budget
router.put('/:id',
    param('id').isMongoId().withMessage('Invalid budget ID'),
    validateBudget,
    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const budgetId = req.params.id;

        const budget = await Budget.findOne({
            _id: budgetId,
            userId
        });

        if (!budget) {
            throw new AppError('Budget not found', 404, 'BUDGET_NOT_FOUND');
        }

        // Store old values for comparison
        const oldAmount = budget.amount;
        const oldCategories = [...budget.categories];

        // Update budget
        Object.assign(budget, req.body);
        await budget.save();

        // Recalculate spending if categories or amount changed
        if (JSON.stringify(oldCategories) !== JSON.stringify(budget.categories) || oldAmount !== budget.amount) {
            await recalculateBudgetSpending(budget);
        }

        sendSuccess(res, budget, 'Budget updated successfully');
    })
);

// DELETE /api/budgets/:id - Delete budget
router.delete('/:id',
    param('id').isMongoId().withMessage('Invalid budget ID'),
    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const budgetId = req.params.id;

        const budget = await Budget.findOne({
            _id: budgetId,
            userId
        });

        if (!budget) {
            throw new AppError('Budget not found', 404, 'BUDGET_NOT_FOUND');
        }

        await Budget.findByIdAndDelete(budgetId);

        sendSuccess(res, null, 'Budget deleted successfully');
    })
);

// POST /api/budgets/:id/renew - Renew budget for next period
router.post('/:id/renew',
    param('id').isMongoId().withMessage('Invalid budget ID'),
    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const budgetId = req.params.id;

        const budget = await Budget.findOne({
            _id: budgetId,
            userId
        });

        if (!budget) {
            throw new AppError('Budget not found', 404, 'BUDGET_NOT_FOUND');
        }

        if (budget.status !== 'completed') {
            throw new AppError('Only completed budgets can be renewed', 400, 'BUDGET_NOT_COMPLETED');
        }

        const renewedBudget = await budget.renewForNextPeriod();

        if (!renewedBudget) {
            throw new AppError('Budget auto-renewal is not enabled', 400, 'AUTO_RENEWAL_DISABLED');
        }

        sendSuccess(res, renewedBudget, 'Budget renewed successfully');
    })
);

// GET /api/budgets/:id/performance - Get budget performance analytics
router.get('/:id/performance',
    param('id').isMongoId().withMessage('Invalid budget ID'),
    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const budgetId = req.params.id;

        const budget = await Budget.findOne({
            _id: budgetId,
            userId
        });

        if (!budget) {
            throw new AppError('Budget not found', 404, 'BUDGET_NOT_FOUND');
        }

        // Get historical performance from budget history
        const performance = budget.history.map(period => ({
            period: period.period,
            budgetAmount: period.budgetAmount,
            actualSpent: period.actualSpent,
            variance: period.variance,
            variancePercentage: period.variancePercentage,
            utilizationPercentage: (period.actualSpent / period.budgetAmount) * 100
        }));

        // Calculate trends
        const trend = calculateBudgetTrend(performance);

        // Get spending pattern by day of week/month
        const transactions = await Transaction.find({
            userId,
            category: { $in: budget.categories },
            date: {
                $gte: budget.startDate,
                $lte: budget.endDate
            },
            type: budget.type === 'savings' ? 'income' : budget.type,
            status: 'completed'
        });

        const spendingPattern = analyzeSpendingPattern(transactions);

        sendSuccess(res, {
            performance,
            trend,
            spendingPattern,
            currentPeriod: {
                utilizationPercentage: budget.utilizationPercentage,
                projectedEndAmount: budget.projectedEndAmount,
                daysRemaining: budget.daysRemaining
            }
        }, 'Budget performance retrieved successfully');
    })
);

// Helper functions
function getHealthStatus(budget) {
    const utilization = budget.amount > 0 ? (budget.currentPeriod.spent / budget.amount) * 100 : 0;

    if (utilization >= (budget.alertThresholds?.critical?.percentage || 90)) return 'critical';
    if (utilization >= (budget.alertThresholds?.warning?.percentage || 75)) return 'warning';
    if (utilization < 50) return 'good';
    return 'ok';
}

function getBudgetAlert(budget, utilizationPercentage) {
    if (budget.alertThresholds?.critical?.enabled && utilizationPercentage >= budget.alertThresholds.critical.percentage) {
        return { level: 'critical', message: `Budget exceeded ${budget.alertThresholds.critical.percentage}%` };
    }

    if (budget.alertThresholds?.warning?.enabled && utilizationPercentage >= budget.alertThresholds.warning.percentage) {
        return { level: 'warning', message: `Budget reached ${budget.alertThresholds.warning.percentage}%` };
    }

    return null;
}

function calculateDailySpending(transactions, startDate, endDate) {
    const dailyMap = new Map();
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Initialize all days with 0
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        dailyMap.set(dateKey, 0);
    }

    // Add transaction amounts to corresponding days
    transactions.forEach(transaction => {
        const dateKey = new Date(transaction.date).toISOString().split('T')[0];
        if (dailyMap.has(dateKey)) {
            dailyMap.set(dateKey, dailyMap.get(dateKey) + transaction.amount);
        }
    });

    return Array.from(dailyMap.entries()).map(([date, amount]) => ({ date, amount }));
}

function calculateBudgetTrend(performance) {
    if (performance.length < 2) return { direction: 'stable', change: 0 };

    const recent = performance.slice(-3); // Last 3 periods
    const utilizationTrend = recent.map(p => p.utilizationPercentage);

    const avgChange = utilizationTrend.reduce((sum, util, index) => {
        if (index === 0) return 0;
        return sum + (util - utilizationTrend[index - 1]);
    }, 0) / (utilizationTrend.length - 1);

    return {
        direction: avgChange > 5 ? 'up' : avgChange < -5 ? 'down' : 'stable',
        change: Math.round(avgChange)
    };
}

function analyzeSpendingPattern(transactions) {
    const dayOfWeekSpending = Array(7).fill(0);
    const dayOfMonthSpending = Array(31).fill(0);

    transactions.forEach(transaction => {
        const date = new Date(transaction.date);
        dayOfWeekSpending[date.getDay()] += transaction.amount;
        dayOfMonthSpending[date.getDate() - 1] += transaction.amount;
    });

    return {
        byDayOfWeek: dayOfWeekSpending.map((amount, index) => ({
            day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index],
            amount
        })),
        byDayOfMonth: dayOfMonthSpending.map((amount, index) => ({
            day: index + 1,
            amount
        }))
    };
}

async function recalculateBudgetSpending(budget) {
    const transactions = await Transaction.find({
        userId: budget.userId,
        category: { $in: budget.categories },
        date: {
            $gte: budget.startDate,
            $lte: budget.endDate
        },
        type: budget.type === 'savings' ? 'income' : budget.type,
        status: 'completed'
    });

    budget.currentPeriod.spent = transactions.reduce((sum, t) => sum + t.amount, 0);
    budget.currentPeriod.transactionCount = transactions.length;
    budget.currentPeriod.lastTransactionDate = transactions.length > 0
        ? new Date(Math.max(...transactions.map(t => new Date(t.date))))
        : null;

    await budget.save();
}

module.exports = router;