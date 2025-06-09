const { expressjwt: jwt } = require('express-jwt');

// Dynamic Key Retrieval
/* Instead of a static secret, it fetches Auth0's public keys from their JWKS (JSON Web Key Set) endpoint.
This allows Auth0 to rotate keys for security without breaking the app. */
const jwksRsa = require('jwks-rsa');


// Auth0 JWT verification middleware
const authMiddleware = jwt({
    // Dynamically provide a signing key based on the kid in the header
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
    }),

    // Validate the audience and the issuer
    audience: process.env.AUTH0_AUDIENCE,
    issuer: `https://${process.env.AUTH0_DOMAIN}/`,
    algorithms: ['RS256']
});

// Middleware to extract user information from the JWT token
const extractUserInfo = (req, res, next) => {
    try {
        if (req.auth) {
            // Extract user information from the JWT payload
            req.user = {
                id: req.auth.sub, // Auth0 user ID
                email: req.auth.email || null,
                name: req.auth.name || null,
                nickname: req.auth.nickname || null,
                picture: req.auth.picture || null,
                email_verified: req.auth.email_verified || false,
                permissions: req.auth.permissions || [],
                scope: req.auth.scope || ''
            };

            console.log(`🔐 Authenticated user: ${req.user.email || req.user.id}`);
        }
        next();
    } catch (error) {
        console.error('❌ Error extracting user info:', error);
        return res.status(500).json({
            error: 'Authentication processing error',
            message: 'Failed to process user authentication data'
        });
    }
};

// Middleware to check if user has specific permissions
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        }

        if (!req.user.permissions.includes(permission)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `Insufficient permissions. Required: ${permission}`
            });
        }

        next();
    };
};

// Middleware to check if user has any of the specified permissions
const requireAnyPermission = (permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        }

        const hasPermission = permissions.some(permission =>
            req.user.permissions.includes(permission)
        );

        if (!hasPermission) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `Insufficient permissions. Required one of: ${permissions.join(', ')}`
            });
        }

        next();
    };
};

// Optional authentication middleware (doesn't throw error if no token)
const optionalAuth = jwt({
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
    }),
    audience: process.env.AUTH0_AUDIENCE,
    issuer: `https://${process.env.AUTH0_DOMAIN}/`,
    algorithms: ['RS256'],
    credentialsRequired: false // This makes the middleware optional
});

// Error handler specifically for JWT errors
const jwtErrorHandler = (err, req, res, next) => {
    if (err.name === 'UnauthorizedError') {
        console.log('🔒 JWT Error:', err.message);

        // Provide specific error messages based on the error
        let message = 'Authentication failed';
        let code = 'INVALID_TOKEN';

        if (err.message.includes('jwt expired')) {
            message = 'Token has expired';
            code = 'TOKEN_EXPIRED';
        } else if (err.message.includes('jwt malformed')) {
            message = 'Invalid token format';
            code = 'MALFORMED_TOKEN';
        } else if (err.message.includes('invalid signature')) {
            message = 'Invalid token signature';
            code = 'INVALID_SIGNATURE';
        } else if (err.message.includes('No authorization token')) {
            message = 'No authorization token provided';
            code = 'NO_TOKEN';
        }

        return res.status(401).json({
            error: 'Unauthorized',
            message: message,
            code: code,
            hint: 'Please ensure you are logged in and have a valid token'
        });
    }
    next(err);
};

// Combined middleware that includes user extraction for cleaner code
const authWithUserInfo = [authMiddleware, extractUserInfo];
const optionalAuthWithUserInfo = [optionalAuth, extractUserInfo];

module.exports = {
    authMiddleware: authWithUserInfo,
    optionalAuth: optionalAuthWithUserInfo,
    extractUserInfo,
    requirePermission,
    requireAnyPermission,
    jwtErrorHandler
};