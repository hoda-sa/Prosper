import React, { useState, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useHistory, useLocation } from 'react-router-dom';
import {
    Container,
    Row,
    Col,
    Card,
    CardBody,
    CardTitle,
    Button,
    Form,
    FormGroup,
    Label,
    Input,
    Table,
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Alert,
    Badge,
    Progress,
    InputGroup,
    InputGroupText,
    UncontrolledTooltip
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { budgetAPI, categoryAPI } from '../utils/api';
import Loading from './Loading';

const Budgets = () => {
    const { getAccessTokenSilently } = useAuth0();
    const history = useHistory();
    const location = useLocation();

    const [budgets, setBudgets] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modal, setModal] = useState(false);
    const [editingBudget, setEditingBudget] = useState(null);
    const [budgetSummary, setBudgetSummary] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        amount: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        categories: [],
        type: 'expense',
        alertThresholds: {
            warning: { percentage: 75, enabled: true },
            critical: { percentage: 90, enabled: true }
        },
        autoRenew: { enabled: true, adjustAmount: false, adjustmentPercentage: 0 }
    });

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            console.log('🔄 Fetching budgets and categories...');

            // Fetch budgets and categories in parallel
            const [budgetsResponse, categoriesResponse, summaryResponse] = await Promise.all([
                budgetAPI.getBudgets(getAccessTokenSilently),
                categoryAPI.getCategories(getAccessTokenSilently),
                budgetAPI.getBudgetSummary(getAccessTokenSilently)
                    .catch(err => {
                        console.warn('Could not fetch budget summary:', err);
                        return { data: null };
                    })
            ]);

            console.log('✅ Budgets:', budgetsResponse.data?.length || 0);
            console.log('✅ Categories:', categoriesResponse.data?.length || 0);

            setBudgets(budgetsResponse.data || []);
            setCategories(categoriesResponse.data || []);
            setBudgetSummary(summaryResponse.data);

        } catch (error) {
            console.error('❌ Error fetching data:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [getAccessTokenSilently]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Check URL parameters for auto-opening create modal
    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        if (urlParams.get('action') === 'create') {
            setModal(true);
        }
    }, [location]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.categories.length === 0) {
            setError('Please select at least one category');
            return;
        }

        try {
            console.log('💾 Saving budget:', formData);

            const budgetData = {
                ...formData,
                amount: parseFloat(formData.amount)
            };

            if (editingBudget) {
                await budgetAPI.updateBudget(getAccessTokenSilently, editingBudget._id, budgetData);
            } else {
                await budgetAPI.createBudget(getAccessTokenSilently, budgetData);
            }

            setModal(false);
            resetForm();
            fetchData();
        } catch (error) {
            console.error('❌ Error saving budget:', error);
            setError(error.message);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this budget?')) {
            try {
                await budgetAPI.deleteBudget(getAccessTokenSilently, id);
                fetchData();
            } catch (error) {
                setError(error.message);
            }
        }
    };

    const handleEdit = (budget) => {
        setEditingBudget(budget);
        setFormData({
            name: budget.name,
            description: budget.description || '',
            amount: budget.amount.toString(),
            startDate: new Date(budget.startDate).toISOString().split('T')[0],
            endDate: new Date(budget.endDate).toISOString().split('T')[0],
            categories: budget.categories || [],
            type: budget.type,
            alertThresholds: budget.alertThresholds || {
                warning: { percentage: 75, enabled: true },
                critical: { percentage: 90, enabled: true }
            },
            autoRenew: budget.autoRenew || { enabled: true, adjustAmount: false, adjustmentPercentage: 0 }
        });
        setModal(true);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            amount: '',
            startDate: new Date().toISOString().split('T')[0],
            endDate: '',
            categories: [],
            type: 'expense',
            alertThresholds: {
                warning: { percentage: 75, enabled: true },
                critical: { percentage: 90, enabled: true }
            },
            autoRenew: { enabled: true, adjustAmount: false, adjustmentPercentage: 0 }
        });
        setEditingBudget(null);
    };

    // Helper functions
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'CAD'
        }).format(amount);
    };

    const getBudgetHealthColor = (utilizationPercentage) => {
        if (utilizationPercentage >= 90) return 'danger';
        if (utilizationPercentage >= 75) return 'warning';
        if (utilizationPercentage <= 74) return 'success';
        return 'primary';
    };

    const getBudgetHealthStatus = (budget) => {
        const utilization = budget.utilizationPercentage || 0;

        if (utilization >= 100) return { text: 'Over Budget', color: 'danger' };
        if (utilization >= 90) return { text: 'Critical', color: 'danger' };
        if (utilization >= 75) return { text: 'Warning', color: 'warning' };
        if (utilization < 50) return { text: 'Good', color: 'success' };
        return { text: 'On Track', color: 'primary' };
    };

    const getExpenseCategories = () => {
        return categories.filter(cat => cat.type === 'expense' || !cat.type);
    };

    const handleFormChange = (field, value) => {
        if (field.includes('.')) {
            const [parent, child, grandchild] = field.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: {
                    ...prev[parent],
                    [child]: grandchild ? {
                        ...prev[parent][child],
                        [grandchild]: value
                    } : value
                }
            }));
        } else {
            setFormData(prev => ({ ...prev, [field]: value }));
        }
    };

    const handleCategoryChange = (categoryName, isChecked) => {
        setFormData(prev => ({
            ...prev,
            categories: isChecked
                ? [...prev.categories, categoryName]
                : prev.categories.filter(cat => cat !== categoryName)
        }));
    };

    if (loading) return <Loading />;

    return (
        <Container fluid className="py-4">
            {error && (
                <Alert color="danger" className="mb-4">
                    {error}
                    <Button
                        color="link"
                        className="p-0 ml-2"
                        onClick={() => setError(null)}
                    >
                        <FontAwesomeIcon icon="times" />
                    </Button>
                </Alert>
            )}

            {/* Header */}
            <Row className="mb-4">
                <Col>
                    <div className="d-flex justify-content-between align-items-center">
                        <div>
                            <h1 className="h3">Budget Management</h1>
                            <p className="text-muted">Track and manage your spending budgets</p>
                        </div>
                        <Button
                            color="primary"
                            onClick={() => {
                                resetForm();
                                setModal(true);
                            }}
                        >
                            <FontAwesomeIcon icon="plus" className="mr-2" />
                            Create Budget
                        </Button>
                    </div>
                </Col>
            </Row>

            {/* Budget Summary Cards */}
            {budgetSummary && (
                <Row className="mb-4">
                    <Col lg={3} md={6} className="mb-3">
                        <Card className="h-100 border-0 shadow-sm">
                            <CardBody>
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <div className="text-muted small">Total Budget</div>
                                        <div className="h4 mb-0">{formatCurrency(budgetSummary.totalBudget)}</div>
                                    </div>
                                    <FontAwesomeIcon icon="chart-pie" className="text-primary" size="2x" />
                                </div>
                            </CardBody>
                        </Card>
                    </Col>
                    <Col lg={3} md={6} className="mb-3">
                        <Card className="h-100 border-0 shadow-sm">
                            <CardBody>
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <div className="text-muted small">Total Spent</div>
                                        <div className="h4 mb-0">{formatCurrency(budgetSummary.totalSpent)}</div>
                                    </div>
                                    <FontAwesomeIcon icon="arrow-down" className="text-danger" size="2x" />
                                </div>
                            </CardBody>
                        </Card>
                    </Col>
                    <Col lg={3} md={6} className="mb-3">
                        <Card className="h-100 border-0 shadow-sm">
                            <CardBody>
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <div className="text-muted small">Remaining</div>
                                        <div className="h4 mb-0">{formatCurrency(budgetSummary.totalRemaining)}</div>
                                    </div>
                                    <FontAwesomeIcon icon="piggy-bank" className="text-success" size="2x" />
                                </div>
                            </CardBody>
                        </Card>
                    </Col>
                    <Col lg={3} md={6} className="mb-3">
                        <Card className="h-100 border-0 shadow-sm">
                            <CardBody>
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <div className="text-muted small">Active Budgets</div>
                                        <div className="h4 mb-0">{budgetSummary.activeBudgets}</div>
                                    </div>
                                    <FontAwesomeIcon icon="chart-bar" className="text-info" size="2x" />
                                </div>
                            </CardBody>
                        </Card>
                    </Col>
                </Row>
            )}

            {/* Budget List */}
            <Card>
                <CardBody>
                    <CardTitle className="h5 mb-4">Your Budgets</CardTitle>

                    {budgets.length > 0 ? (
                        <div className="table-responsive">
                            <Table hover>
                                <thead>
                                    <tr>
                                        <th>Budget Name</th>
                                        <th>Categories</th>
                                        <th>Date Range</th>
                                        <th>Progress</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {budgets.map((budget) => {
                                        const healthStatus = getBudgetHealthStatus(budget);
                                        const utilization = budget.utilizationPercentage || 0;

                                        return (
                                            <tr key={budget._id}>
                                                <td>
                                                    <div>
                                                        <div className="font-weight-bold">{budget.name}</div>
                                                        {budget.description && (
                                                            <small className="text-muted">{budget.description}</small>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="d-flex flex-wrap">
                                                        {budget.categories.slice(0, 2).map(category => (
                                                            <Badge key={category} color="secondary" pill className="mr-1 mb-1">
                                                                {category}
                                                            </Badge>
                                                        ))}
                                                        {budget.categories.length > 2 && (
                                                            <Badge color="light" pill className="mr-1 mb-1">
                                                                +{budget.categories.length - 2} more
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <Badge color="info" pill>
                                                        {budget.period}
                                                    </Badge>
                                                </td>
                                                <td style={{ minWidth: '200px' }}>
                                                    <div>
                                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                                            <small>
                                                                {formatCurrency(budget.currentPeriod?.spent || 0)} / {formatCurrency(budget.amount)}
                                                            </small>
                                                            <small className="font-weight-bold">
                                                                {utilization}%
                                                            </small>
                                                        </div>
                                                        <Progress
                                                            value={Math.min(utilization, 100)}
                                                            color={getBudgetHealthColor(utilization)}
                                                            className="mb-1"
                                                            style={{ height: '8px' }}
                                                        />
                                                        <div className="d-flex justify-content-between">
                                                            <small className="text-muted">
                                                                {budget.daysRemaining || 0} days left
                                                            </small>
                                                            <small className="text-muted">
                                                                {formatCurrency(budget.remainingAmount || 0)} left
                                                            </small>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <Badge color={healthStatus.color} pill>
                                                        {healthStatus.text}
                                                    </Badge>
                                                </td>
                                                <td>
                                                    <div className="d-flex">
                                                        <Button
                                                            color="outline-primary"
                                                            size="sm"
                                                            className="mr-2"
                                                            onClick={() => handleEdit(budget)}
                                                            id={`edit-${budget._id}`}
                                                        >
                                                            <FontAwesomeIcon icon="edit" />
                                                        </Button>
                                                        <UncontrolledTooltip placement="top" target={`edit-${budget._id}`}>
                                                            Edit Budget
                                                        </UncontrolledTooltip>

                                                        <Button
                                                            color="outline-danger"
                                                            size="sm"
                                                            onClick={() => handleDelete(budget._id)}
                                                            id={`delete-${budget._id}`}
                                                        >
                                                            <FontAwesomeIcon icon="trash" />
                                                        </Button>
                                                        <UncontrolledTooltip placement="top" target={`delete-${budget._id}`}>
                                                            Delete Budget
                                                        </UncontrolledTooltip>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center py-5">
                            <FontAwesomeIcon icon="chart-pie" size="3x" className="text-muted mb-3" />
                            <h5>No budgets created yet</h5>
                            <p className="text-muted">Create your first budget to start tracking your spending!</p>
                            <Button
                                color="primary"
                                onClick={() => {
                                    resetForm();
                                    setModal(true);
                                }}
                            >
                                <FontAwesomeIcon icon="plus" className="mr-2" />
                                Create Your First Budget
                            </Button>
                        </div>
                    )}
                </CardBody>
            </Card>

            {/* Create/Edit Budget Modal */}
            <Modal isOpen={modal} toggle={() => setModal(!modal)} size="lg">
                <ModalHeader toggle={() => setModal(!modal)}>
                    {editingBudget ? 'Edit Budget' : 'Create New Budget'}
                </ModalHeader>
                <Form onSubmit={handleSubmit}>
                    <ModalBody>
                        <Row>
                            <Col md={6}>
                                <FormGroup>
                                    <Label for="name">Budget Name *</Label>
                                    <Input
                                        type="text"
                                        id="name"
                                        placeholder="e.g., Monthly Groceries"
                                        value={formData.name}
                                        onChange={(e) => handleFormChange('name', e.target.value)}
                                        required
                                    />
                                </FormGroup>
                            </Col>
                            <Col md={6}>
                                <FormGroup>
                                    <Label for="amount">Budget Amount *</Label>
                                    <InputGroup>
                                        <InputGroupText>$</InputGroupText>
                                        <Input
                                            type="number"
                                            id="amount"
                                            placeholder="0.00"
                                            step="0.01"
                                            min="0.01"
                                            value={formData.amount}
                                            onChange={(e) => handleFormChange('amount', e.target.value)}
                                            required
                                        />
                                    </InputGroup>
                                </FormGroup>
                            </Col>
                        </Row>

                        <FormGroup>
                            <Label for="description">Description</Label>
                            <Input
                                type="textarea"
                                id="description"
                                placeholder="Optional description for this budget"
                                rows="2"
                                value={formData.description}
                                onChange={(e) => handleFormChange('description', e.target.value)}
                            />
                        </FormGroup>


                        <Row>
                            <Col md={6}>
                                <FormGroup>
                                    <Label for="startDate">Start Date *</Label>
                                    <Input
                                        type="date"
                                        id="startDate"
                                        value={formData.startDate}
                                        onChange={(e) => handleFormChange('startDate', e.target.value)}
                                        required
                                    />
                                </FormGroup>
                            </Col>
                            <Col md={6}>
                                <FormGroup>
                                    <Label for="endDate">End Date *</Label>
                                    <Input
                                        type="date"
                                        id="endDate"
                                        value={formData.endDate}
                                        onChange={(e) => handleFormChange('endDate', e.target.value)}
                                        required
                                    />
                                </FormGroup>
                            </Col>
                        </Row>

                        <FormGroup>
                            <Label>Categories *</Label>
                            <div className="border rounded p-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {getExpenseCategories().length > 0 ? (
                                    <Row>
                                        {getExpenseCategories().map(category => (
                                            <Col md={6} key={category._id || category.name} className="mb-2">
                                                <FormGroup check>
                                                    <Input
                                                        type="checkbox"
                                                        id={`category-${category._id || category.name}`}
                                                        checked={formData.categories.includes(category.name)}
                                                        onChange={(e) => handleCategoryChange(category.name, e.target.checked)}
                                                    />
                                                    <Label check for={`category-${category._id || category.name}`}>
                                                        {category.name}
                                                    </Label>
                                                </FormGroup>
                                            </Col>
                                        ))}
                                    </Row>
                                ) : (
                                    <div className="text-center text-muted py-3">
                                        <p>No expense categories available</p>
                                        <Button
                                            color="link"
                                            onClick={() => history.push('/transactions')}
                                        >
                                            Add some transactions first to create categories
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </FormGroup>

                        {/* Alert Thresholds */}
                        <Card className="mt-3">
                            <CardBody>
                                <CardTitle className="h6">Alert Settings</CardTitle>
                                <Row>
                                    <Col md={6}>
                                        <FormGroup>
                                            <Label for="warningThreshold">Warning Threshold (%)</Label>
                                            <Input
                                                type="number"
                                                id="warningThreshold"
                                                min="0"
                                                max="100"
                                                value={formData.alertThresholds.warning.percentage}
                                                onChange={(e) => handleFormChange('alertThresholds.warning.percentage', parseInt(e.target.value))}
                                            />
                                        </FormGroup>
                                    </Col>
                                    <Col md={6}>
                                        <FormGroup>
                                            <Label for="criticalThreshold">Critical Threshold (%)</Label>
                                            <Input
                                                type="number"
                                                id="criticalThreshold"
                                                min="0"
                                                max="100"
                                                value={formData.alertThresholds.critical.percentage}
                                                onChange={(e) => handleFormChange('alertThresholds.critical.percentage', parseInt(e.target.value))}
                                            />
                                        </FormGroup>
                                    </Col>
                                </Row>
                            </CardBody>
                        </Card>

                        {/* Auto-renewal Settings */}
                        <Card className="mt-3">
                            <CardBody>
                                <FormGroup check>
                                    <Input
                                        type="checkbox"
                                        id="autoRenew"
                                        checked={formData.autoRenew.enabled}
                                        onChange={(e) => handleFormChange('autoRenew.enabled', e.target.checked)}
                                    />
                                    <Label check for="autoRenew">
                                        Automatically renew this budget when the period ends
                                    </Label>
                                </FormGroup>
                            </CardBody>
                        </Card>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            color="secondary"
                            onClick={() => {
                                setModal(false);
                                resetForm();
                            }}
                        >
                            Cancel
                        </Button>
                        <Button color="primary" type="submit">
                            {editingBudget ? 'Update' : 'Create'} Budget
                        </Button>
                    </ModalFooter>
                </Form>
            </Modal>
        </Container>
    );
};

export default Budgets;