import React, { useState, useCallback, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { useAuth0 } from '@auth0/auth0-react';
import { Button, Alert, Spinner } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const PlaidLink = ({ onSuccess, onError, disabled = false }) => {
    const { getAccessTokenSilently, isAuthenticated, isLoading: authLoading } = useAuth0();
    const [linkToken, setLinkToken] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Create link token function
    const createLinkToken = useCallback(async () => {
        // Don't create token if user is not authenticated
        if (!isAuthenticated || authLoading) {
            console.log('⏸️ Skipping link token creation - user not authenticated');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            console.log('🔄 Creating Plaid link token...');

            const token = await getAccessTokenSilently({
                authorizationParams: {
                    audience: process.env.REACT_APP_AUTH0_AUDIENCE,
                },
            });

            console.log('✅ Got auth token, making API request...');

            const response = await fetch(`${process.env.REACT_APP_API_URL}/plaid/create-link-token`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            console.log('📡 Link token API response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: Failed to create link token`);
            }

            const data = await response.json();
            setLinkToken(data.data.link_token);
            console.log('✅ Link token created successfully');
        } catch (error) {
            console.error('❌ Link token creation error:', error);
            setError(error.message);
            if (onError) onError(error);
        } finally {
            setLoading(false);
        }
    }, [getAccessTokenSilently, onError, isAuthenticated, authLoading]);

    // Create link token when component mounts and user is authenticated
    useEffect(() => {
        if (isAuthenticated && !authLoading) {
            createLinkToken();
        }
    }, [createLinkToken, isAuthenticated, authLoading]);

    // Handle successful connection
    const handleOnSuccess = useCallback(async (public_token, metadata) => {
        if (!isAuthenticated) {
            setError('Authentication required to connect bank account');
            return;
        }

        try {
            setLoading(true);
            console.log('🔄 Exchanging public token...', { metadata });

            const token = await getAccessTokenSilently({
                authorizationParams: {
                    audience: process.env.REACT_APP_AUTH0_AUDIENCE,
                },
            });

            const response = await fetch(`${process.env.REACT_APP_API_URL}/plaid/exchange-public-token`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    public_token,
                    metadata,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to connect bank account');
            }

            const data = await response.json();
            console.log('✅ Bank connected successfully:', data);

            if (onSuccess) {
                onSuccess(data.data);
            }
        } catch (error) {
            console.error('❌ Token exchange error:', error);
            setError(error.message);
            if (onError) onError(error);
        } finally {
            setLoading(false);
        }
    }, [getAccessTokenSilently, onSuccess, onError, isAuthenticated]);

    // Handle Plaid Link errors and exit events
    const handleOnExit = useCallback(async (err, metadata) => {
        console.log('🔄 Plaid Link exit:', { err, metadata });

        if (err) {
            // Handle INVALID_LINK_TOKEN error specifically
            if (err.error_code === 'INVALID_LINK_TOKEN') {
                console.log('🔄 Link token expired, creating new one...');
                setError('Link session expired. Creating a new secure connection...');
                // Create a new link token
                if (isAuthenticated && !authLoading) {
                    await createLinkToken();
                }
                return;
            }

            console.error('❌ Plaid Link error:', err);
            setError(err.error_message || err.display_message || 'Failed to connect bank account');
            if (onError) onError(err);
        }
    }, [onError, createLinkToken, isAuthenticated, authLoading]);

    // Handle Link events (for debugging and analytics)
    const handleOnEvent = useCallback((eventName, metadata) => {
        console.log('📊 Plaid Link event:', eventName, metadata);
    }, []);

    // Configure Plaid Link
    const config = {
        token: linkToken,
        onSuccess: handleOnSuccess,
        onExit: handleOnExit,
        onEvent: handleOnEvent,
    };

    const { open, ready, error: linkError } = usePlaidLink(config);

    // Handle any Link SDK errors
    useEffect(() => {
        if (linkError) {
            console.error('❌ Plaid Link SDK error:', linkError);
            setError(linkError.message || 'Failed to initialize Plaid Link');
        }
    }, [linkError]);

    // Handle button click
    const handleClick = useCallback(() => {
        if (!isAuthenticated) {
            setError('Please log in to connect your bank account');
            return;
        }

        if (ready && linkToken) {
            setError(null); // Clear any previous errors
            open();
        } else if (!linkToken && !loading) {
            createLinkToken();
        }
    }, [ready, linkToken, open, createLinkToken, isAuthenticated, loading]);

    // Don't render if user is not authenticated
    if (!isAuthenticated && !authLoading) {
        return (
            <Alert color="info" className="mb-3">
                Please log in to connect your bank account.
            </Alert>
        );
    }

    // Show loading if Auth0 is still loading
    if (authLoading) {
        return (
            <div className="text-center">
                <Spinner color="primary" />
                <p className="mt-2">Loading...</p>
            </div>
        );
    }

    return (
        <div>
            {error && (
                <Alert color="danger" className="mb-3">
                    <div className="d-flex justify-content-between align-items-start">
                        <div>
                            <strong>Connection Error:</strong>
                            <br />
                            {error}
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

            <Button
                color="primary"
                onClick={handleClick}
                disabled={disabled || loading || (!ready && linkToken)}
                className="d-flex align-items-center justify-content-center"
                style={{ minWidth: '200px' }}
            >
                {loading ? (
                    <>
                        <Spinner size="sm" className="me-2" />
                        {linkToken ? 'Connecting...' : 'Preparing Connection...'}
                    </>
                ) : (
                    <>
                        <FontAwesomeIcon icon="university" className="me-2" />
                        Connect Bank Account
                    </>
                )}
            </Button>

            {linkToken && !ready && !loading && (
                <small className="text-muted d-block mt-2">
                    <FontAwesomeIcon icon="sync" className="me-1" spin />
                    Initializing secure connection...
                </small>
            )}

            {!linkToken && !loading && isAuthenticated && (
                <small className="text-muted d-block mt-2">
                    Click to start secure bank connection
                </small>
            )}
        </div>
    );
};

export default PlaidLink;