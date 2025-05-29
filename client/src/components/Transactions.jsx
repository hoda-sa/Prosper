import React, { useState, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import {
    Container,
    Row,
    Col,
    Card,
    CardBody,
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
    InputGroup,
    InputGroupText
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { transactionAPI, categoryAPI } from '../utils/api';
import Loading from './Loading';


const Transactions = () => {
    const { getAccessTokenSilently } = useAuth0();
    const [transactions, setTransactions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modal, setModal] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [filters, setFilters] = useState({
        type: '',
        category: '',
        startDate: '',
        endDate: '',
        search: ''
    });
    const [formData, setFormData] = useState({
        type: 'expense',
        amount: '',
        description: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'other',
        notes: ''
    });

    // Memoized fetch functions to prevent infinite loops
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            console.log('🔄 Fetching transactions and categories...');

            const [transactionsResponse, categoriesResponse] = await Promise.all([
                transactionAPI.getTransactions(getAccessTokenSilently, { limit: 50 }),
                categoryAPI.getCategories(getAccessTokenSilently)
            ]);

            console.log('✅ Transactions:', transactionsResponse.data?.length || 0);
            console.log('✅ Categories:', categoriesResponse.data?.length || 0);

            setTransactions(transactionsResponse.data || []);
            setCategories(categoriesResponse.data || []);
        } catch (error) {
            console.error('❌ Error fetching data:', error);
            setError(error.message);
            // Set empty arrays on error to prevent undefined issues
            setTransactions([]);
            setCategories([]);
        } finally {
            setLoading(false);
        }
    }, [getAccessTokenSilently]);

    const fetchTransactions = useCallback(async () => {
        try {
            const params = Object.fromEntries(
                Object.entries(filters).filter(([_, v]) => v !== '')
            );

            console.log('🔄 Fetching filtered transactions:', params);

            const response = await transactionAPI.getTransactions(getAccessTokenSilently, params);
            setTransactions(response.data || []);
        } catch (error) {
            console.error('❌ Error fetching transactions:', error);
            setError(error.message);
        }
    }, [getAccessTokenSilently, filters]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        // Only fetch transactions if we have initial data
        if (!loading) {
            fetchTransactions();
        }
    }, [filters, fetchTransactions, loading]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.category) {
            setError('Please select a category');
            return;
        }

        try {
            console.log('💾 Saving transaction:', formData);

            if (editingTransaction) {
                await transactionAPI.updateTransaction(getAccessTokenSilently, editingTransaction._id, formData);
            } else {
                await transactionAPI.createTransaction(getAccessTokenSilently, formData);
            }

            setModal(false);
            resetForm();
            fetchTransactions();
        } catch (error) {
            console.error('❌ Error saving transaction:', error);
            setError(error.message);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this transaction?')) {
            try {
                await transactionAPI.deleteTransaction(getAccessTokenSilently, id);
                fetchTransactions();
            } catch (error) {
                setError(error.message);
            }
        }
    };

    const handleEdit = (transaction) => {
        setEditingTransaction(transaction);
        setFormData({
            type: transaction.type,
            amount: transaction.amount.toString(),
            description: transaction.description,
            category: transaction.category,
            date: new Date(transaction.date).toISOString().split('T')[0],
            paymentMethod: transaction.paymentMethod || 'other',
            notes: transaction.notes || ''
        });
        setModal(true);
    };

    const resetForm = () => {
        setFormData({
            type: 'expense',
            amount: '',
            description: '',
            category: '',
            date: new Date().toISOString().split('T')[0],
            paymentMethod: 'other',
            notes: ''
        });
        setEditingTransaction(null);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    // Fixed category filtering function
    const getFilteredCategories = () => {
        if (!categories || categories.length === 0) {
            console.log('⚠️ No categories available');
            return [];
        }

        // Filter categories by type, or return all if no type filter
        const filtered = categories.filter(cat => {
            // If category has a type field, match it
            if (cat.type) {
                return cat.type === formData.type;
            }
            // If no type field, include all categories
            return true;
        });

        console.log(`🔍 Filtered categories for ${formData.type}:`, filtered.length);
        return filtered;
    };

    // Handle form data changes with logging
    const handleFormChange = (field, value) => {
        const newFormData = { ...formData, [field]: value };

        // Reset category when type changes
        if (field === 'type') {
            newFormData.category = '';
        }

        console.log(`📝 Form field changed: ${field} = ${value}`);
        setFormData(newFormData);
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

            {/* Debug Info - Remove this after fixing */}
            {process.env.NODE_ENV === 'development' && (
                <Alert color="info" className="mb-4">
                    <strong>Debug Info:</strong>
                    Categories loaded: {categories.length} |
                    Filtered categories: {getFilteredCategories().length} |
                    Current type: {formData.type}
                </Alert>
            )}

            {/* Header */}
            <Row className="mb-4">
                <Col>
                    <div className="d-flex justify-content-between align-items-center">
                        <div>
                            <h1 className="h3">Transactions</h1>
                            <p className="text-muted">Manage your income and expenses</p>
                        </div>
                        <Button
                            color="primary"
                            onClick={() => {
                                resetForm();
                                setModal(true);
                            }}
                        >
                            <FontAwesomeIcon icon="plus" className="mr-2" />
                            Add Transaction
                        </Button>
                    </div>
                </Col>
            </Row>

            {/* Filters */}
            <Card className="mb-4">
                <CardBody>
                    <Form>
                        <Row>
                            <Col md={2}>
                                <FormGroup className="transaction-form-group">
                                    <Label for="filterType">Type</Label>
                                    <Input
                                        type="select"
                                        id="filterType"
                                        className="form-select"
                                        value={filters.type}
                                        onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                                    >
                                        <option value="">All Types</option>
                                        <option value="income">Income</option>
                                        <option value="expense">Expense</option>
                                    </Input>
                                </FormGroup>
                            </Col>
                            <Col md={2}>
                                <FormGroup>
                                    <Label for="filterCategory">Category</Label>
                                    <Input
                                        type="select"
                                        id="filterCategory"
                                        value={filters.category}
                                        onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                                    >
                                        <option value="">All Categories</option>
                                        {categories.map(cat => (
                                            <option key={cat._id} value={cat.name}>
                                                {cat.name}
                                            </option>
                                        ))}
                                    </Input>
                                </FormGroup>
                            </Col>
                            <Col md={2}>
                                <FormGroup>
                                    <Label for="startDate">Start Date</Label>
                                    <Input
                                        type="date"
                                        id="startDate"
                                        value={filters.startDate}
                                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                    />
                                </FormGroup>
                            </Col>
                            <Col md={2}>
                                <FormGroup>
                                    <Label for="endDate">End Date</Label>
                                    <Input
                                        type="date"
                                        id="endDate"
                                        value={filters.endDate}
                                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                    />
                                </FormGroup>
                            </Col>
                            <Col md={3}>
                                <FormGroup>
                                    <Label for="search">Search</Label>
                                    <Input
                                        type="text"
                                        id="search"
                                        placeholder="Search descriptions..."
                                        value={filters.search}
                                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                    />
                                </FormGroup>
                            </Col>
                            <Col md={1} className="d-flex align-items-end">
                                <Button
                                    color="outline-secondary"
                                    onClick={() => setFilters({
                                        type: '',
                                        category: '',
                                        startDate: '',
                                        endDate: '',
                                        search: ''
                                    })}
                                >
                                    Clear
                                </Button>
                            </Col>
                        </Row>
                    </Form>
                </CardBody>
            </Card>

            {/* Transactions Table */}
            <Card>
                <CardBody>
                    {transactions.length > 0 ? (
                        <Table responsive hover>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Description</th>
                                    <th>Category</th>
                                    <th>Type</th>
                                    <th>Amount</th>
                                    <th>Payment Method</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((transaction) => (
                                    <tr key={transaction._id}>
                                        <td>
                                            {new Date(transaction.date).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <div>
                                                <div className="font-weight-bold">{transaction.description}</div>
                                                {transaction.notes && (
                                                    <small className="text-muted">{transaction.notes}</small>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <Badge color="secondary" pill>
                                                {transaction.category}
                                            </Badge>
                                        </td>
                                        <td>
                                            <Badge
                                                color={transaction.type === 'income' ? 'success' : 'danger'}
                                                pill
                                            >
                                                <FontAwesomeIcon
                                                    icon={transaction.type === 'income' ? 'arrow-up' : 'arrow-down'}
                                                    className="mr-1"
                                                />
                                                {transaction.type}
                                            </Badge>
                                        </td>
                                        <td>
                                            <span className={`font-weight-bold text-${transaction.type === 'income' ? 'success' : 'danger'}`}>
                                                {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                                            </span>
                                        </td>
                                        <td>
                                            <Badge color="info" pill>
                                                {transaction.paymentMethod?.replace('_', ' ') || 'Other'}
                                            </Badge>
                                        </td>
                                        <td>
                                            <Button
                                                color="outline-primary"
                                                size="sm"
                                                className="mr-2"
                                                onClick={() => handleEdit(transaction)}
                                            >
                                                <FontAwesomeIcon icon="edit" />
                                            </Button>
                                            <Button
                                                color="outline-danger"
                                                size="sm"
                                                onClick={() => handleDelete(transaction._id)}
                                            >
                                                <FontAwesomeIcon icon="trash" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    ) : (
                        <div className="text-center py-5">
                            <FontAwesomeIcon icon="inbox" size="3x" className="text-muted mb-3" />
                            <h5>No transactions found</h5>
                            <p className="text-muted">Add your first transaction to get started!</p>
                            <Button
                                color="primary"
                                onClick={() => {
                                    resetForm();
                                    setModal(true);
                                }}
                            >
                                <FontAwesomeIcon icon="plus" className="mr-2" />
                                Add Transaction
                            </Button>
                        </div>
                    )}
                </CardBody>
            </Card>

            {/* Add/Edit Transaction Modal */}
            <Modal isOpen={modal} toggle={() => setModal(!modal)} size="lg">
                <ModalHeader toggle={() => setModal(!modal)}>
                    {editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}
                </ModalHeader>
                <Form onSubmit={handleSubmit}>
                    <ModalBody>
                        <Row>
                            <Col md={6}>
                                <FormGroup>
                                    <Label for="type">Type *</Label>
                                    <Input
                                        type="select"
                                        id="type"
                                        value={formData.type}
                                        onChange={(e) => handleFormChange('type', e.target.value)}
                                        required
                                    >
                                        <option value="expense">Expense</option>
                                        <option value="income">Income</option>
                                    </Input>
                                </FormGroup>
                            </Col>
                            <Col md={6}>
                                <FormGroup>
                                    <Label for="amount">Amount *</Label>
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
                            <Label for="description">Description *</Label>
                            <Input
                                type="text"
                                id="description"
                                placeholder="What was this transaction for?"
                                value={formData.description}
                                onChange={(e) => handleFormChange('description', e.target.value)}
                                required
                            />
                        </FormGroup>

                        <Row>
                            <Col md={6}>
                                <FormGroup>
                                    <Label for="category">Category </Label>
                                    <Input
                                        type="select"
                                        id="category"
                                        value={formData.category}
                                        onChange={(e) => handleFormChange('category', e.target.value)}
                                        required
                                    >
                                        <option value="">Select a category</option>
                                        {getFilteredCategories().map(cat => (
                                            <option key={cat._id || cat.name} value={cat.name}>
                                                {cat.name} {cat.type && `(${cat.type})`}
                                            </option>
                                        ))}
                                    </Input>
                                    {getFilteredCategories().length === 0}
                                </FormGroup>
                            </Col>
                            <Col md={6}>
                                <FormGroup>
                                    <Label for="date">Date *</Label>
                                    <Input
                                        type="date"
                                        id="date"
                                        value={formData.date}
                                        onChange={(e) => handleFormChange('date', e.target.value)}
                                        required
                                    />
                                </FormGroup>
                            </Col>
                        </Row>

                        <FormGroup>
                            <Label for="paymentMethod">Payment Method</Label>
                            <Input
                                type="select"
                                id="paymentMethod"
                                value={formData.paymentMethod}
                                onChange={(e) => handleFormChange('paymentMethod', e.target.value)}
                            >
                                <option value="cash">Cash</option>
                                <option value="credit_card">Credit Card</option>
                                <option value="debit_card">Debit Card</option>
                                <option value="bank_transfer">Bank Transfer</option>
                                <option value="check">Check</option>
                                <option value="digital_wallet">Digital Wallet</option>
                                <option value="other">Other</option>
                            </Input>
                        </FormGroup>

                        <FormGroup>
                            <Label for="notes">Notes</Label>
                            <Input
                                type="textarea"
                                id="notes"
                                placeholder="Additional notes (optional)"
                                rows="3"
                                value={formData.notes}
                                onChange={(e) => handleFormChange('notes', e.target.value)}
                            />
                        </FormGroup>
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
                            {editingTransaction ? 'Update' : 'Add'} Transaction
                        </Button>
                    </ModalFooter>
                </Form>
            </Modal>
        </Container>
    );
};

export default Transactions;