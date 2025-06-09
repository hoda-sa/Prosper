/**
 * Categories API Route Test Suite
 * 
 * Tests the GET /api/categories endpoint functionality without authentication.
 * 
 * This test suite:
 * - Bypasses Auth0 authentication by creating a standalone Express app with mock middleware
 * - Tests successful category retrieval (all categories, filtered by type, empty results)
 * - Validates error handling for database failures and exceptions
 * - Verifies correct user context handling and parameter passing
 * - Tests query parameter validation and edge cases
 * - Validates response format and structure
 * 
 * Key Features:
 * - No Auth0 configuration required
 * - Uses Sinon to mock Category.getUserCategories method
 * - Comprehensive coverage of success and error scenarios
 * - Tests different user contexts and query parameters
 * 
 * @requires chai - Assertion library
 * @requires chai-http - HTTP integration testing
 * @requires sinon - Test spies, stubs, and mocks
 * @requires express - Web framework for creating test app
 */

const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const express = require('express');
const expect = chai.expect;

chai.use(chaiHttp);

// Import the route handler
const categoryRoutes = require('../routes/categories');
const Category = require('../models/Category');
const { sendSuccess, AppError } = require('../middleware/errorHandler');

describe('GET /api/categories', () => {
    let app;
    let sandbox;

    before(() => {
        // Create Express app for testing
        app = express();
        app.use(express.json());

        // Mock authentication middleware - bypass completely
        app.use((req, res, next) => {
            req.user = {
                id: 'test-user-123',
                email: 'test@example.com',
                name: 'Test User'
            };
            next();
        });

        // Use the category routes
        app.use('/api/categories', categoryRoutes);

        // Basic error handler
        app.use((err, req, res, next) => {
            res.status(err.statusCode || 500).json({
                error: {
                    message: err.message,
                    errorCode: err.errorCode || 'UNKNOWN_ERROR'
                }
            });
        });
    });

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('Successful category retrieval', () => {
        it('should get all categories for a user', (done) => {
            const mockCategories = [
                { _id: '1', name: 'Groceries', type: 'expense', userId: 'test-user-123' },
                { _id: '2', name: 'Salary', type: 'income', userId: 'test-user-123' },
                { _id: '3', name: 'Entertainment', type: 'expense', userId: 'test-user-123' }
            ];

            // Mock the Category.getUserCategories method
            sandbox.stub(Category, 'getUserCategories').resolves(mockCategories);

            chai.request(app)
                .get('/api/categories')
                .end((err, res) => {
                    if (err) {
                        console.error('Test error:', err);
                        return done(err);
                    }

                    expect(res).to.have.status(200);
                    expect(res.body).to.have.property('success', true);
                    expect(res.body).to.have.property('data');
                    expect(res.body).to.have.property('message', 'Categories retrieved successfully');
                    expect(res.body.data).to.be.an('array');
                    expect(res.body.data).to.have.length(3);
                    expect(res.body.data[0]).to.have.property('name', 'Groceries');

                    // Verify the mock was called with correct parameters
                    expect(Category.getUserCategories.calledOnce).to.be.true;
                    expect(Category.getUserCategories.calledWith('test-user-123', undefined)).to.be.true;

                    done();
                });
        });

        it('should get filtered categories by type (expense)', (done) => {
            const mockExpenseCategories = [
                { _id: '1', name: 'Groceries', type: 'expense', userId: 'test-user-123' },
                { _id: '3', name: 'Entertainment', type: 'expense', userId: 'test-user-123' }
            ];

            sandbox.stub(Category, 'getUserCategories').resolves(mockExpenseCategories);

            chai.request(app)
                .get('/api/categories?type=expense')
                .end((err, res) => {
                    if (err) return done(err);

                    expect(res).to.have.status(200);
                    expect(res.body.success).to.be.true;
                    expect(res.body.data).to.have.length(2);
                    expect(res.body.data.every(cat => cat.type === 'expense')).to.be.true;

                    // Verify the mock was called with type filter
                    expect(Category.getUserCategories.calledWith('test-user-123', 'expense')).to.be.true;

                    done();
                });
        });

        it('should get filtered categories by type (income)', (done) => {
            const mockIncomeCategories = [
                { _id: '2', name: 'Salary', type: 'income', userId: 'test-user-123' }
            ];

            sandbox.stub(Category, 'getUserCategories').resolves(mockIncomeCategories);

            chai.request(app)
                .get('/api/categories?type=income')
                .end((err, res) => {
                    if (err) return done(err);

                    expect(res).to.have.status(200);
                    expect(res.body.success).to.be.true;
                    expect(res.body.data).to.have.length(1);
                    expect(res.body.data[0].type).to.equal('income');
                    expect(res.body.data[0].name).to.equal('Salary');

                    // Verify the mock was called with type filter
                    expect(Category.getUserCategories.calledWith('test-user-123', 'income')).to.be.true;

                    done();
                });
        });

        it('should return empty array when no categories found', (done) => {
            sandbox.stub(Category, 'getUserCategories').resolves([]);

            chai.request(app)
                .get('/api/categories')
                .end((err, res) => {
                    if (err) return done(err);

                    expect(res).to.have.status(200);
                    expect(res.body.success).to.be.true;
                    expect(res.body.data).to.be.an('array');
                    expect(res.body.data).to.have.length(0);
                    expect(res.body.message).to.equal('Categories retrieved successfully');

                    done();
                });
        });
    });

    describe('Error handling', () => {
        it('should handle database errors gracefully', (done) => {
            const dbError = new Error('Database connection failed');
            sandbox.stub(Category, 'getUserCategories').rejects(dbError);

            chai.request(app)
                .get('/api/categories')
                .end((err, res) => {
                    expect(res).to.have.status(500);
                    expect(res.body).to.have.property('error');
                    expect(res.body.error).to.have.property('message', 'Failed to fetch categories');
                    expect(res.body.error).to.have.property('errorCode', 'CATEGORIES_FETCH_ERROR');

                    done();
                });
        });

        it('should handle Category.getUserCategories throwing an error', (done) => {
            sandbox.stub(Category, 'getUserCategories').throws(new Error('Invalid user ID'));

            chai.request(app)
                .get('/api/categories')
                .end((err, res) => {
                    expect(res).to.have.status(500);
                    expect(res.body).to.have.property('error');
                    expect(res.body.error.message).to.equal('Failed to fetch categories');

                    done();
                });
        });
    });

    describe('User context', () => {
        it('should use the correct user ID from req.user', (done) => {
            const mockCategories = [
                { _id: '1', name: 'Test Category', type: 'expense', userId: 'test-user-123' }
            ];

            const getUserCategoriesStub = sandbox.stub(Category, 'getUserCategories').resolves(mockCategories);

            chai.request(app)
                .get('/api/categories')
                .end((err, res) => {
                    if (err) return done(err);

                    expect(res).to.have.status(200);

                    // Verify that getUserCategories was called with the correct user ID
                    expect(getUserCategoriesStub.calledOnce).to.be.true;
                    const [userId, type] = getUserCategoriesStub.getCall(0).args;
                    expect(userId).to.equal('test-user-123');
                    expect(type).to.be.undefined; // No type filter in this test

                    done();
                });
        });

        it('should handle different user IDs correctly', (done) => {
            // Create a new app instance with different user
            const testApp = express();
            testApp.use(express.json());

            testApp.use((req, res, next) => {
                req.user = {
                    id: 'different-user-456',
                    email: 'different@example.com'
                };
                next();
            });

            testApp.use('/api/categories', categoryRoutes);
            testApp.use((err, req, res, next) => {
                res.status(err.statusCode || 500).json({
                    error: {
                        message: err.message,
                        errorCode: err.errorCode || 'UNKNOWN_ERROR'
                    }
                });
            });

            const mockCategories = [
                { _id: '4', name: 'Different User Category', userId: 'different-user-456' }
            ];

            const getUserCategoriesStub = sandbox.stub(Category, 'getUserCategories').resolves(mockCategories);

            chai.request(testApp)
                .get('/api/categories')
                .end((err, res) => {
                    if (err) return done(err);

                    expect(res).to.have.status(200);

                    // Verify correct user ID was used
                    expect(getUserCategoriesStub.calledWith('different-user-456')).to.be.true;

                    done();
                });
        });
    });

    describe('Query parameter handling', () => {
        it('should handle invalid type parameter gracefully', (done) => {
            const mockCategories = [];
            sandbox.stub(Category, 'getUserCategories').resolves(mockCategories);

            chai.request(app)
                .get('/api/categories?type=invalid-type')
                .end((err, res) => {
                    if (err) return done(err);

                    expect(res).to.have.status(200);

                    // Verify that the invalid type was passed to the model
                    // (let the model handle validation)
                    expect(Category.getUserCategories.calledWith('test-user-123', 'invalid-type')).to.be.true;

                    done();
                });
        });

        it('should handle multiple query parameters correctly', (done) => {
            const mockCategories = [];
            sandbox.stub(Category, 'getUserCategories').resolves(mockCategories);

            chai.request(app)
                .get('/api/categories?type=expense&someOtherParam=value')
                .end((err, res) => {
                    if (err) return done(err);

                    expect(res).to.have.status(200);

                    // Should only use the type parameter
                    expect(Category.getUserCategories.calledWith('test-user-123', 'expense')).to.be.true;

                    done();
                });
        });

        it('should handle empty type parameter', (done) => {
            const mockCategories = [];
            sandbox.stub(Category, 'getUserCategories').resolves(mockCategories);

            chai.request(app)
                .get('/api/categories?type=')
                .end((err, res) => {
                    if (err) return done(err);

                    expect(res).to.have.status(200);

                    // Empty string should be passed as is
                    expect(Category.getUserCategories.calledWith('test-user-123', '')).to.be.true;

                    done();
                });
        });
    });

    describe('Response format validation', () => {
        it('should return response in correct format', (done) => {
            const mockCategories = [
                { _id: '1', name: 'Test', type: 'expense' }
            ];

            sandbox.stub(Category, 'getUserCategories').resolves(mockCategories);

            chai.request(app)
                .get('/api/categories')
                .end((err, res) => {
                    if (err) return done(err);

                    // Validate response structure (allowing for timestamp field)
                    expect(res.body).to.include.all.keys(['success', 'data', 'message']);
                    expect(res.body.success).to.be.a('boolean');
                    expect(res.body.data).to.be.an('array');
                    expect(res.body.message).to.be.a('string');

                    // Optional timestamp field
                    if (res.body.timestamp) {
                        expect(res.body.timestamp).to.be.a('string');
                    }

                    // Validate individual category structure
                    if (res.body.data.length > 0) {
                        const category = res.body.data[0];
                        expect(category).to.have.property('_id');
                        expect(category).to.have.property('name');
                        expect(category).to.have.property('type');
                    }

                    done();
                });
        });
    });
});