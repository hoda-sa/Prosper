import React, { useState, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Link, useHistory } from 'react-router-dom';
import {
    Container,
    Row,
    Col,
    Card,
    CardBody,
    CardTitle,
    CardText,
    Alert,
    Button,
    Progress,
    Input,
    Label,
    FormGroup
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { transactionAPI, budgetAPI } from '../utils/api';
import Loading from './Loading';
import CategoryPieChart from './PieChart';

const Dashboard = () => {
    const { getAccessTokenSilently, isAuthenticated, user, loginWithRedirect } = useAuth0();
    const history = useHistory();
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [categoryData, setCategoryData] = useState({ expenses: [], income: [] });
    const [dateFilter, setDateFilter] = useState('last3months'); // Default to last 3 months



    const handleLogin = () => {
        console.log('🔄 Login button clicked');
        try {
            loginWithRedirect({
                appState: {
                    returnTo: window.location.pathname
                },
                authorizationParams: {
                    redirect_uri: window.location.origin,
                    ...(process.env.REACT_APP_AUTH0_AUDIENCE ? {
                        audience: process.env.REACT_APP_AUTH0_AUDIENCE
                    } : {})
                }
            });
        } catch (error) {
            console.error('❌ Login error:', error);
        }
    };
    // Date filter options
    const dateFilterOptions = [
        { value: 'lastmonth', label: 'Last Month' },
        { value: 'last3months', label: 'Last 3 Months' },
        { value: 'last6months', label: 'Last 6 Months' },
        { value: 'lastyear', label: 'Last Year' }
    ];

    // Get date range based on filter selection
    const getDateRange = useCallback((filter) => {
        const now = new Date();
        let startDate;

        switch (filter) {
            case 'lastmonth':
                // Last month from 1st to last day
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                startDate = lastMonth;
                break;
            case 'last3months':
                // 3 months ago from today
                startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                break;
            case 'last6months':
                // 6 months ago from today
                startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
                break;
            case 'lastyear':
                // 1 year ago from today
                startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                break;
            default:
                // Default to last 3 months
                startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        }

        const dateRange = {
            startDate: startDate.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0]
        };

        console.log('📅 Date range calculated:', {
            filter,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            startDateObj: startDate,
            endDateObj: now
        });

        return dateRange;
    }, []);

    // Filter transactions by date range
    const filterTransactionsByDate = useCallback((transactions, dateRange) => {
        if (!transactions || transactions.length === 0) return [];

        const { startDate, endDate } = dateRange;

        console.log('🔍 Filtering transactions:', {
            totalTransactions: transactions.length,
            dateRange: { startDate, endDate }
        });

        const filtered = transactions.filter(transaction => {
            const transactionDate = new Date(transaction.date);
            const startDateObj = new Date(startDate + 'T00:00:00.000Z');
            const endDateObj = new Date(endDate + 'T23:59:59.999Z');

            const isInRange = transactionDate >= startDateObj && transactionDate <= endDateObj;

            if (!isInRange) {
                console.log('📅 Transaction outside range:', {
                    description: transaction.description,
                    transactionDate: transactionDate.toISOString(),
                    startDate: startDateObj.toISOString(),
                    endDate: endDateObj.toISOString()
                });
            }

            return isInRange;
        });

        console.log('✅ Filtered results:', {
            originalCount: transactions.length,
            filteredCount: filtered.length
        });

        return filtered;
    }, []);

    // Calculate summary from filtered transactions
    const calculateSummary = useCallback((transactions) => {
        if (!transactions || transactions.length === 0) {
            return {
                income: 0,
                expenses: 0,
                netIncome: 0,
                totalTransactions: 0
            };
        }

        const summary = transactions.reduce((acc, transaction) => {
            const amount = Math.abs(transaction.amount);

            if (transaction.type === 'income') {
                acc.income += amount;
            } else if (transaction.type === 'expense') {
                acc.expenses += amount;
            }

            acc.totalTransactions++;
            return acc;
        }, {
            income: 0,
            expenses: 0,
            totalTransactions: 0
        });

        summary.netIncome = summary.income - summary.expenses;
        return summary;
    }, []);

    // Process transactions for category pie charts
    const processCategoryData = useCallback((transactions) => {
        if (!transactions || transactions.length === 0) {
            setCategoryData({ expenses: [], income: [] });
            return;
        }

        // Group transactions by category and type
        const expenseCategories = {};
        const incomeCategories = {};

        transactions.forEach(transaction => {
            const amount = Math.abs(transaction.amount);
            const category = transaction.category || 'Other';

            if (transaction.type === 'expense') {
                expenseCategories[category] = (expenseCategories[category] || 0) + amount;
            } else if (transaction.type === 'income') {
                incomeCategories[category] = (incomeCategories[category] || 0) + amount;
            }
        });

        // Convert to array format for Recharts
        const expenseData = Object.entries(expenseCategories).map(([name, value]) => ({
            name,
            value,
            formattedValue: formatCurrency(value)
        }));

        const incomeData = Object.entries(incomeCategories).map(([name, value]) => ({
            name,
            value,
            formattedValue: formatCurrency(value)
        }));

        setCategoryData({
            expenses: expenseData,
            income: incomeData
        });

        console.log('📊 Category data processed:', {
            expenses: expenseData.length,
            income: incomeData.length
        });
    }, []);

    const fetchDashboardData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            console.log('🔄 Fetching dashboard data...');

            // Get date range for filtering
            const dateRange = getDateRange(dateFilter);
            console.log('📅 Date range:', dateRange);

            // Declare these variables outside the try block
            let allTransactions = { data: [] };

            // Try to fetch dashboard data with better error handling
            try {
                // Fetch transactions with date filter parameters
                try {
                    // Pass date range as query parameters to the API
                    const transactionParams = {
                        startDate: dateRange.startDate,
                        endDate: dateRange.endDate,
                        limit: 1000 // Increase limit to get more historical data
                    };

                    allTransactions = await transactionAPI.getTransactions(getAccessTokenSilently, transactionParams);
                    console.log('✅ All transactions with date filter:', allTransactions.data?.length || 0);
                } catch (transactionError) {
                    console.warn('⚠️ Could not fetch transactions:', transactionError.message);
                }

                // Since we're now filtering on the backend, we don't need client-side filtering
                // But we'll keep it as a fallback for now
                const filteredTransactions = allTransactions.data || [];
                console.log('✅ Backend filtered transactions:', {
                    total: filteredTransactions.length,
                    dateRange
                });

                // Calculate summary from filtered transactions
                const summary = calculateSummary(filteredTransactions);

                // Get recent transactions (limit to 5 most recent from filtered set)
                const recentTransactions = filteredTransactions
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .slice(0, 5);

                // Try to fetch budget summary (not filtered by date)
                let budgetSummary = { data: null };
                try {
                    budgetSummary = await budgetAPI.getBudgetSummary(getAccessTokenSilently);
                    console.log('✅ Budget summary:', budgetSummary);
                } catch (budgetError) {
                    console.warn('⚠️ Could not fetch budget summary:', budgetError.message);
                }

                setDashboardData({
                    summary: summary,
                    recentTransactions: recentTransactions,
                    budgets: budgetSummary.data || null,
                    monthlyTrends: [] // This would need to be calculated from filtered data
                });

                processCategoryData(filteredTransactions);

            } catch (dashboardError) {
                console.error('❌ Dashboard API error:', dashboardError);

                // If it's a 404 or user not found, initialize the user
                if (dashboardError.message.includes('404') || dashboardError.message.includes('not found')) {
                    console.log('🔄 User not found, attempting to initialize...');

                    // Set default empty dashboard data
                    setDashboardData({
                        summary: {
                            income: 0,
                            expenses: 0,
                            netIncome: 0,
                            totalTransactions: 0
                        },
                        insights: [{
                            type: 'info',
                            title: 'Welcome to Prosper Finance!',
                            message: 'Start by adding your first transaction to see your financial overview.',
                            icon: 'info-circle'
                        }],
                        recentTransactions: [],
                        budgets: null,
                        monthlyTrends: []
                    });
                    // Set empty category data
                    setCategoryData({ expenses: [], income: [] });
                } else {
                    throw dashboardError;
                }
            }

        } catch (error) {
            console.error('💥 Dashboard fetch error:', error);
            setError(`Failed to load dashboard: ${error.message}`);

            // Set minimal dashboard data even on error
            setDashboardData({
                summary: {
                    income: 0,
                    expenses: 0,
                    netIncome: 0,
                    totalTransactions: 0
                },
                recentTransactions: [],
                budgets: null,
                monthlyTrends: []
            });
        } finally {
            setLoading(false);
        }
    }, [getAccessTokenSilently, processCategoryData, dateFilter, getDateRange, filterTransactionsByDate, calculateSummary]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchDashboardData();
        }
    }, [isAuthenticated, fetchDashboardData]);

    const handleDateFilterChange = (e) => {
        setDateFilter(e.target.value);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'CAD'
        }).format(amount || 0);
    };

    const getNetIncomeColor = (netIncome) => {
        if (netIncome > 0) return 'success';
        if (netIncome < 0) return 'danger';
        return 'warning';
    };

    // Color schemes for pie charts
    const expenseColors = [
        "#F94144", // red
        "#F9C74F", // yellow
        "#F3722C", // orange
        "#4D908E", // muted teal
        "#F9844A", // coral
        "#90BE6D", // light green
        "#43AA8B", // teal

    ];

    const incomeColors = [
        "#0A9396",
        "#94D2BD",
        "#E9D8A6",
        "#EE9B00",
        "#CA6702",
        "#BB3E03",
        "#AE2012",
        "#9B2226"
    ];

    if (!isAuthenticated) {
        return (
            <Container className="py-5">
                <Row className="justify-content-center">
                    <Col md={8} className="banner">
                        <img
                            src="/Welcome.png"
                            alt="welcome"
                            className='img-fluid'
                        /></Col>

                    <Col md={8} className="text-center">

                        <h1 className="h3">Your personal finance tracking made simple</h1>
                        <p>Sign up or log in to access your financial dashboard.</p>
                        <Button
                            color="primary"
                            size="lg"
                            onClick={handleLogin}
                        >
                            <FontAwesomeIcon className="me-2" />
                            Get Started Here!
                        </Button>
                    </Col>
                </Row>
            </Container>
        );
    }

    if (loading) return <Loading />;

    if (error) {
        return (
            <Container className="py-5">
                <Alert color="danger">
                    <h4>Error Loading Dashboard</h4>
                    <p>{error}</p>
                    <Button color="primary" onClick={fetchDashboardData}>
                        Try Again
                    </Button>
                </Alert>
            </Container>
        );
    }

    return (
        <Container fluid className="py-4">
            {/* Welcome Header with Date Filter */}
            <Row className="mb-4">
                <Col md={8}>

                    <h1 className="h3">Welcome back, {user?.name?.split(' ')[0] || 'there'}! 👋</h1>
                    <p className="text-muted">Here's your financial overview</p>
                </Col>
                <Col md={4}>
                    <FormGroup>
                        <Label for="dateFilter" className="text-muted small">Time Period</Label>
                        <Input
                            type="select"
                            name="dateFilter"
                            id="dateFilter"
                            value={dateFilter}
                            onChange={handleDateFilterChange}
                            className="form-control-sm"
                        >
                            {dateFilterOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </Input>
                    </FormGroup>
                </Col>
            </Row>

            {/* Summary Cards */}
            <Row className="mb-4">
                <Col lg={3} md={6} className="mb-3">
                    <Card className="h-100 border-0 shadow-sm">
                        <CardBody className="d-flex align-items-center">
                            <div className="flex-grow-1">
                                <CardText className="text-muted mb-1">Total Income</CardText>
                                <CardTitle className="h4 mb-0 text-success">
                                    {formatCurrency(dashboardData?.summary?.income)}
                                </CardTitle>
                            </div>
                            <div className="text-success">
                                <FontAwesomeIcon icon="arrow-up" size="2x" />
                            </div>
                        </CardBody>
                    </Card>
                </Col>

                <Col lg={3} md={6} className="mb-3">
                    <Card className="h-100 border-0 shadow-sm">
                        <CardBody className="d-flex align-items-center">
                            <div className="flex-grow-1">
                                <CardText className="text-muted mb-1">Total Expenses</CardText>
                                <CardTitle className="h4 mb-0 text-danger">
                                    {formatCurrency(dashboardData?.summary?.expenses)}
                                </CardTitle>
                            </div>
                            <div className="text-danger">
                                <FontAwesomeIcon icon="arrow-down" size="2x" />
                            </div>
                        </CardBody>
                    </Card>
                </Col>

                <Col lg={3} md={6} className="mb-3">
                    <Card className="h-100 border-0 shadow-sm">
                        <CardBody className="d-flex align-items-center">
                            <div className="flex-grow-1">
                                <CardText className="text-muted mb-1">Net Income</CardText>
                                <CardTitle className={`h4 mb-0 text-${getNetIncomeColor(dashboardData?.summary?.netIncome)}`}>
                                    {formatCurrency(dashboardData?.summary?.netIncome)}
                                </CardTitle>
                            </div>
                            <div className={`text-${getNetIncomeColor(dashboardData?.summary?.netIncome)}`}>
                                <FontAwesomeIcon
                                    icon={dashboardData?.summary?.netIncome >= 0 ? "chart-line" : "chart-bar"}
                                    size="2x"
                                />
                            </div>
                        </CardBody>
                    </Card>
                </Col>

                <Col lg={3} md={6} className="mb-3">
                    <Card className="h-100 border-0 shadow-sm">
                        <CardBody className="d-flex align-items-center">
                            <div className="flex-grow-1">
                                <CardText className="text-muted mb-1">Total Transactions</CardText>
                                <CardTitle className="h4 mb-0 text-primary">
                                    {dashboardData?.summary?.totalTransactions || 0}
                                </CardTitle>
                            </div>
                            <div className="text-primary">
                                <FontAwesomeIcon icon="exchange-alt" size="2x" />
                            </div>
                        </CardBody>
                    </Card>
                </Col>
            </Row>

            {/* Category Charts Row */}
            <Row className="mb-4">
                <Col lg={6} className="mb-4">
                    <CategoryPieChart
                        data={categoryData.expenses}
                        title="Expenses by Category"
                        colors={expenseColors}
                        formatCurrency={formatCurrency}
                    />
                </Col>
                <Col lg={6} className="mb-4">
                    <CategoryPieChart
                        data={categoryData.income}
                        title="Income by Category"
                        colors={incomeColors}
                        formatCurrency={formatCurrency}
                    />
                </Col>
            </Row>

            <Row>
                {/* Recent Transactions */}
                <Col lg={8} className="mb-4">
                    <Card className="h-100 border-0 shadow-sm">
                        <CardBody>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h5 className="mb-0">Recent Transactions</h5>
                                <Button
                                    color="outline-primary"
                                    size="sm"
                                    onClick={() => history.push('/transactions')}
                                >
                                    View All
                                </Button>
                            </div>

                            {dashboardData?.recentTransactions?.length > 0 ? (
                                <div>
                                    {dashboardData.recentTransactions.map((transaction) => (
                                        <div key={transaction._id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                                            <div className="d-flex align-items-center">
                                                <div className={`text-${transaction.type === 'income' ? 'success' : 'danger'} mr-3`}>
                                                    <FontAwesomeIcon
                                                        icon={transaction.type === 'income' ? 'plus-circle' : 'minus-circle'}
                                                    />
                                                </div>
                                                <div>
                                                    <div className="font-weight-bold">{transaction.description}</div>
                                                    <small className="text-muted">
                                                        {transaction.category} • {new Date(transaction.date).toLocaleDateString()}
                                                    </small>
                                                </div>
                                            </div>
                                            <div className={`text-${transaction.type === 'income' ? 'success' : 'danger'} font-weight-bold`}>
                                                {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <FontAwesomeIcon icon="inbox" size="3x" className="text-muted mb-3" />
                                    <p className="text-muted">No transactions in selected period</p>
                                    <Button
                                        color="primary"
                                        tag={Link}
                                        to="/transactions"
                                    >
                                        Add Your First Transaction
                                    </Button>
                                </div>
                            )}
                        </CardBody>
                    </Card>
                </Col>

                {/* Budget Overview */}
                <Col lg={4} className="mb-4">
                    <Card className="h-100 border-0 shadow-sm">
                        <CardBody>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h5 className="mb-0">Budget Overview</h5>
                                <Button
                                    color="outline-primary"
                                    size="sm"
                                    onClick={() => history.push('/budgets')}
                                >
                                    Manage
                                </Button>
                            </div>

                            {dashboardData?.budgets ? (
                                <div>
                                    <div className="text-center mb-3">
                                        <div className="h4 mb-1">{formatCurrency(dashboardData.budgets.totalRemaining)}</div>
                                        <small className="text-muted">Remaining this month</small>
                                    </div>

                                    <div className="mb-3">
                                        <div className="d-flex justify-content-between mb-1">
                                            <small>Budget Usage</small>
                                            <small>{Math.round(dashboardData.budgets.overallUtilization)}%</small>
                                        </div>
                                        <Progress
                                            value={dashboardData.budgets.overallUtilization}
                                            color={dashboardData.budgets.overallUtilization > 90 ? 'danger' : dashboardData.budgets.overallUtilization > 75 ? 'warning' : 'success'}
                                        />
                                    </div>

                                    <div className="row text-center">
                                        <div className="col">
                                            <div className="font-weight-bold">{dashboardData.budgets.activeBudgets}</div>
                                            <small className="text-muted">Active Budgets</small>
                                        </div>
                                        <div className="col">
                                            <div className="font-weight-bold text-danger">{dashboardData.budgets.exceededBudgets}</div>
                                            <small className="text-muted">Over Budget</small>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <FontAwesomeIcon icon="chart-pie" size="3x" className="text-muted mb-3" />
                                    <p className="text-muted">No budgets set up yet</p>
                                    <Button
                                        color="primary"
                                        onClick={() => history.push('/budgets')}
                                    >
                                        Create Your First Budget
                                    </Button>
                                </div>
                            )}
                        </CardBody>
                    </Card>
                </Col>
            </Row>


            {/* Quick Actions */}
            <Row className="mt-4">
                <Col>
                    <Card className="border-0 shadow-sm">
                        <CardBody>
                            <h5 className="mb-3">Quick Actions</h5>
                            <Row>
                                <Col md={4} className="mb-2">
                                    <Button
                                        color="success"
                                        block
                                        onClick={() => history.push('/transactions?action=add&type=income')}
                                    >
                                        <FontAwesomeIcon icon="plus" className="mr-2" />
                                        Add Income
                                    </Button>
                                </Col>
                                <Col md={4} className="mb-2">
                                    <Button
                                        color="danger"
                                        block
                                        onClick={() => history.push('/transactions?action=add&type=expense')}
                                    >
                                        <FontAwesomeIcon icon="minus" className="mr-2" />
                                        Add Expense
                                    </Button>
                                </Col>
                                <Col md={4} className="mb-2">
                                    <Button
                                        color="primary"
                                        block
                                        onClick={() => history.push('/budgets?action=create')}
                                    >
                                        <FontAwesomeIcon icon="chart-pie" className="mr-2" />
                                        Create Budget
                                    </Button>
                                </Col>
                            </Row>
                        </CardBody>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default Dashboard;