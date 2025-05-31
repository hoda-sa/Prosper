import React, { useState, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import {
    Container,
    Row,
    Col,
    Card,
    CardBody,
    Button,
    Alert,
    Badge,
    Spinner,
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Table
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PlaidLink from './PlaidLink';
import Loading from './Loading';

const ConnectedAccounts = () => {
    const { getAccessTokenSilently, isAuthenticated, isLoading: authLoading } = useAuth0();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [syncing, setSyncing] = useState(false);
    const [disconnectModal, setDisconnectModal] = useState(false);
    const [lastSync, setLastSync] = useState(null);
    const [institution, setInstitution] = useState(null);
    const [syncResult, setSyncResult] = useState(null);

    const fetchAccounts = useCallback(async () => {
        // Don't fetch if user is not authenticated
        if (!isAuthenticated || authLoading) {
            console.log('⏸️ Skipping fetch - auth loading or not authenticated');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            console.log('🔄 Fetching accounts...');

            const token = await getAccessTokenSilently({
                authorizationParams: {
                    audience: process.env.REACT_APP_AUTH0_AUDIENCE,
                },
            });

            console.log('✅ Got auth token, making API call...');
            console.log('🔗 API URL:', `${process.env.REACT_APP_API_URL}/plaid/accounts`);

            // Add timeout to fetch
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const response = await fetch(`${process.env.REACT_APP_API_URL}/plaid/accounts`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            console.log('📡 API Response received:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            if (response.status === 404) {
                // No accounts connected yet
                console.log('ℹ️ No accounts connected (404)');
                setAccounts([]);
                setLastSync(null);
                setInstitution(null);
                return;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ API Error Response:', errorData);
                throw new Error(errorData.message || `HTTP ${response.status}: Failed to fetch accounts`);
            }

            const data = await response.json();
            console.log('✅ Accounts data received:', data);

            setAccounts(data.data.accounts);
            setInstitution(data.data.institution);
            setLastSync(data.data.lastSync);
        } catch (error) {
            console.error('❌ Error fetching accounts:', error);
            console.error('❌ Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            setError(error.message);
        } finally {
            console.log('🏁 Fetch complete, setting loading to false');
            setLoading(false);
        }
    }, [getAccessTokenSilently, isAuthenticated, authLoading]);

    useEffect(() => {
        // Only fetch accounts if user is authenticated and Auth0 is not loading
        if (isAuthenticated && !authLoading) {
            fetchAccounts();
        } else if (!authLoading) {
            setLoading(false);
        }
    }, [fetchAccounts, isAuthenticated, authLoading]);

    const handlePlaidSuccess = (data) => {
        console.log('Plaid connection successful:', data);
        // Refresh accounts after successful connection
        fetchAccounts();
        setSyncResult({
            type: 'success',
            message: `Successfully connected ${data.accounts?.length || 0} accounts from ${data.institution?.name || 'your bank'}`
        });
    };

    const handlePlaidError = (error) => {
        console.error('Plaid connection error:', error);
        setError(error.message || 'Failed to connect bank account');
    };

    const syncTransactions = async () => {
        if (!isAuthenticated) {
            setError('Please log in to sync transactions');
            return;
        }

        try {
            setSyncing(true);
            setSyncResult(null);

            const token = await getAccessTokenSilently({
                authorizationParams: {
                    audience: process.env.REACT_APP_AUTH0_AUDIENCE,
                },
            });

            const response = await fetch(`${process.env.REACT_APP_API_URL}/plaid/sync-transactions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    // Sync last 30 days by default
                    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    end_date: new Date().toISOString().split('T')[0]
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to sync transactions');
            }

            const data = await response.json();
            setSyncResult({
                type: 'success',
                message: `Successfully synced ${data.data.synced} new transactions from ${data.data.total} total transactions`
            });

            // Update last sync time
            setLastSync(data.data.lastSync);
        } catch (error) {
            console.error('Sync error:', error);
            setSyncResult({
                type: 'error',
                message: error.message
            });
        } finally {
            setSyncing(false);
        }
    };

    const disconnectAccount = async () => {
        if (!isAuthenticated) {
            setError('Please log in to disconnect account');
            return;
        }

        try {
            setLoading(true);

            const token = await getAccessTokenSilently({
                authorizationParams: {
                    audience: process.env.REACT_APP_AUTH0_AUDIENCE,
                },
            });

            const response = await fetch(`${process.env.REACT_APP_API_URL}/plaid/disconnect`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to disconnect account');
            }

            // Reset state
            setAccounts([]);
            setInstitution(null);
            setLastSync(null);
            setDisconnectModal(false);
            setSyncResult({
                type: 'info',
                message: 'Bank account disconnected successfully'
            });
        } catch (error) {
            console.error('Disconnect error:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount, currency = 'CAD') => {
        return new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: currency || 'CAD'
        }).format(amount);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-CA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getAccountTypeIcon = (type, subtype) => {
        if (type === 'depository') {
            return subtype === 'checking' ? 'university' : 'piggy-bank';
        }
        if (type === 'credit') return 'credit-card';
        if (type === 'investment') return 'chart-line';
        return 'wallet';
    };

    const getAccountTypeBadge = (type, subtype) => {
        const color = {
            'depository': 'primary',
            'credit': 'warning',
            'investment': 'success',
            'loan': 'danger'
        }[type] || 'secondary';

        return (
            <Badge color={color} pill>
                {subtype || type}
            </Badge>
        );
    };

    // Show authentication required message if not logged in
    if (!isAuthenticated && !authLoading) {
        return (
            <Container className="py-5 text-center">
                <Alert color="info">
                    <h4>Authentication Required</h4>
                    <p>Please log in to view your connected bank accounts.</p>
                </Alert>
            </Container>
        );
    }

    // Show loading spinner while Auth0 is loading or while fetching accounts
    if (authLoading || (loading && accounts.length === 0)) {
        return (
            <Loading />


        );
    }

    return (
        <Container fluid className="py-4">
            {/* Header */}
            <Row className="mb-4">
                <Col>
                    <div className="d-flex justify-content-between align-items-center">
                        <div>
                            <h1 className="h3">Connected Accounts</h1>
                            <p className="text-muted">Manage your bank account connections and sync transactions</p>
                        </div>
                        {accounts.length > 0 && (
                            <div className="d-flex gap-2">
                                <Button
                                    color="success"
                                    onClick={syncTransactions}
                                    disabled={syncing}
                                    className="me-2"
                                >
                                    {syncing ? (
                                        <>
                                            <Spinner size="sm" className="me-2" />
                                            Syncing...
                                        </>
                                    ) : (
                                        <>
                                            <FontAwesomeIcon icon="sync" className="me-2" />
                                            Sync Transactions
                                        </>
                                    )}
                                </Button>
                                <Button
                                    color="outline-danger"
                                    onClick={() => setDisconnectModal(true)}
                                >
                                    <FontAwesomeIcon icon="unlink" className="me-2" />
                                    Disconnect
                                </Button>
                            </div>
                        )}
                    </div>
                </Col>
            </Row>

            {/* Error Alert */}
            {error && (
                <Alert color="danger" className="mb-4">
                    <div className="d-flex justify-content-between align-items-start">
                        <div>
                            <strong>Error:</strong> {error}
                        </div>
                        <Button
                            color="link"
                            size="sm"
                            className="p-0 text-danger"
                            onClick={() => setError(null)}
                        >
                            <FontAwesomeIcon icon="times" />
                        </Button>
                    </div>
                </Alert>
            )}

            {/* Sync Result Alert */}
            {syncResult && (
                <Alert
                    color={syncResult.type === 'error' ? 'danger' : syncResult.type === 'success' ? 'success' : 'info'}
                    className="mb-4"
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <div>
                            {syncResult.message}
                        </div>
                        <Button
                            color="link"
                            size="sm"
                            className="p-0"
                            onClick={() => setSyncResult(null)}
                        >
                            <FontAwesomeIcon icon="times" />
                        </Button>
                    </div>
                </Alert>
            )}

            {/* No Accounts Connected */}
            {accounts.length === 0 && !loading && (
                <Card className="text-center py-5">
                    <CardBody>
                        <FontAwesomeIcon icon="university" size="3x" className="text-muted mb-4" />
                        <h4>No Bank Accounts Connected</h4>
                        <p className="text-muted mb-4">
                            Connect your bank account to automatically import transactions and get a complete view of your finances.
                        </p>
                        <div className="d-flex justify-content-center">
                            <PlaidLink
                                onSuccess={handlePlaidSuccess}
                                onError={handlePlaidError}
                            />
                        </div>
                        <div className="mt-4">
                            <small className="text-muted">
                                <FontAwesomeIcon icon="shield-alt" className="me-1" />
                                Your data is encrypted and secure. Prosper Finance uses bank-level security.
                            </small>
                        </div>
                    </CardBody>
                </Card>
            )}

            {/* Connected Accounts */}
            {accounts.length > 0 && (
                <>
                    {/* Institution Header */}
                    <Card className="mb-4">
                        <CardBody>
                            <Row className="align-items-center">
                                <Col md={8}>
                                    <div className="d-flex align-items-center">
                                        <FontAwesomeIcon icon="university" size="2x" className="text-primary me-3" />
                                        <div>
                                            <h5 className="mb-1">{institution}</h5>
                                            <small className="text-muted">
                                                Connected • {accounts.length} account{accounts.length !== 1 ? 's' : ''}
                                                {lastSync && (
                                                    <> • Last sync: {formatDate(lastSync)}</>
                                                )}
                                            </small>
                                        </div>
                                    </div>
                                </Col>
                                <Col md={4} className="text-end">
                                    <Badge color="success" className="me-2">
                                        <FontAwesomeIcon icon="check-circle" className="me-1" />
                                        Active
                                    </Badge>
                                </Col>
                            </Row>
                        </CardBody>
                    </Card>

                    {/* Accounts Table */}
                    <Card>
                        <CardBody>
                            <Table responsive hover>
                                <thead>
                                    <tr>
                                        <th>Account</th>
                                        <th>Type</th>
                                        <th>Available Balance</th>
                                        <th>Current Balance</th>
                                        <th>Account Number</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {accounts.map((account) => (
                                        <tr key={account.account_id}>
                                            <td>
                                                <div className="d-flex align-items-center">
                                                    <FontAwesomeIcon
                                                        icon={getAccountTypeIcon(account.type, account.subtype)}
                                                        className="me-2 text-muted"
                                                    />
                                                    <div>
                                                        <div className="font-weight-bold">
                                                            {account.name}
                                                        </div>
                                                        {account.official_name && account.official_name !== account.name && (
                                                            <small className="text-muted">
                                                                {account.official_name}
                                                            </small>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                {getAccountTypeBadge(account.type, account.subtype)}
                                            </td>
                                            <td>
                                                {account.balances.available !== null ? (
                                                    <span className="font-weight-bold">
                                                        {formatCurrency(account.balances.available, account.balances.currency)}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted">—</span>
                                                )}
                                            </td>
                                            <td>
                                                {account.balances.current !== null ? (
                                                    <span className="font-weight-bold">
                                                        {formatCurrency(account.balances.current, account.balances.currency)}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted">—</span>
                                                )}
                                            </td>
                                            <td>
                                                <code className="text-muted">
                                                    ****{account.mask}
                                                </code>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </CardBody>
                    </Card>

                    {/* Add Another Account */}
                    <Card className="mt-4">
                        <CardBody className="text-center">
                            <h6>Want to connect another bank?</h6>
                            <p className="text-muted mb-3">
                                You can connect multiple banks to get a complete view of your finances.
                            </p>
                            <div className="d-flex justify-content-center">
                                <PlaidLink
                                    onSuccess={handlePlaidSuccess}
                                    onError={handlePlaidError}
                                />
                            </div>

                        </CardBody>
                    </Card>
                </>
            )}

            {/* Disconnect Confirmation Modal */}
            <Modal isOpen={disconnectModal} toggle={() => setDisconnectModal(!disconnectModal)}>
                <ModalHeader toggle={() => setDisconnectModal(!disconnectModal)}>
                    Disconnect Bank Account
                </ModalHeader>
                <ModalBody>
                    <Alert color="warning">
                        <FontAwesomeIcon icon="exclamation-triangle" className="me-2" />
                        <strong>Warning:</strong> This action will disconnect all your bank accounts.
                    </Alert>
                    <p>
                        Are you sure you want to disconnect your bank account from <strong>{institution}</strong>?
                    </p>
                    <p className="text-muted">
                        This will stop automatic transaction syncing. Your existing transaction data will not be deleted.
                    </p>
                </ModalBody>
                <ModalFooter>
                    <Button color="secondary" onClick={() => setDisconnectModal(false)}>
                        Cancel
                    </Button>
                    <Button color="danger" onClick={disconnectAccount} disabled={loading}>
                        {loading ? (
                            <>
                                <Spinner size="sm" className="me-2" />
                                Disconnecting...
                            </>
                        ) : (
                            'Disconnect Account'
                        )}
                    </Button>
                </ModalFooter>
            </Modal>
        </Container>
    );
};

export default ConnectedAccounts;