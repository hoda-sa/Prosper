const express = require('express');
const { body, validationResult } = require('express-validator');
const { plaidClient, PLAID_PRODUCTS, PLAID_COUNTRY_CODES } = require('../config/plaid');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
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

// Helper function to find or create user
const findOrCreateUser = async (userId, userInfo = {}) => {
    try {
        // Try to find existing user
        let user = await User.findByAuth0Id(userId);

        if (!user) {
            console.log(`🔄 Creating new user for Auth0 ID: ${userId}`);
            console.log('📧 User info received:', userInfo);

            // Extract email from Auth0 token or use a valid placeholder
            let email = userInfo.email;

            // If no email provided or invalid, create a valid temporary email
            if (!email || !email.includes('@') || email.includes('|')) {
                // Create a valid email format that will definitely pass validation
                const timestamp = Date.now();
                const randomId = Math.random().toString(36).substring(2, 8);
                email = `tempuser.${timestamp}.${randomId}@example.com`;
            }

            // Create new user with basic info
            const userData = {
                auth0Id: userId,
                email: email,
                name: userInfo.name || 'User',
                isActive: true,
                createdAt: new Date(),
                connectedAccounts: {
                    plaid: {
                        accessToken: null,
                        itemId: null,
                        connectedAt: null,
                        lastSync: null,
                        isActive: false
                    },
                    bank: {
                        institutionName: null,
                        accountCount: 0,
                        lastSync: null,
                        isActive: false
                    }
                }
            };

            console.log('👤 Creating user with data:', {
                auth0Id: userData.auth0Id,
                email: userData.email,
                name: userData.name
            });

            user = new User(userData);
            await user.save();
            console.log(`✅ Created new user: ${user._id}`);
        }

        return user;
    } catch (error) {
        console.error('❌ Error in findOrCreateUser:', error);
        throw error;
    }
};

// POST /api/plaid/create-link-token - Create Plaid Link token
router.post('/create-link-token',
    asyncHandler(async (req, res) => {
        const userId = req.user.id;

        try {
            console.log(`🔄 Creating link token for user: ${userId}`);
            console.log('🔍 Auth user data:', {
                id: req.user.id,
                email: req.user.email,
                name: req.user.name,
                sub: req.user.sub
            });

            // Find or create user
            const user = await findOrCreateUser(userId, {
                email: req.user.email,
                name: req.user.name
            });

            if (!user) {
                throw new AppError('Failed to initialize user', 500, 'USER_INIT_ERROR');
            }

            const linkTokenRequest = {
                user: {
                    client_user_id: userId,
                    legal_name: user.name,
                    email_address: user.email,
                },
                client_name: 'Prosper Finance',
                products: PLAID_PRODUCTS,
                country_codes: PLAID_COUNTRY_CODES,
                language: 'en',
                webhook: `${process.env.BACKEND_URL || 'http://localhost:5001'}/api/plaid/webhook`,
                account_filters: {
                    depository: {
                        account_subtypes: ['checking', 'savings'],
                    },
                    credit: {
                        account_subtypes: ['credit card'],
                    },
                },
            };

            console.log('🔄 Making Plaid API call to create link token...');
            const response = await plaidClient.linkTokenCreate(linkTokenRequest);
            console.log('✅ Plaid link token created successfully');

            sendSuccess(res, {
                link_token: response.data.link_token,
                expiration: response.data.expiration,
                request_id: response.data.request_id
            }, 'Link token created successfully');

        } catch (error) {
            console.error('Plaid Link Token Error:', error);
            throw new AppError('Failed to create Plaid link token', 500, 'PLAID_LINK_ERROR');
        }
    })
);

// POST /api/plaid/exchange-public-token - Exchange public token for access token
router.post('/exchange-public-token',
    body('public_token')
        .notEmpty()
        .withMessage('Public token is required'),

    body('metadata')
        .optional()
        .isObject()
        .withMessage('Metadata must be an object'),

    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { public_token, metadata } = req.body;

        try {
            console.log(`🔄 Exchanging public token for user: ${userId}`);

            // Exchange public token for access token
            const exchangeResponse = await plaidClient.itemPublicTokenExchange({
                public_token: public_token,
            });

            const { access_token, item_id } = exchangeResponse.data;
            console.log('✅ Token exchange successful');

            // Get account information
            const accountsResponse = await plaidClient.accountsGet({
                access_token: access_token,
            });

            const accounts = accountsResponse.data.accounts;
            console.log(`✅ Retrieved ${accounts.length} accounts`);

            // Find or create user
            const user = await findOrCreateUser(userId, {
                email: req.user.email,
                name: req.user.name
            });

            // Update user with Plaid connection info
            user.connectedAccounts.plaid = {
                accessToken: access_token,
                itemId: item_id,
                connectedAt: new Date(),
                lastSync: new Date(),
                isActive: true
            };

            user.connectedAccounts.bank = {
                institutionName: metadata?.institution?.name || 'Connected Bank',
                accountCount: accounts.length,
                lastSync: new Date(),
                isActive: true
            };

            await user.save();
            console.log('✅ User updated with Plaid connection');

            // Store account information
            const accountData = accounts.map(account => ({
                userId: userId,
                plaidAccountId: account.account_id,
                name: account.name,
                officialName: account.official_name,
                type: account.type,
                subtype: account.subtype,
                mask: account.mask,
                balances: account.balances,
                institutionName: metadata?.institution?.name || 'Unknown'
            }));

            console.log('Connected accounts:', accountData.length);

            sendSuccess(res, {
                item_id: item_id,
                accounts: accountData,
                institution: metadata?.institution
            }, 'Bank account connected successfully');

        } catch (error) {
            console.error('Plaid Token Exchange Error:', error);
            throw new AppError('Failed to connect bank account', 500, 'PLAID_EXCHANGE_ERROR');
        }
    })
);

// GET /api/plaid/accounts - Get connected accounts
router.get('/accounts',
    asyncHandler(async (req, res) => {
        const userId = req.user.id;

        try {
            console.log(`🔄 Fetching accounts for user: ${userId}`);

            // Find or create user
            const user = await findOrCreateUser(userId, {
                email: req.user.email,
                name: req.user.name
            });

            // Check if user has Plaid connection
            if (!user.connectedAccounts.plaid.accessToken) {
                console.log('ℹ️ No Plaid accounts connected for user');
                throw new AppError('No bank accounts connected', 404, 'NO_ACCOUNTS_CONNECTED');
            }

            console.log('🔄 Making Plaid API call to get accounts...');
            const accountsResponse = await plaidClient.accountsGet({
                access_token: user.connectedAccounts.plaid.accessToken,
            });

            const accounts = accountsResponse.data.accounts.map(account => ({
                account_id: account.account_id,
                name: account.name,
                official_name: account.official_name,
                type: account.type,
                subtype: account.subtype,
                mask: account.mask,
                balances: {
                    available: account.balances.available,
                    current: account.balances.current,
                    limit: account.balances.limit,
                    currency: account.balances.iso_currency_code
                }
            }));

            console.log(`✅ Retrieved ${accounts.length} accounts`);

            sendSuccess(res, {
                accounts,
                institution: user.connectedAccounts.bank.institutionName,
                lastSync: user.connectedAccounts.plaid.lastSync
            }, 'Accounts retrieved successfully');

        } catch (error) {
            console.error('Plaid Accounts Error:', error);
            // If it's already an AppError (like NO_ACCOUNTS_CONNECTED), re-throw it
            if (error.isOperational) {
                throw error;
            }
            throw new AppError('Failed to fetch accounts', 500, 'PLAID_ACCOUNTS_ERROR');
        }
    })
);

// POST /api/plaid/sync-transactions - Sync transactions from Plaid
router.post('/sync-transactions',
    body('start_date')
        .optional()
        .isISO8601()
        .withMessage('Start date must be valid ISO date'),

    body('end_date')
        .optional()
        .isISO8601()
        .withMessage('End date must be valid ISO date'),

    checkValidation,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { start_date, end_date } = req.body;

        try {
            console.log(`🔄 Syncing transactions for user: ${userId}`);

            const user = await findOrCreateUser(userId, {
                email: req.user.email,
                name: req.user.name
            });

            if (!user.connectedAccounts.plaid.accessToken) {
                throw new AppError('No bank accounts connected', 404, 'NO_ACCOUNTS_CONNECTED');
            }

            // Default to last 30 days if no dates provided
            const endDate = end_date ? new Date(end_date) : new Date();
            const startDate = start_date ? new Date(start_date) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            const transactionsResponse = await plaidClient.transactionsGet({
                access_token: user.connectedAccounts.plaid.accessToken,
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0]
            });

            const plaidTransactions = transactionsResponse.data.transactions;
            const accounts = transactionsResponse.data.accounts;

            // Create account lookup map
            const accountMap = {};
            accounts.forEach(account => {
                accountMap[account.account_id] = account;
            });

            // Convert Plaid transactions to our format
            const newTransactions = [];
            const duplicateCheck = new Set();

            for (const plaidTx of plaidTransactions) {
                // Skip if already processed
                if (duplicateCheck.has(plaidTx.transaction_id)) continue;
                duplicateCheck.add(plaidTx.transaction_id);

                // Check if transaction already exists
                const existingTx = await Transaction.findOne({
                    userId,
                    externalId: plaidTx.transaction_id
                });

                if (existingTx) continue;

                const account = accountMap[plaidTx.account_id];

                // Categorize transaction
                const category = await categorizeTransaction(plaidTx.category, plaidTx.merchant_name);

                // Normalize account type to match your model's enum values
                const normalizeAccountType = (subtype) => {
                    const typeMapping = {
                        'credit card': 'credit',
                        'checking': 'checking',
                        'savings': 'savings',
                        'investment': 'investment',
                        'loan': 'loan',
                        'mortgage': 'mortgage'
                    };
                    return typeMapping[subtype] || 'other';
                };

                const transactionData = {
                    userId,
                    type: plaidTx.amount > 0 ? 'expense' : 'income',
                    amount: Math.abs(plaidTx.amount),
                    description: plaidTx.merchant_name || plaidTx.name || 'Bank Transaction',
                    category: category.name,
                    date: new Date(plaidTx.date),
                    source: 'plaid',
                    externalId: plaidTx.transaction_id,
                    status: 'completed',
                    account: {
                        accountId: plaidTx.account_id,
                        accountName: account.name,
                        institutionName: user.connectedAccounts.bank.institutionName,
                        accountType: normalizeAccountType(account.subtype)
                    },
                    merchant: plaidTx.merchant_name ? {
                        name: plaidTx.merchant_name,
                        location: plaidTx.location ? {
                            address: plaidTx.location.address,
                            city: plaidTx.location.city,
                            state: plaidTx.location.region,
                            country: plaidTx.location.country
                        } : null
                    } : null,
                    metadata: {
                        originalData: {
                            plaidCategory: plaidTx.category,
                            plaidCategoryId: plaidTx.category_id,
                            pending: plaidTx.pending
                        }
                    }
                };

                const transaction = new Transaction(transactionData);
                await transaction.save();
                newTransactions.push(transaction);

                // Update category usage
                if (category.model) {
                    await category.model.updateUsage(transaction.amount);
                }
            }

            // Update user's last sync time
            user.connectedAccounts.plaid.lastSync = new Date();
            await user.save();

            sendSuccess(res, {
                synced: newTransactions.length,
                total: plaidTransactions.length,
                transactions: newTransactions.slice(0, 10), // Return first 10 for preview
                lastSync: user.connectedAccounts.plaid.lastSync
            }, `Successfully synced ${newTransactions.length} new transactions`);

        } catch (error) {
            console.error('Plaid Sync Error:', error);
            throw new AppError('Failed to sync transactions', 500, 'PLAID_SYNC_ERROR');
        }
    })
);

// DELETE /api/plaid/disconnect - Disconnect Plaid account
router.delete('/disconnect',
    asyncHandler(async (req, res) => {
        const userId = req.user.id;

        try {
            console.log(`🔄 Disconnecting Plaid for user: ${userId}`);

            const user = await findOrCreateUser(userId, {
                email: req.user.email,
                name: req.user.name
            });

            if (!user.connectedAccounts.plaid.accessToken) {
                throw new AppError('No bank accounts connected', 404, 'NO_ACCOUNTS_CONNECTED');
            }

            // Remove item from Plaid
            await plaidClient.itemRemove({
                access_token: user.connectedAccounts.plaid.accessToken,
            });

            // Clear Plaid connection from user
            user.connectedAccounts.plaid = {
                accessToken: null,
                itemId: null,
                connectedAt: null,
                lastSync: null,
                isActive: false
            };

            user.connectedAccounts.bank = {
                institutionName: null,
                accountCount: 0,
                lastSync: null,
                isActive: false
            };

            await user.save();
            console.log('✅ Plaid disconnected successfully');

            sendSuccess(res, null, 'Bank account disconnected successfully');

        } catch (error) {
            console.error('Plaid Disconnect Error:', error);
            throw new AppError('Failed to disconnect bank account', 500, 'PLAID_DISCONNECT_ERROR');
        }
    })
);

// Helper function to categorize transactions
async function categorizeTransaction(plaidCategories, merchantName) {
    // Map Plaid categories to our categories
    const categoryMapping = {
        'Food and Drink': 'restaurants',
        'Grocery': 'groceries',
        'Gas Stations': 'gas',
        'Transportation': 'transportation',
        'Shops': 'shopping',
        'Recreation': 'entertainment',
        'Healthcare': 'healthcare',
        'Bills': 'utilities',
        'Deposit': 'income',
        'Payroll': 'income'
    };

    let categoryName = 'other';

    if (plaidCategories && plaidCategories.length > 0) {
        const primaryCategory = plaidCategories[0];
        categoryName = categoryMapping[primaryCategory] || 'other';
    }

    // Try to find existing category
    const existingCategory = await Category.findOne({
        name: new RegExp(`^${categoryName}$`, 'i'),
        isSystem: true
    });

    return {
        name: categoryName,
        model: existingCategory
    };
}

// POST /api/plaid/webhook - Plaid webhook endpoint
router.post('/webhook',
    asyncHandler(async (req, res) => {
        const { webhook_type, webhook_code, item_id, error } = req.body;

        console.log('Plaid Webhook:', { webhook_type, webhook_code, item_id });

        // Handle different webhook types
        switch (webhook_type) {
            case 'TRANSACTIONS':
                if (webhook_code === 'DEFAULT_UPDATE') {
                    // New transactions available
                    console.log(`New transactions available for item ${item_id}`);
                    // You could trigger a background sync here
                }
                break;

            case 'ITEM':
                if (webhook_code === 'ERROR') {
                    console.error(`Item error for ${item_id}:`, error);
                    // Handle item errors (e.g., re-authentication needed)
                }
                break;

            case 'ASSETS':
                // Handle asset report webhooks
                break;
        }

        res.status(200).json({ received: true });
    })
);

module.exports = router;