const { PlaidApi, PlaidEnvironments, Configuration } = require('plaid');

// Plaid configuration
const configuration = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
    baseOptions: {
        headers: {
            'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
            'PLAID-SECRET': process.env.PLAID_SECRET,
            'Plaid-Version': '2020-09-14',
        },
    },
});

const plaidClient = new PlaidApi(configuration);

// Plaid products and country codes (required for link token)
// identity, assets & liabilities could be added later
const PLAID_PRODUCTS = process.env.PLAID_PRODUCTS
    ? process.env.PLAID_PRODUCTS.split(',')
    : ['transactions', 'accounts'];

const PLAID_COUNTRY_CODES = process.env.PLAID_COUNTRY_CODES
    ? process.env.PLAID_COUNTRY_CODES.split(',')
    : ['CA'];

// Validate required environment variables
const requiredEnvVars = ['PLAID_CLIENT_ID', 'PLAID_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Missing required Plaid environment variables:', missingVars);
    console.error('Please check your .env file and ensure all Plaid credentials are set.');
}

console.log('🔧 Plaid Configuration:', {
    environment: process.env.PLAID_ENV || 'sandbox',
    products: PLAID_PRODUCTS,
    countryCodes: PLAID_COUNTRY_CODES,
    hasClientId: !!process.env.PLAID_CLIENT_ID,
    hasSecret: !!process.env.PLAID_SECRET
});

module.exports = {
    plaidClient,
    PLAID_PRODUCTS,
    PLAID_COUNTRY_CODES,
    PLAID_ENV: process.env.PLAID_ENV || 'sandbox'
};