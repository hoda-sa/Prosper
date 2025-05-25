// Custom error class for application-specific errors
class AppError extends Error {
    constructor(message, statusCode, errorCode = null) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

// MongoDB/Mongoose error handler
const handleMongoError = (error) => {
    let message = 'Database error occurred';
    let statusCode = 500;
    let errorCode = 'DATABASE_ERROR';

    // Duplicate key error
    if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        message = `${field} already exists`;
        statusCode = 409;
        errorCode = 'DUPLICATE_ENTRY';
    }

    // Validation error
    else if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        message = `Validation failed: ${errors.join(', ')}`;
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
    }

    // Cast error (invalid ObjectId)
    else if (error.name === 'CastError') {
        message = `Invalid ${error.path}: ${error.value}`;
        statusCode = 400;
        errorCode = 'INVALID_ID';
    }

    // Document not found error
    else if (error.name === 'DocumentNotFoundError') {
        message = 'Requested resource not found';
        statusCode = 404;
        errorCode = 'NOT_FOUND';
    }

    return new AppError(message, statusCode, errorCode);
};

// JWT error handler
const handleJWTError = (error) => {
    let message = 'Authentication failed';
    let statusCode = 401;
    let errorCode = 'AUTH_ERROR';

    if (error.name === 'JsonWebTokenError') {
        message = 'Invalid token';
        errorCode = 'INVALID_TOKEN';
    } else if (error.name === 'TokenExpiredError') {
        message = 'Token has expired';
        errorCode = 'TOKEN_EXPIRED';
    }

    return new AppError(message, statusCode, errorCode);
};

// Express validation error handler
const handleValidationError = (error) => {
    const errors = error.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
    }));

    return new AppError('Request validation failed', 400, 'VALIDATION_ERROR', errors);
};

// Development error response
const sendErrorDev = (err, res) => {
    console.error('💥 ERROR DETAILS:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        statusCode: err.statusCode,
        errorCode: err.errorCode
    });

    res.status(err.statusCode || 500).json({
        error: {
            type: err.name || 'Error',
            message: err.message,
            errorCode: err.errorCode || 'UNKNOWN_ERROR',
            statusCode: err.statusCode || 500,
            stack: err.stack,
            timestamp: new Date().toISOString()
        }
    });
};

// Production error response
const sendErrorProd = (err, res) => {
    // Log error for monitoring
    console.error('💥 PRODUCTION ERROR:', {
        message: err.message,
        statusCode: err.statusCode,
        errorCode: err.errorCode,
        timestamp: new Date().toISOString(),
        // Don't log sensitive information in production
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    // Only send operational errors to client
    if (err.isOperational) {
        res.status(err.statusCode || 500).json({
            error: {
                message: err.message,
                errorCode: err.errorCode || 'UNKNOWN_ERROR',
                statusCode: err.statusCode || 500,
                timestamp: new Date().toISOString()
            }
        });
    } else {
        // Don't leak error details for programming errors
        res.status(500).json({
            error: {
                message: 'Something went wrong on our end',
                errorCode: 'INTERNAL_SERVER_ERROR',
                statusCode: 500,
                timestamp: new Date().toISOString()
            }
        });
    }
};

// Main error handling middleware
const errorHandler = (err, req, res, next) => {
    // Skip if response already sent
    if (res.headersSent) {
        return next(err);
    }

    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (err.name === 'ValidationError' || err.code === 11000 || err.name === 'CastError') {
        error = handleMongoError(err);
    } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        error = handleJWTError(err);
    } else if (err.errors && Array.isArray(err.errors)) {
        // Express-validator errors
        error = handleValidationError(err);
    } else if (!err.isOperational) {
        // Programming or other unexpected errors
        error = new AppError(
            process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
            500,
            'INTERNAL_SERVER_ERROR'
        );
    }

    // Send error response based on environment
    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(error, res);
    } else {
        sendErrorProd(error, res);
    }
};

// Async error handler wrapper
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// 404 handler for unmatched routes
const notFoundHandler = (req, res, next) => {
    const error = new AppError(
        `Route ${req.originalUrl} not found`,
        404,
        'ROUTE_NOT_FOUND'
    );
    next(error);
};

// Success response helper
const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
    res.status(statusCode).json({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
    });
};

// Paginated response helper
const sendPaginatedResponse = (res, data, page, limit, total, message = 'Success') => {
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
        success: true,
        message,
        data,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        },
        timestamp: new Date().toISOString()
    });
};

module.exports = {
    AppError,
    errorHandler,
    asyncHandler,
    notFoundHandler,
    sendSuccess,
    sendPaginatedResponse
};