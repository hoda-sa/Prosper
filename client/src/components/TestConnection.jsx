import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Alert, Button, Card, CardBody, Container } from 'reactstrap';

const TestConnection = () => {
    const { getAccessTokenSilently, isAuthenticated, user } = useAuth0();
    const [testResults, setTestResults] = useState({});
    const [testing, setTesting] = useState(false);

    const runTests = async () => {
        setTesting(true);
        const results = {};

        // Test 1: Backend Health Check
        try {
            const response = await fetch('http://localhost:5001/health');
            const data = await response.json();
            results.backendHealth = { success: true, data };
        } catch (error) {
            results.backendHealth = { success: false, error: error.message };
        }

        // Test 2: Auth0 Token
        if (isAuthenticated) {
            try {
                const token = await getAccessTokenSilently({
                    authorizationParams: {
                        audience: process.env.REACT_APP_AUTH0_AUDIENCE,
                    },
                });
                results.auth0Token = { success: true, hasToken: !!token, tokenLength: token?.length };
            } catch (error) {
                results.auth0Token = { success: false, error: error.message };
            }

            // Test 3: Protected API Call
            try {
                const token = await getAccessTokenSilently({
                    authorizationParams: {
                        audience: process.env.REACT_APP_AUTH0_AUDIENCE,
                    },
                });

                const response = await fetch('http://localhost:5001/api/users/profile', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    results.protectedAPI = { success: true, data };
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    results.protectedAPI = {
                        success: false,
                        status: response.status,
                        error: errorData.message || response.statusText
                    };
                }
            } catch (error) {
                results.protectedAPI = { success: false, error: error.message };
            }
        }

        setTestResults(results);
        setTesting(false);
    };

    useEffect(() => {
        if (isAuthenticated) {
            runTests();
        }
    }, [isAuthenticated]);

    if (!isAuthenticated) {
        return (
            <Container className="py-5">
                <Alert color="info">
                    Please log in to test the backend connection.
                </Alert>
            </Container>
        );
    }

    return (
        <Container className="py-4">
            <h2>Backend Connection Test</h2>
            <p>Testing connection between frontend and backend...</p>

            <Button color="primary" onClick={runTests} disabled={testing} className="mb-4">
                {testing ? 'Testing...' : 'Run Tests Again'}
            </Button>

            {/* User Info */}
            <Card className="mb-3">
                <CardBody>
                    <h5>User Information</h5>
                    <pre>{JSON.stringify({
                        name: user.name,
                        email: user.email,
                        auth0Id: user.sub
                    }, null, 2)}</pre>
                </CardBody>
            </Card>

            {/* Environment Variables */}
            <Card className="mb-3">
                <CardBody>
                    <h5>Environment Configuration</h5>
                    <pre>{JSON.stringify({
                        REACT_APP_API_URL: process.env.REACT_APP_API_URL,
                        REACT_APP_AUTH0_DOMAIN: process.env.REACT_APP_AUTH0_DOMAIN,
                        REACT_APP_AUTH0_CLIENT_ID: process.env.REACT_APP_AUTH0_CLIENT_ID ? 'SET' : 'NOT SET',
                        REACT_APP_AUTH0_AUDIENCE: process.env.REACT_APP_AUTH0_AUDIENCE
                    }, null, 2)}</pre>
                </CardBody>
            </Card>

            {/* Test Results */}
            {Object.keys(testResults).length > 0 && (
                <>
                    <h5>Test Results</h5>

                    {/* Backend Health */}
                    <Card className="mb-3">
                        <CardBody>
                            <h6>1. Backend Health Check</h6>
                            <Alert color={testResults.backendHealth?.success ? 'success' : 'danger'}>
                                {testResults.backendHealth?.success ? (
                                    <>
                                        ✅ Backend is running!
                                        <pre className="mt-2 mb-0">{JSON.stringify(testResults.backendHealth.data, null, 2)}</pre>
                                    </>
                                ) : (
                                    <>❌ Backend connection failed: {testResults.backendHealth?.error}</>
                                )}
                            </Alert>
                        </CardBody>
                    </Card>

                    {/* Auth0 Token */}
                    <Card className="mb-3">
                        <CardBody>
                            <h6>2. Auth0 Token Test</h6>
                            <Alert color={testResults.auth0Token?.success ? 'success' : 'danger'}>
                                {testResults.auth0Token?.success ? (
                                    <>✅ Auth0 token obtained successfully (Length: {testResults.auth0Token.tokenLength})</>
                                ) : (
                                    <>❌ Auth0 token error: {testResults.auth0Token?.error}</>
                                )}
                            </Alert>
                        </CardBody>
                    </Card>

                    {/* Protected API */}
                    <Card className="mb-3">
                        <CardBody>
                            <h6>3. Protected API Call</h6>
                            <Alert color={testResults.protectedAPI?.success ? 'success' : 'danger'}>
                                {testResults.protectedAPI?.success ? (
                                    <>
                                        ✅ Protected API call successful!
                                        <pre className="mt-2 mb-0">{JSON.stringify(testResults.protectedAPI.data, null, 2)}</pre>
                                    </>
                                ) : (
                                    <>
                                        ❌ Protected API call failed:
                                        {testResults.protectedAPI?.status && ` Status: ${testResults.protectedAPI.status}`}
                                        <br />Error: {testResults.protectedAPI?.error}
                                    </>
                                )}
                            </Alert>
                        </CardBody>
                    </Card>
                </>
            )}
        </Container>
    );
};

export default TestConnection;