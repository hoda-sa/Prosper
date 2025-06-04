require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Import database configuration
const { connectDB, closeDB } = require('./config/database');

// Import route handlers
const transactionRoutes = require('./routes/transactions');
const budgetRoutes = require('./routes/budgets');
const forecastRoutes = require('./routes/forecasts');
const categoryRoutes = require('./routes/categories');
const userRoutes = require('./routes/users');
const plaidRoutes = require('./routes/plaid');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');

// Initialize Express app
const app = express();

// Port configuration
const PORT = process.env.PORT || 5000;

// Rate limiting configuration
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});

// CORS configuration
const corsOptions = {
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'http://localhost:3001', // For development
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Middleware setup
app.use(helmet()); // Security headers
app.use(compression()); // Gzip compression
app.use(cors(corsOptions)); // Cross-origin resource sharing
app.use(morgan('combined')); // HTTP request logging
app.use(limiter); // Rate limiting
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        version: '1.0.0'
    });
});

// API routes
app.use('/api/transactions', authMiddleware, transactionRoutes);
app.use('/api/budgets', authMiddleware, budgetRoutes);
app.use('/api/forecasts', authMiddleware, forecastRoutes);
app.use('/api/categories', authMiddleware, categoryRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/plaid', authMiddleware, plaidRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Prosper Application - backend',
        version: '1.0.0',
        status: 'Active',
        endpoints: {
            health: '/health',
            transactions: '/api/transactions',
            budgets: '/api/budgets',
            forecasts: '/api/forecasts',
            categories: '/api/categories',
            users: '/api/users',
            plaid: '/api/plaid'
        }
    });
});

// 404 handler for unmatched routes
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        message: `The requested endpoint ${req.originalUrl} does not exist`
    });
});

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown handlers
const gracefulShutdown = async (signal) => {
    console.log(`\n🔄 Received ${signal}. Starting graceful shutdown...`);

    if (global.server) {
        // Set a shorter timeout for development
        const shutdownTimeout = setTimeout(() => {
            console.log('⚠️ Graceful shutdown timeout reached, forcing exit...');
            process.exit(1);
        }, 5000); // Reduced from 30 seconds to 5 seconds

        try {
            // Close the HTTP server
            await new Promise((resolve, reject) => {
                global.server.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('✅ HTTP server closed');
                        resolve();
                    }
                });
            });

            // Close database connection
            await closeDB();

            // Clear the timeout since we're shutting down cleanly
            clearTimeout(shutdownTimeout);

            console.log('👋 Process terminated gracefully');
            process.exit(0);

        } catch (error) {
            console.error('❌ Error during graceful shutdown:', error.message);
            clearTimeout(shutdownTimeout);
            process.exit(1);
        }
    } else {
        console.log('No server instance found, exiting...');
        process.exit(0);
    }
};

// Start server
const startServer = async () => {
    try {
        // Connect to database first
        await connectDB();

        // Start HTTP server
        const server = app.listen(PORT, () => {
            console.log('\n🚀 Server Status:');
            console.log(`   • Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`   • Port: ${PORT}`);
            console.log(`   • URL: http://localhost:${PORT}`);
            console.log(`   • Health Check: http://localhost:${PORT}/health`);
            console.log('\n📡 Available Endpoints:');
            console.log(`   • GET  /health - Health check`);
            console.log(`   • GET  /api/transactions - Get user transactions`);
            console.log(`   • POST /api/transactions - Create new transaction`);
            console.log(`   • GET  /api/budgets - Get user budgets`);
            console.log(`   • GET  /api/forecasts - Get financial forecasts`);
            console.log('\n🔐 Auth0 Integration: Enabled');
            console.log('✅ Server is ready to accept connections!\n');
        });

        // Store server reference for graceful shutdown
        global.server = server;

        // Setup graceful shutdown
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
};

// Start the application
startServer();

module.exports = app;