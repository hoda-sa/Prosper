const express = require('express');
const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Category = require('../models/Category');
const { asyncHandler, sendSuccess, AppError } = require('../middleware/errorHandler');

const router = express.Router();

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

// GET /api/users/profile - Get user profile
router.get('/profile',
    asyncHandler(async (req, res) => {
        const userId = req.user.id;

        let user = await User.findByAuth0Id(userId);

        // Create user if doesn't exist (first time login)
        if (!user) {
            user = await User.createFromAuth0Profile(req.user);

            // Initialize default categories for new user
            try {
                await Category.initializeUserCategories(userId);
            } catch (error) {
                console.log('Warning: Could not initialize categories for new user:', error.message);
            }
        } else {
            // Update login stats
            await user.recordLogin();
        }

        // Get user's financial summary
        const financialSummary = await getUserFinancialSummary(userId);

        sendSuccess(res, {
            user,
            financialSummary
        }, 'User profile retrieved successfully');
    })
);

// PUT /api/users/profile - Update user profile
router.put('/profile',
    body('name')
        .optional()
        .isLength({ min: 1, max: 100 })
        .trim()
        .withMessage('Name must be between 1 and 100 characters'),

    body('nickname')
        .optional()
        .isLength({ max: 50 })
        .trim()
        .withMessage('Nickname cannot exceed 50 characters'),

    body('preferences.currency')
        .optional()
        .isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'CHF'])
        .withMessage('Invalid currency'),

    body('preferences.dateFormat')
        .optional()
        .isIn(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'])
        .withMessage('Invalid date format'),

    body('preferences.language')
        .optional()
        .isIn(['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh'])
        .withMessage('Invalid language'),

    body('financialProfile.monthlyIncome')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Monthly income must be non-negative'),

    body('financialProfile.employmentStatus')
        .optional()
        .isIn(['employed', 'self-employed', 'unemployed', 'student', 'retired', 'other'])
        .withMessage('Invalid employment status'),

    body('financialProfile.riskTolerance')
        .optional()
        .isIn(['conservative', 'moderate', 'aggressive'])
        .withMessage('Invalid risk tolerance'),

    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;

        const user = await User.findByAuth0Id(userId);
        if (!user) {
            throw new AppError('User not found', 404, 'USER_NOT_FOUND');
        }

        // Update user data
        const updateData = { ...req.body };

        // Handle nested updates for preferences and financial profile
        if (req.body.preferences) {
            updateData.preferences = { ...user.preferences, ...req.body.preferences };
        }

        if (req.body.financialProfile) {
            updateData.financialProfile = { ...user.financialProfile, ...req.body.financialProfile };
        }

        Object.assign(user, updateData);
        await user.save();

        sendSuccess(res, user, 'Profile updated successfully');
    })
);

// GET /api/users/dashboard - Get dashboard data
router.get('/dashboard',
    query('period')
        .optional()
        .isIn(['week', 'month', 'quarter', 'year'])
        .withMessage('Period must be week, month, quarter, or year'),

    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const period = req.query.period || 'month';

        // Calculate date range
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

        // Get dashboard data in parallel
        const [
            recentTransactions,
            transactionSummary,
            budgetSummary,
            categoryBreakdown,
            monthlyTrends
        ] = await Promise.all([
            getRecentTransactions(userId, 10),
            getTransactionSummary(userId, startDate, endDate),
            getBudgetSummary(userId),
            getCategoryBreakdown(userId, startDate, endDate),
            getMonthlyTrends(userId, 6)
        ]);

        // Get user for financial goals
        const user = await User.findByAuth0Id(userId);
        const financialGoals = user?.financialProfile?.financialGoals || [];

        sendSuccess(res, {
            period,
            dateRange: { startDate, endDate },
            recentTransactions,
            summary: transactionSummary,
            budgets: budgetSummary,
            categoryBreakdown,
            monthlyTrends,
            financialGoals: financialGoals.map(goal => ({
                ...goal.toObject(),
                progressPercentage: goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0
            })),
            insights: generateFinancialInsights(transactionSummary, budgetSummary, categoryBreakdown)
        }, 'Dashboard data retrieved successfully');
    })
);

// POST /api/users/financial-goals - Add financial goal
router.post('/financial-goals',
    body('name')
        .isLength({ min: 1, max: 100 })
        .trim()
        .withMessage('Goal name is required and must be less than 100 characters'),

    body('targetAmount')
        .isFloat({ min: 1 })
        .withMessage('Target amount must be greater than 0'),

    body('currentAmount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Current amount must be non-negative'),

    body('targetDate')
        .optional()
        .isISO8601()
        .withMessage('Target date must be a valid date'),

    body('priority')
        .optional()
        .isIn(['low', 'medium', 'high'])
        .withMessage('Priority must be low, medium, or high'),

    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;

        const user = await User.findByAuth0Id(userId);
        if (!user) {
            throw new AppError('User not found', 404, 'USER_NOT_FOUND');
        }

        const goalData = {
            name: req.body.name,
            targetAmount: req.body.targetAmount,
            currentAmount: req.body.currentAmount || 0,
            targetDate: req.body.targetDate ? new Date(req.body.targetDate) : null,
            priority: req.body.priority || 'medium'
        };

        user.financialProfile.financialGoals.push(goalData);
        await user.save();

        const newGoal = user.financialProfile.financialGoals[user.financialProfile.financialGoals.length - 1];

        sendSuccess(res, newGoal, 'Financial goal created successfully', 201);
    })
);

// PUT /api/users/financial-goals/:goalId - Update financial goal
router.put('/financial-goals/:goalId',
    body('currentAmount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Current amount must be non-negative'),

    body('targetAmount')
        .optional()
        .isFloat({ min: 1 })
        .withMessage('Target amount must be greater than 0'),

    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const goalId = req.params.goalId;

        const user = await User.findByAuth0Id(userId);
        if (!user) {
            throw new AppError('User not found', 404, 'USER_NOT_FOUND');
        }

        const goal = user.financialProfile.financialGoals.id(goalId);
        if (!goal) {
            throw new AppError('Financial goal not found', 404, 'GOAL_NOT_FOUND');
        }

        // Update goal
        Object.assign(goal, req.body);
        await user.save();

        sendSuccess(res, goal, 'Financial goal updated successfully');
    })
);

// DELETE /api/users/financial-goals/:goalId - Delete financial goal
router.delete('/financial-goals/:goalId',
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const goalId = req.params.goalId;

        const user = await User.findByAuth0Id(userId);
        if (!user) {
            throw new AppError('User not found', 404, 'USER_NOT_FOUND');
        }

        const goal = user.financialProfile.financialGoals.id(goalId);
        if (!goal) {
            throw new AppError('Financial goal not found', 404, 'GOAL_NOT_FOUND');
        }

        user.financialProfile.financialGoals.pull(goalId);
        await user.save();

        sendSuccess(res, null, 'Financial goal deleted successfully');
    })
);

// GET /api/users/settings - Get user settings
router.get('/settings',
    asyncHandler(async (req, res) => {
        const userId = req.user.id;

        const user = await User.findByAuth0Id(userId);
        if (!user) {
            throw new AppError('User not found', 404, 'USER_NOT_FOUND');
        }

        sendSuccess(res, {
            preferences: user.preferences,
            notifications: user.preferences.notifications,
            privacy: user.preferences.privacy,
            subscription: user.subscription
        }, 'User settings retrieved successfully');
    })
);

// PUT /api/users/settings - Update user settings
router.put('/settings',
    body('preferences.notifications.email.budgetAlerts')
        .optional()
        .isBoolean()
        .withMessage('Budget alerts setting must be boolean'),

    body('preferences.notifications.email.goalReminders')
        .optional()
        .isBoolean()
        .withMessage('Goal reminders setting must be boolean'),

    body('preferences.privacy.shareData')
        .optional()
        .isBoolean()
        .withMessage('Share data setting must be boolean'),

    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;

        const user = await User.findByAuth0Id(userId);
        if (!user) {
            throw new AppError('User not found', 404, 'USER_NOT_FOUND');
        }

        // Deep merge settings
        if (req.body.preferences) {
            user.preferences = mergeDeep(user.preferences, req.body.preferences);
        }

        await user.save();

        sendSuccess(res, {
            preferences: user.preferences,
            notifications: user.preferences.notifications,
            privacy: user.preferences.privacy
        }, 'Settings updated successfully');
    })
);

// GET /api/users/stats - Get user statistics
router.get('/stats',
    asyncHandler(async (req, res) => {
        const userId = req.user.id;

        const user = await User.findByAuth0Id(userId);
        if (!user) {
            throw new AppError('User not found', 404, 'USER_NOT_FOUND');
        }

        // Get additional stats
        const [transactionCount, budgetCount, categoryCount] = await Promise.all([
            Transaction.countDocuments({ userId, status: 'completed' }),
            Budget.countDocuments({ userId }),
            Category.countDocuments({ userId })
        ]);

        // Update user stats if they're different
        if (user.stats.totalTransactions !== transactionCount) {
            user.stats.totalTransactions = transactionCount;
            user.stats.totalBudgets = budgetCount;
            await user.save();
        }

        sendSuccess(res, {
            accountAge: user.accountAge,
            totalTransactions: transactionCount,
            totalBudgets: budgetCount,
            totalCategories: categoryCount,
            lastActiveDate: user.stats.lastActiveDate,
            loginCount: user.stats.loginCount,
            subscription: user.subscription
        }, 'User statistics retrieved successfully');
    })
);

// POST /api/users/export-data - Export user data
router.post('/export-data',
    body('format')
        .optional()
        .isIn(['json', 'csv'])
        .withMessage('Format must be json or csv'),

    body('includeTransactions')
        .optional()
        .isBoolean()
        .withMessage('Include transactions must be boolean'),

    body('includeBudgets')
        .optional()
        .isBoolean()
        .withMessage('Include budgets must be boolean'),

    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { format = 'json', includeTransactions = true, includeBudgets = true } = req.body;

        const user = await User.findByAuth0Id(userId);
        if (!user) {
            throw new AppError('User not found', 404, 'USER_NOT_FOUND');
        }

        const exportData = {
            user: user.toJSON(),
            exportedAt: new Date().toISOString()
        };

        if (includeTransactions) {
            exportData.transactions = await Transaction.find({ userId }).lean();
        }

        if (includeBudgets) {
            exportData.budgets = await Budget.find({ userId }).lean();
        }

        // Update export stats
        user.stats.dataExports += 1;
        await user.save();

        if (format === 'csv') {
            // For CSV, we'll create a simplified export
            const csvData = generateCSVExport(exportData);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=user-data-export.csv');
            return res.send(csvData);
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=user-data-export.json');
        sendSuccess(res, exportData, 'Data exported successfully');
    })
);

// Helper functions
async function getUserFinancialSummary(userId) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
        totalTransactions,
        recentTransactions,
        activeBudgets,
        monthlySpending
    ] = await Promise.all([
        Transaction.countDocuments({ userId, status: 'completed' }),
        Transaction.countDocuments({
            userId,
            status: 'completed',
            date: { $gte: thirtyDaysAgo }
        }),
        Budget.countDocuments({ userId, status: 'active' }),
        Transaction.aggregate([
            {
                $match: {
                    userId,
                    status: 'completed',
                    date: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' }
                }
            }
        ])
    ]);

    const income = monthlySpending.find(s => s._id === 'income')?.total || 0;
    const expenses = monthlySpending.find(s => s._id === 'expense')?.total || 0;

    return {
        totalTransactions,
        recentTransactions,
        activeBudgets,
        monthlyIncome: income,
        monthlyExpenses: expenses,
        monthlySavings: income - expenses
    };
}

async function getRecentTransactions(userId, limit = 10) {
    return Transaction.find({
        userId,
        status: 'completed'
    })
        .sort({ date: -1 })
        .limit(limit)
        .lean();
}

async function getTransactionSummary(userId, startDate, endDate) {
    const summary = await Transaction.aggregate([
        {
            $match: {
                userId,
                status: 'completed',
                date: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$type',
                total: { $sum: '$amount' },
                count: { $sum: 1 },
                avgAmount: { $avg: '$amount' }
            }
        }
    ]);

    const income = summary.find(s => s._id === 'income') || { total: 0, count: 0, avgAmount: 0 };
    const expenses = summary.find(s => s._id === 'expense') || { total: 0, count: 0, avgAmount: 0 };

    return {
        income: income.total,
        expenses: expenses.total,
        netIncome: income.total - expenses.total,
        totalTransactions: income.count + expenses.count,
        avgIncomeTransaction: income.avgAmount,
        avgExpenseTransaction: expenses.avgAmount
    };
}

async function getBudgetSummary(userId) {
    const budgets = await Budget.find({
        userId,
        status: { $in: ['active', 'exceeded'] }
    }).lean();

    const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.currentPeriod.spent, 0);
    const exceededBudgets = budgets.filter(b => b.currentPeriod.spent > b.amount).length;

    return {
        activeBudgets: budgets.length,
        totalBudget,
        totalSpent,
        totalRemaining: totalBudget - totalSpent,
        overallUtilization: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
        exceededBudgets
    };
}

async function getCategoryBreakdown(userId, startDate, endDate) {
    return Transaction.getCategoryBreakdown(userId, startDate, endDate);
}

async function getMonthlyTrends(userId, months = 6) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const trends = await Transaction.aggregate([
        {
            $match: {
                userId,
                status: 'completed',
                date: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$date' },
                    month: { $month: '$date' },
                    type: '$type'
                },
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1 }
        }
    ]);

    // Format trends data
    const monthlyData = {};
    trends.forEach(trend => {
        const monthKey = `${trend._id.year}-${String(trend._id.month).padStart(2, '0')}`;
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { month: monthKey, income: 0, expenses: 0, net: 0 };
        }
        monthlyData[monthKey][trend._id.type === 'income' ? 'income' : 'expenses'] = trend.total;
    });

    // Calculate net for each month
    Object.values(monthlyData).forEach(month => {
        month.net = month.income - month.expenses;
    });

    return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
}

function generateFinancialInsights(transactionSummary, budgetSummary, categoryBreakdown) {
    const insights = [];

    // Net income insight
    if (transactionSummary.netIncome > 0) {
        insights.push({
            type: 'positive',
            title: 'Positive Cash Flow',
            message: `You saved ${transactionSummary.netIncome.toFixed(2)} this period!`,
            icon: 'trending-up'
        });
    } else if (transactionSummary.netIncome < 0) {
        insights.push({
            type: 'warning',
            title: 'Negative Cash Flow',
            message: `You spent ${Math.abs(transactionSummary.netIncome).toFixed(2)} more than you earned this period.`,
            icon: 'trending-down'
        });
    }

    // Budget insights
    if (budgetSummary.exceededBudgets > 0) {
        insights.push({
            type: 'warning',
            title: 'Budget Alert',
            message: `${budgetSummary.exceededBudgets} of your budgets are over limit.`,
            icon: 'alert-triangle'
        });
    } else if (budgetSummary.overallUtilization < 70) {
        insights.push({
            type: 'info',
            title: 'Budget Opportunity',
            message: 'You have room in your budgets - consider reallocating or saving more.',
            icon: 'info'
        });
    }

    // Top spending category
    const topExpenseCategory = categoryBreakdown
        .filter(cat => cat._id.type === 'expense')
        .sort((a, b) => b.total - a.total)[0];

    if (topExpenseCategory) {
        insights.push({
            type: 'info',
            title: 'Top Spending Category',
            message: `Your highest expense category is ${topExpenseCategory._id.category} at ${topExpenseCategory.total.toFixed(2)}.`,
            icon: 'pie-chart'
        });
    }

    return insights;
}

function mergeDeep(target, source) {
    const result = { ...target };

    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = mergeDeep(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }

    return result;
}

function generateCSVExport(exportData) {
    let csvContent = '';

    // User info section
    csvContent += 'USER INFORMATION\n';
    csvContent += `Name,${exportData.user.name}\n`;
    csvContent += `Email,${exportData.user.email}\n`;
    csvContent += `Currency,${exportData.user.preferences?.currency || 'USD'}\n`;
    csvContent += `Account Created,${exportData.user.createdAt}\n`;
    csvContent += `Export Date,${exportData.exportedAt}\n\n`;

    // Transactions section
    if (exportData.transactions) {
        csvContent += 'TRANSACTIONS\n';
        csvContent += 'Date,Type,Amount,Description,Category,Payment Method,Notes\n';

        exportData.transactions.forEach(transaction => {
            csvContent += `${transaction.date?.toISOString().split('T')[0]},${transaction.type},${transaction.amount},"${transaction.description}","${transaction.category}","${transaction.paymentMethod || ''}","${transaction.notes || ''}"\n`;
        });

        csvContent += '\n';
    }

    // Budgets section
    if (exportData.budgets) {
        csvContent += 'BUDGETS\n';
        csvContent += 'Name,Amount,Period,Categories,Start Date,End Date,Spent,Status\n';

        exportData.budgets.forEach(budget => {
            csvContent += `"${budget.name}",${budget.amount},${budget.period},"${budget.categories.join('; ')}",${budget.startDate?.toISOString().split('T')[0]},${budget.endDate?.toISOString().split('T')[0]},${budget.currentPeriod?.spent || 0},${budget.status}\n`;
        });
    }

    return csvContent;
}

module.exports = router;