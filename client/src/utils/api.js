// utils/api.js
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Generic API call function
export const apiCall = async (endpoint, options = {}, getAccessTokenSilently) => {
    try {
        const token = await getAccessTokenSilently({
            authorizationParams: {
                audience: process.env.REACT_APP_AUTH0_AUDIENCE,
            },
        });

        const config = {
            method: 'GET',
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        const response = await fetch(`${API_BASE}${endpoint}`, config);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`API call failed for ${endpoint}:`, error);
        throw error;
    }
};

// User API calls
export const userAPI = {
    getProfile: (getAccessTokenSilently) =>
        apiCall('/users/profile', {}, getAccessTokenSilently),

    getDashboard: (getAccessTokenSilently, period = 'month') =>
        apiCall(`/users/dashboard?period=${period}`, {}, getAccessTokenSilently),

    updateProfile: (getAccessTokenSilently, profileData) =>
        apiCall('/users/profile', {
            method: 'PUT',
            body: profileData
        }, getAccessTokenSilently),

    getSettings: (getAccessTokenSilently) =>
        apiCall('/users/settings', {}, getAccessTokenSilently),

    updateSettings: (getAccessTokenSilently, settings) =>
        apiCall('/users/settings', {
            method: 'PUT',
            body: settings
        }, getAccessTokenSilently)
};

// Transaction API calls
export const transactionAPI = {
    getTransactions: (getAccessTokenSilently, params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return apiCall(`/transactions?${queryString}`, {}, getAccessTokenSilently);
    },

    createTransaction: (getAccessTokenSilently, transactionData) =>
        apiCall('/transactions', {
            method: 'POST',
            body: transactionData
        }, getAccessTokenSilently),

    updateTransaction: (getAccessTokenSilently, id, transactionData) =>
        apiCall(`/transactions/${id}`, {
            method: 'PUT',
            body: transactionData
        }, getAccessTokenSilently),

    deleteTransaction: (getAccessTokenSilently, id) =>
        apiCall(`/transactions/${id}`, {
            method: 'DELETE'
        }, getAccessTokenSilently),

    getTransactionSummary: (getAccessTokenSilently, params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return apiCall(`/transactions/summary?${queryString}`, {}, getAccessTokenSilently);
    }
};

// Budget API calls
export const budgetAPI = {
    getBudgets: (getAccessTokenSilently, params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return apiCall(`/budgets?${queryString}`, {}, getAccessTokenSilently);
    },

    createBudget: (getAccessTokenSilently, budgetData) =>
        apiCall('/budgets', {
            method: 'POST',
            body: budgetData
        }, getAccessTokenSilently),

    updateBudget: (getAccessTokenSilently, id, budgetData) =>
        apiCall(`/budgets/${id}`, {
            method: 'PUT',
            body: budgetData
        }, getAccessTokenSilently),

    deleteBudget: (getAccessTokenSilently, id) =>
        apiCall(`/budgets/${id}`, {
            method: 'DELETE'
        }, getAccessTokenSilently),

    getBudgetSummary: (getAccessTokenSilently) =>
        apiCall('/budgets/summary', {}, getAccessTokenSilently)
};

// Category API calls
export const categoryAPI = {
    getCategories: (getAccessTokenSilently, params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return apiCall(`/categories?${queryString}`, {}, getAccessTokenSilently);
    },

    createCategory: (getAccessTokenSilently, categoryData) =>
        apiCall('/categories', {
            method: 'POST',
            body: categoryData
        }, getAccessTokenSilently),

    initializeCategories: (getAccessTokenSilently) =>
        apiCall('/categories/initialize', {
            method: 'POST'
        }, getAccessTokenSilently),

    getCategoryStats: (getAccessTokenSilently, period = 'month') =>
        apiCall(`/categories/stats?period=${period}`, {}, getAccessTokenSilently),

    getSuggestions: (getAccessTokenSilently, description, type) =>
        apiCall(`/categories/suggest?description=${encodeURIComponent(description)}&type=${type}`, {}, getAccessTokenSilently)
};

// Plaid API calls
export const plaidAPI = {
    createLinkToken: (getAccessTokenSilently) =>
        apiCall('/plaid/create-link-token', {
            method: 'POST'
        }, getAccessTokenSilently),

    exchangePublicToken: (getAccessTokenSilently, public_token, metadata) =>
        apiCall('/plaid/exchange-public-token', {
            method: 'POST',
            body: { public_token, metadata }
        }, getAccessTokenSilently),

    getAccounts: (getAccessTokenSilently) =>
        apiCall('/plaid/accounts', {}, getAccessTokenSilently),

    syncTransactions: (getAccessTokenSilently, params = {}) =>
        apiCall('/plaid/sync-transactions', {
            method: 'POST',
            body: params
        }, getAccessTokenSilently),

    disconnect: (getAccessTokenSilently) =>
        apiCall('/plaid/disconnect', {
            method: 'DELETE'
        }, getAccessTokenSilently)
};