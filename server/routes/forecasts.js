const express = require('express');
const { query, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const User = require('../models/User');
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

// GET /api/forecasts/income-expense - Predict future income and expenses
router.get('/income-expense',
  query('months')
    .optional()
    .isInt({ min: 1, max: 24 })
    .withMessage('Months must be between 1 and 24'),
  
  query('method')
    .optional()
    .isIn(['simple', 'weighted', 'seasonal'])
    .withMessage('Method must be simple, weighted, or seasonal'),
  
  checkValidation,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const months = parseInt(req.query.months) || 6;
    const method = req.query.method || 'simple';

    // Get historical transaction data (last 12 months)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const transactions = await Transaction.find({
      userId,
      date: { $gte: oneYearAgo },
      status: 'completed'
    }).sort({ date: 1 });

    if (transactions.length < 10) {
      throw new AppError('Insufficient transaction history for forecasting', 400, 'INSUFFICIENT_DATA');
    }

    // Group transactions by month and type
    const monthlyData = groupTransactionsByMonth(transactions);
    
    // Generate forecasts based on method
    let forecast;
    switch (method) {
      case 'weighted':
        forecast = generateWeightedMovingAverageForecast(monthlyData, months);
        break;
      case 'seasonal':
        forecast = generateSeasonalForecast(monthlyData, months);
        break;
      default:
        forecast = generateSimpleMovingAverageForecast(monthlyData, months);
    }

    // Calculate confidence intervals
    const confidenceIntervals = calculateConfidenceIntervals(monthlyData, forecast);

    sendSuccess(res, {
      forecast,
      confidenceIntervals,
      method,
      historicalData: monthlyData,
      assumptions: {
        basedOnMonths: Math.min(12, monthlyData.length),
        projectionMonths: months,
        dataQuality: assessDataQuality(monthlyData)
      }
    }, 'Income/expense forecast generated successfully');
  })
);

// GET /api/forecasts/savings-goals - Calculate time to reach savings goals
router.get('/savings-goals',
  query('goalAmount')
    .isFloat({ min: 1 })
    .withMessage('Goal amount must be a positive number'),
  
  query('currentAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Current amount must be non-negative'),
  
  query('monthlyContribution')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Monthly contribution must be non-negative'),
  
  query('interestRate')
    .optional()
    .isFloat({ min: 0, max: 50 })
    .withMessage('Interest rate must be between 0 and 50 percent'),
  
  checkValidation,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const goalAmount = parseFloat(req.query.goalAmount);
    const currentAmount = parseFloat(req.query.currentAmount) || 0;
    const interestRate = parseFloat(req.query.interestRate) || 0;

    // Get user's historical savings rate if monthly contribution not provided
    let monthlyContribution = parseFloat(req.query.monthlyContribution);
    
    if (!monthlyContribution) {
      const savingsRate = await calculateHistoricalSavingsRate(userId);
      monthlyContribution = savingsRate.averageMonthlySavings;
      
      if (monthlyContribution <= 0) {
        throw new AppError('Cannot calculate savings goal without positive monthly contribution', 400, 'NO_SAVINGS_RATE');
      }
    }

    // Calculate different scenarios
    const scenarios = generateSavingsScenarios(
      goalAmount,
      currentAmount,
      monthlyContribution,
      interestRate
    );

    // Calculate compound growth projections
    const monthlyInterestRate = (interestRate / 100) / 12;
    const projections = [];
    let balance = currentAmount;

    for (let month = 1; month <= Math.min(scenarios.timeToGoal?.months || 120, 120); month++) {
      balance = balance * (1 + monthlyInterestRate) + monthlyContribution;
      
      if (month % 3 === 0 || month <= 12) { // Quarterly for first year, then yearly
        projections.push({
          month,
          balance: Math.round(balance * 100) / 100,
          totalContributions: currentAmount + (monthlyContribution * month),
          interestEarned: Math.round((balance - currentAmount - (monthlyContribution * month)) * 100) / 100
        });
      }
      
      if (balance >= goalAmount && !scenarios.timeToGoal) {
        scenarios.timeToGoal = {
          months: month,
          years: Math.round((month / 12) * 10) / 10
        };
        break;
      }
    }

    sendSuccess(res, {
      goal: {
        targetAmount: goalAmount,
        currentAmount,
        remaining: goalAmount - currentAmount
      },
      scenarios,
      projections,
      recommendations: generateSavingsRecommendations(scenarios, monthlyContribution, interestRate)
    }, 'Savings goal forecast generated successfully');
  })
);

// GET /api/forecasts/budget-projection - Project budget performance
router.get('/budget-projection',
  query('budgetId')
    .optional()
    .isMongoId()
    .withMessage('Invalid budget ID'),
    
  checkValidation,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const budgetId = req.query.budgetId;

    let budgets;
    if (budgetId) {
      const budget = await Budget.findOne({ _id: budgetId, userId });
      if (!budget) {
        throw new AppError('Budget not found', 404, 'BUDGET_NOT_FOUND');
      }
      budgets = [budget];
    } else {
      budgets = await Budget.find({ userId, status: 'active' });
    }

    const projections = await Promise.all(
      budgets.map(async (budget) => {
        const projection = await projectBudgetPerformance(budget);
        return {
          budgetId: budget._id,
          budgetName: budget.name,
          ...projection
        };
      })
    );

    // Generate overall budget health score
    const overallHealth = calculateOverallBudgetHealth(projections);

    sendSuccess(res, {
      projections,
      overallHealth,
      recommendations: generateBudgetRecommendations(projections)
    }, 'Budget projections generated successfully');
  })
);

// GET /api/forecasts/cash-flow - Predict cash flow
router.get('/cash-flow',
  query('months')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Months must be between 1 and 12'),
    
  checkValidation,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const months = parseInt(req.query.months) || 3;

    // Get historical data
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const transactions = await Transaction.find({
      userId,
      date: { $gte: sixMonthsAgo },
      status: 'completed'
    }).sort({ date: 1 });

    // Get recurring transactions/budgets
    const recurringTransactions = await Transaction.find({
      userId,
      'recurring.isRecurring': true,
      'recurring.nextDueDate': { $gte: new Date() }
    });

    const activeBudgets = await Budget.find({
      userId,
      status: 'active',
      endDate: { $gte: new Date() }
    });

    // Generate cash flow projection
    const cashFlowProjection = generateCashFlowForecast(
      transactions,
      recurringTransactions,
      activeBudgets,
      months
    );

    sendSuccess(res, {
      projection: cashFlowProjection,
      summary: {
        averageMonthlyIncome: cashFlowProjection.reduce((sum, month) => sum + month.income, 0) / months,
        averageMonthlyExpenses: cashFlowProjection.reduce((sum, month) => sum + month.expenses, 0) / months,
        averageNetFlow: cashFlowProjection.reduce((sum, month) => sum + month.netFlow, 0) / months
      },
      risks: identifyCashFlowRisks(cashFlowProjection)
    }, 'Cash flow forecast generated successfully');
  })
);

// Helper functions
function groupTransactionsByMonth(transactions) {
  const monthlyData = {};
  
  transactions.forEach(transaction => {
    const monthKey = transaction.date.toISOString().substring(0, 7); // YYYY-MM
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, expenses: 0, net: 0 };
    }
    
    if (transaction.type === 'income') {
      monthlyData[monthKey].income += transaction.amount;
    } else {
      monthlyData[monthKey].expenses += transaction.amount;
    }
    
    monthlyData[monthKey].net = monthlyData[monthKey].income - monthlyData[monthKey].expenses;
  });
  
  return Object.entries(monthlyData)
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function generateSimpleMovingAverageForecast(monthlyData, months) {
  const recentMonths = monthlyData.slice(-6); // Use last 6 months
  
  const avgIncome = recentMonths.reduce((sum, month) => sum + month.income, 0) / recentMonths.length;
  const avgExpenses = recentMonths.reduce((sum, month) => sum + month.expenses, 0) / recentMonths.length;
  
  const forecast = [];
  const startDate = new Date();
  
  for (let i = 1; i <= months; i++) {
    const forecastDate = new Date(startDate);
    forecastDate.setMonth(forecastDate.getMonth() + i);
    
    forecast.push({
      month: forecastDate.toISOString().substring(0, 7),
      income: Math.round(weightedIncome * 100) / 100,
      expenses: Math.round(weightedExpenses * 100) / 100,
      net: Math.round((weightedIncome - weightedExpenses) * 100) / 100
    });
  }
  
  return forecast;
}

function generateSeasonalForecast(monthlyData, months) {
  // Calculate seasonal patterns
  const seasonalFactors = calculateSeasonalFactors(monthlyData);
  const baselineIncome = monthlyData.reduce((sum, month) => sum + month.income, 0) / monthlyData.length;
  const baselineExpenses = monthlyData.reduce((sum, month) => sum + month.expenses, 0) / monthlyData.length;
  
  const forecast = [];
  const startDate = new Date();
  
  for (let i = 1; i <= months; i++) {
    const forecastDate = new Date(startDate);
    forecastDate.setMonth(forecastDate.getMonth() + i);
    const monthIndex = forecastDate.getMonth();
    
    const seasonalIncome = baselineIncome * (seasonalFactors.income[monthIndex] || 1);
    const seasonalExpenses = baselineExpenses * (seasonalFactors.expenses[monthIndex] || 1);
    
    forecast.push({
      month: forecastDate.toISOString().substring(0, 7),
      income: Math.round(seasonalIncome * 100) / 100,
      expenses: Math.round(seasonalExpenses * 100) / 100,
      net: Math.round((seasonalIncome - seasonalExpenses) * 100) / 100,
      seasonalFactor: {
        income: seasonalFactors.income[monthIndex],
        expenses: seasonalFactors.expenses[monthIndex]
      }
    });
  }
  
  return forecast;
}

function calculateSeasonalFactors(monthlyData) {
  const monthlyAverages = { income: Array(12).fill(0), expenses: Array(12).fill(0) };
  const monthlyCounts = Array(12).fill(0);
  
  monthlyData.forEach(data => {
    const monthIndex = new Date(data.month + '-01').getMonth();
    monthlyAverages.income[monthIndex] += data.income;
    monthlyAverages.expenses[monthIndex] += data.expenses;
    monthlyCounts[monthIndex]++;
  });
  
  // Calculate averages
  for (let i = 0; i < 12; i++) {
    if (monthlyCounts[i] > 0) {
      monthlyAverages.income[i] /= monthlyCounts[i];
      monthlyAverages.expenses[i] /= monthlyCounts[i];
    }
  }
  
  // Calculate overall averages
  const overallIncome = monthlyAverages.income.reduce((sum, val) => sum + val, 0) / 12;
  const overallExpenses = monthlyAverages.expenses.reduce((sum, val) => sum + val, 0) / 12;
  
  // Calculate seasonal factors (ratio to overall average)
  const seasonalFactors = {
    income: monthlyAverages.income.map(val => overallIncome > 0 ? val / overallIncome : 1),
    expenses: monthlyAverages.expenses.map(val => overallExpenses > 0 ? val / overallExpenses : 1)
  };
  
  return seasonalFactors;
}

function calculateConfidenceIntervals(monthlyData, forecast) {
  // Calculate standard deviation of historical data
  const incomeVariances = monthlyData.map(m => m.income);
  const expenseVariances = monthlyData.map(m => m.expenses);
  
  const incomeStdDev = calculateStandardDeviation(incomeVariances);
  const expenseStdDev = calculateStandardDeviation(expenseVariances);
  
  return forecast.map(period => ({
    month: period.month,
    income: {
      forecast: period.income,
      lower: Math.max(0, period.income - (1.96 * incomeStdDev)), // 95% confidence
      upper: period.income + (1.96 * incomeStdDev)
    },
    expenses: {
      forecast: period.expenses,
      lower: Math.max(0, period.expenses - (1.96 * expenseStdDev)),
      upper: period.expenses + (1.96 * expenseStdDev)
    }
  }));
}

function calculateStandardDeviation(values) {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

function assessDataQuality(monthlyData) {
  const totalMonths = monthlyData.length;
  const monthsWithTransactions = monthlyData.filter(m => m.income > 0 || m.expenses > 0).length;
  const completeness = monthsWithTransactions / totalMonths;
  
  if (completeness >= 0.9 && totalMonths >= 6) return 'high';
  if (completeness >= 0.7 && totalMonths >= 3) return 'medium';
  return 'low';
}

async function calculateHistoricalSavingsRate(userId) {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  const transactions = await Transaction.find({
    userId,
    date: { $gte: threeMonthsAgo },
    status: 'completed'
  });
  
  const monthlyData = groupTransactionsByMonth(transactions);
  const averageMonthlySavings = monthlyData.reduce((sum, month) => sum + month.net, 0) / monthlyData.length;
  
  return {
    averageMonthlySavings: Math.max(0, averageMonthlySavings),
    dataMonths: monthlyData.length,
    consistency: calculateSavingsConsistency(monthlyData)
  };
}

function calculateSavingsConsistency(monthlyData) {
  const savingsRates = monthlyData.map(m => m.net);
  const stdDev = calculateStandardDeviation(savingsRates);
  const mean = savingsRates.reduce((sum, val) => sum + val, 0) / savingsRates.length;
  
  const coefficientOfVariation = mean !== 0 ? Math.abs(stdDev / mean) : 1;
  
  if (coefficientOfVariation < 0.2) return 'high';
  if (coefficientOfVariation < 0.5) return 'medium';
  return 'low';
}

function generateSavingsScenarios(goalAmount, currentAmount, monthlyContribution, interestRate) {
  const remaining = goalAmount - currentAmount;
  
  if (remaining <= 0) {
    return { message: 'Goal already achieved!', timeToGoal: { months: 0, years: 0 } };
  }
  
  const monthlyRate = (interestRate / 100) / 12;
  
  // Calculate time to goal with current contribution
  const timeToGoal = calculateTimeToGoal(remaining, monthlyContribution, monthlyRate);
  
  // Generate alternative scenarios
  const scenarios = {
    current: {
      monthlyContribution,
      timeToGoal,
      totalContributions: monthlyContribution * timeToGoal.months,
      interestEarned: goalAmount - currentAmount - (monthlyContribution * timeToGoal.months)
    },
    accelerated: {},
    reduced: {}
  };
  
  // Accelerated scenario (25% more savings)
  const acceleratedContribution = monthlyContribution * 1.25;
  const acceleratedTime = calculateTimeToGoal(remaining, acceleratedContribution, monthlyRate);
  scenarios.accelerated = {
    monthlyContribution: acceleratedContribution,
    timeToGoal: acceleratedTime,
    monthsSaved: timeToGoal.months - acceleratedTime.months,
    totalContributions: acceleratedContribution * acceleratedTime.months
  };
  
  // Reduced scenario (25% less savings)
  const reducedContribution = monthlyContribution * 0.75;
  const reducedTime = calculateTimeToGoal(remaining, reducedContribution, monthlyRate);
  scenarios.reduced = {
    monthlyContribution: reducedContribution,
    timeToGoal: reducedTime,
    extraMonths: reducedTime.months - timeToGoal.months,
    totalContributions: reducedContribution * reducedTime.months
  };
  
  return scenarios;
}

function calculateTimeToGoal(remaining, monthlyContribution, monthlyRate) {
  if (monthlyContribution <= 0) {
    return { months: Infinity, years: Infinity };
  }
  
  if (monthlyRate === 0) {
    const months = Math.ceil(remaining / monthlyContribution);
    return { months, years: Math.round((months / 12) * 10) / 10 };
  }
  
  // Formula for compound interest with regular payments
  // Using the future value of annuity formula: FV = PMT * (((1 + r)^n - 1) / r)
  // Solving for n: n = ln(1 + (FV * r) / PMT) / ln(1 + r)
  let months;
  
  try {
    const ratio = (remaining * monthlyRate) / monthlyContribution;
    if (ratio <= -1) {
      // Mathematical edge case - contribution too small for the interest rate
      return { months: Infinity, years: Infinity };
    }
    
    months = Math.log(1 + ratio) / Math.log(1 + monthlyRate);
    
    // Handle edge cases
    if (!isFinite(months) || months <= 0) {
      months = Math.ceil(remaining / monthlyContribution);
    }
  } catch (error) {
    // Fallback to simple calculation
    months = Math.ceil(remaining / monthlyContribution);
  }
  
  const roundedMonths = Math.ceil(months);
  
  return {
    months: roundedMonths,
    years: Math.round((roundedMonths / 12) * 10) / 10
  };
}

function generateSavingsRecommendations(scenarios, monthlyContribution, interestRate) {
  const recommendations = [];
  
  if (scenarios.current.timeToGoal.years > 10) {
    recommendations.push({
      type: 'increase_contribution',
      message: 'Consider increasing your monthly contribution to reach your goal sooner',
      impact: `Increasing by 25% would save you ${scenarios.accelerated.monthsSaved} months`
    });
  }
  
  if (interestRate < 2) {
    recommendations.push({
      type: 'better_interest_rate',
      message: 'Look for savings accounts with higher interest rates',
      impact: 'Even 1-2% higher rate can significantly reduce time to goal'
    });
  }
  
  if (scenarios.current.timeToGoal.months <= 12) {
    recommendations.push({
      type: 'goal_achievable',
      message: 'You\'re on track to reach your goal within a year!',
      impact: 'Stay consistent with your current savings rate'
    });
  }
  
  return recommendations;
}

async function projectBudgetPerformance(budget) {
  const now = new Date();
  const budgetStart = new Date(budget.startDate);
  const budgetEnd = new Date(budget.endDate);
  
  // Calculate days passed and remaining
  const totalDays = Math.ceil((budgetEnd - budgetStart) / (1000 * 60 * 60 * 24));
  const daysPassed = Math.ceil((now - budgetStart) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, totalDays - daysPassed);
  
  // Current utilization
  const currentUtilization = (budget.currentPeriod.spent / budget.amount) * 100;
  
  // Calculate daily burn rate
  const dailyBurnRate = daysPassed > 0 ? budget.currentPeriod.spent / daysPassed : 0;
  
  // Project end-of-period spending
  const projectedEndSpending = budget.currentPeriod.spent + (dailyBurnRate * daysRemaining);
  const projectedUtilization = (projectedEndSpending / budget.amount) * 100;
  
  // Determine status
  let projectedStatus;
  if (projectedUtilization > 100) {
    projectedStatus = 'over_budget';
  } else if (projectedUtilization > 90) {
    projectedStatus = 'at_risk';
  } else if (projectedUtilization < 70) {
    projectedStatus = 'under_budget';
  } else {
    projectedStatus = 'on_track';
  }
  
  return {
    current: {
      spent: budget.currentPeriod.spent,
      utilization: currentUtilization,
      dailyBurnRate
    },
    projected: {
      endSpending: projectedEndSpending,
      utilization: projectedUtilization,
      status: projectedStatus,
      variance: budget.amount - projectedEndSpending
    },
    timeline: {
      totalDays,
      daysPassed,
      daysRemaining,
      percentComplete: (daysPassed / totalDays) * 100
    }
  };
}

function calculateOverallBudgetHealth(projections) {
  const totalBudgets = projections.length;
  const overBudget = projections.filter(p => p.projected.status === 'over_budget').length;
  const atRisk = projections.filter(p => p.projected.status === 'at_risk').length;
  const onTrack = projections.filter(p => p.projected.status === 'on_track').length;
  const underBudget = projections.filter(p => p.projected.status === 'under_budget').length;
  
  let overallScore = 100;
  overallScore -= (overBudget * 30); // -30 points per over-budget
  overallScore -= (atRisk * 15); // -15 points per at-risk
  overallScore += (underBudget * 5); // +5 points per under-budget
  
  const healthScore = Math.max(0, Math.min(100, overallScore));
  
  let healthLevel;
  if (healthScore >= 80) healthLevel = 'excellent';
  else if (healthScore >= 60) healthLevel = 'good';
  else if (healthScore >= 40) healthLevel = 'fair';
  else healthLevel = 'poor';
  
  return {
    score: healthScore,
    level: healthLevel,
    breakdown: {
      total: totalBudgets,
      overBudget,
      atRisk,
      onTrack,
      underBudget
    }
  };
}

function generateBudgetRecommendations(projections) {
  const recommendations = [];
  
  projections.forEach(projection => {
    if (projection.projected.status === 'over_budget') {
      recommendations.push({
        budgetId: projection.budgetId,
        budgetName: projection.budgetName,
        type: 'reduce_spending',
        urgency: 'high',
        message: `${projection.budgetName} is projected to exceed budget by ${Math.abs(projection.projected.variance).toFixed(2)}`,
        action: 'Consider reducing spending in this category or adjusting the budget amount'
      });
    } else if (projection.projected.status === 'at_risk') {
      recommendations.push({
        budgetId: projection.budgetId,
        budgetName: projection.budgetName,
        type: 'monitor_spending',
        urgency: 'medium',
        message: `${projection.budgetName} is at risk of exceeding budget`,
        action: 'Monitor spending closely for the remainder of the period'
      });
    } else if (projection.projected.status === 'under_budget') {
      recommendations.push({
        budgetId: projection.budgetId,
        budgetName: projection.budgetName,
        type: 'optimize_budget',
        urgency: 'low',
        message: `${projection.budgetName} has unused budget capacity`,
        action: 'Consider reallocating funds or adjusting future budget amounts'
      });
    }
  });
  
  return recommendations;
}

function generateCashFlowForecast(transactions, recurringTransactions, activeBudgets, months) {
  const monthlyData = groupTransactionsByMonth(transactions);
  const avgMonthlyIncome = monthlyData.reduce((sum, m) => sum + m.income, 0) / monthlyData.length;
  const avgMonthlyExpenses = monthlyData.reduce((sum, m) => sum + m.expenses, 0) / monthlyData.length;
  
  const forecast = [];
  const startDate = new Date();
  
  for (let i = 1; i <= months; i++) {
    const forecastDate = new Date(startDate);
    forecastDate.setMonth(forecastDate.getMonth() + i);
    
    // Base projection on historical averages
    let projectedIncome = avgMonthlyIncome;
    let projectedExpenses = avgMonthlyExpenses;
    
    // Add recurring transactions for this month
    recurringTransactions.forEach(transaction => {
      if (isTransactionDueInMonth(transaction, forecastDate)) {
        if (transaction.type === 'income') {
          projectedIncome += transaction.amount;
        } else {
          projectedExpenses += transaction.amount;
        }
      }
    });
    
    const netFlow = projectedIncome - projectedExpenses;
    
    forecast.push({
      month: forecastDate.toISOString().substring(0, 7),
      income: Math.round(projectedIncome * 100) / 100,
      expenses: Math.round(projectedExpenses * 100) / 100,
      netFlow: Math.round(netFlow * 100) / 100,
      cumulativeFlow: i === 1 ? netFlow : forecast[i-2].cumulativeFlow + netFlow
    });
  }
  
  return forecast;
}

function isTransactionDueInMonth(transaction, targetMonth) {
  const nextDue = new Date(transaction.recurring.nextDueDate);
  return nextDue.getFullYear() === targetMonth.getFullYear() && 
         nextDue.getMonth() === targetMonth.getMonth();
}

function identifyCashFlowRisks(cashFlowProjection) {
  const risks = [];
  
  // Check for negative cash flow months
  const negativeMonths = cashFlowProjection.filter(month => month.netFlow < 0);
  if (negativeMonths.length > 0) {
    risks.push({
      type: 'negative_cash_flow',
      severity: negativeMonths.length > 1 ? 'high' : 'medium',
      message: `Projected negative cash flow in ${negativeMonths.length} month(s)`,
      months: negativeMonths.map(m => m.month)
    });
  }
  
  // Check for declining trend
  const firstHalf = cashFlowProjection.slice(0, Math.floor(cashFlowProjection.length / 2));
  const secondHalf = cashFlowProjection.slice(Math.floor(cashFlowProjection.length / 2));
  
  const firstHalfAvg = firstHalf.reduce((sum, m) => sum + m.netFlow, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, m) => sum + m.netFlow, 0) / secondHalf.length;
  
  if (secondHalfAvg < firstHalfAvg * 0.8) {
    risks.push({
      type: 'declining_trend',
      severity: 'medium',
      message: 'Cash flow shows declining trend over projection period',
      impact: Math.round((firstHalfAvg - secondHalfAvg) * 100) / 100
    });
  }
  
  // Check for low cumulative cash flow
  const finalCumulative = cashFlowProjection[cashFlowProjection.length - 1].cumulativeFlow;
  if (finalCumulative < 0) {
    risks.push({
      type: 'cumulative_deficit',
      severity: 'high',
      message: 'Cumulative cash flow deficit projected',
      deficit: Math.abs(finalCumulative)
    });
  }
  
  return risks;
}

module.exports = router;