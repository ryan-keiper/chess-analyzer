const request = require('supertest');
const express = require('express');
const paymentRoutes = require('../routes/payment');

// Mock Stripe service
jest.mock('../services/stripe', () => ({
  createCheckoutSession: jest.fn(),
  handleSuccessfulPayment: jest.fn(),
  createPortalSession: jest.fn(),
  stripe: {
    webhooks: {
      constructEvent: jest.fn()
    }
  }
}));

describe('Payment Routes', () => {
  let app;
  let mockStripeService;

  beforeEach(() => {
    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/payment', paymentRoutes);

    // Add error handler
    app.use((error, _req, res, _next) => {
      res.status(500).json({ error: error.message });
    });

    // Get mocked functions
    mockStripeService = require('../services/stripe');

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('POST /api/payment/create-checkout-session', () => {
    const validRequestBody = {
      userId: 'user_123',
      userEmail: 'test@example.com',
      billingCycle: 'monthly'
    };

    const mockCheckoutSession = {
      id: 'cs_test_session_id',
      url: 'https://checkout.stripe.com/pay/cs_test_session_id'
    };

    test('should create checkout session successfully', async () => {
      mockStripeService.createCheckoutSession.mockResolvedValue(mockCheckoutSession);

      const response = await request(app)
        .post('/api/payment/create-checkout-session')
        .send(validRequestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.sessionId).toBe(mockCheckoutSession.id);
      expect(response.body.url).toBe(mockCheckoutSession.url);

      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
        'user_123',
        'test@example.com',
        'monthly'
      );
    });

    test('should use default billing cycle when not provided', async () => {
      mockStripeService.createCheckoutSession.mockResolvedValue(mockCheckoutSession);

      const requestWithoutBilling = {
        userId: 'user_123',
        userEmail: 'test@example.com'
      };

      const response = await request(app)
        .post('/api/payment/create-checkout-session')
        .send(requestWithoutBilling)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
        'user_123',
        'test@example.com',
        'monthly' // Default value
      );
    });

    test('should handle annual billing cycle', async () => {
      mockStripeService.createCheckoutSession.mockResolvedValue(mockCheckoutSession);

      const annualRequest = {
        ...validRequestBody,
        billingCycle: 'annual'
      };

      const response = await request(app)
        .post('/api/payment/create-checkout-session')
        .send(annualRequest)
        .expect(200);

      expect(response.body.url).toBe('https://checkout.stripe.com/test_session');
      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
        'user_123',
        'test@example.com',
        'annual'
      );
    });

    test('should validate required userId', async () => {
      const requestWithoutUserId = {
        userEmail: 'test@example.com',
        billingCycle: 'monthly'
      };

      const response = await request(app)
        .post('/api/payment/create-checkout-session')
        .send(requestWithoutUserId)
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'User ID is required' })
        ])
      );

      expect(mockStripeService.createCheckoutSession).not.toHaveBeenCalled();
    });

    test('should validate email format', async () => {
      const requestWithInvalidEmail = {
        userId: 'user_123',
        userEmail: 'invalid_email',
        billingCycle: 'monthly'
      };

      const response = await request(app)
        .post('/api/payment/create-checkout-session')
        .send(requestWithInvalidEmail)
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Valid email is required' })
        ])
      );

      expect(mockStripeService.createCheckoutSession).not.toHaveBeenCalled();
    });

    test('should validate billing cycle values', async () => {
      const requestWithInvalidBilling = {
        userId: 'user_123',
        userEmail: 'test@example.com',
        billingCycle: 'weekly'
      };

      const response = await request(app)
        .post('/api/payment/create-checkout-session')
        .send(requestWithInvalidBilling)
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Invalid billing cycle' })
        ])
      );

      expect(mockStripeService.createCheckoutSession).not.toHaveBeenCalled();
    });

    test('should handle Stripe service errors', async () => {
      mockStripeService.createCheckoutSession.mockRejectedValue(
        new Error('Stripe API error')
      );

      const response = await request(app)
        .post('/api/payment/create-checkout-session')
        .send(validRequestBody)
        .expect(500);

      expect(response.body.error).toBe('Stripe API error');
    });

    test('should handle multiple validation errors', async () => {
      const invalidRequest = {
        billingCycle: 'invalid'
        // Missing userId and userEmail
      };

      const response = await request(app)
        .post('/api/payment/create-checkout-session')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
      expect(response.body.details).toHaveLength(3); // Three validation errors
    });
  });

  describe('POST /api/payment/payment-success', () => {
    const validSessionId = 'cs_test_session_success';
    const mockPaymentResult = {
      customerId: 'cus_test_customer',
      subscriptionId: 'sub_test_subscription',
      status: 'active'
    };

    test('should handle successful payment processing', async () => {
      mockStripeService.handleSuccessfulPayment.mockResolvedValue(mockPaymentResult);

      const response = await request(app)
        .post('/api/payment/payment-success')
        .send({ sessionId: validSessionId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Payment processed successfully');
      expect(response.body.customerId).toBe(mockPaymentResult.customerId);
      expect(response.body.subscriptionId).toBe(mockPaymentResult.subscriptionId);
      expect(response.body.status).toBe(mockPaymentResult.status);

      expect(mockStripeService.handleSuccessfulPayment).toHaveBeenCalledWith(validSessionId);
    });

    test('should validate required sessionId', async () => {
      const response = await request(app)
        .post('/api/payment/payment-success')
        .send({}) // Missing sessionId
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Session ID is required' })
        ])
      );

      expect(mockStripeService.handleSuccessfulPayment).not.toHaveBeenCalled();
    });

    test('should handle payment service errors', async () => {
      mockStripeService.handleSuccessfulPayment.mockRejectedValue(
        new Error('Payment processing failed')
      );

      const response = await request(app)
        .post('/api/payment/payment-success')
        .send({ sessionId: validSessionId })
        .expect(500);

      expect(response.body.error).toBe('Payment processing failed');
    });

    test('should handle empty sessionId', async () => {
      const response = await request(app)
        .post('/api/payment/payment-success')
        .send({ sessionId: '' })
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
    });
  });

  describe('POST /api/payment/create-portal-session', () => {
    const validPortalRequest = {
      customerId: 'cus_test_customer',
      returnUrl: 'https://example.com/account'
    };

    const mockPortalSession = {
      url: 'https://billing.stripe.com/session/test_portal_session'
    };

    test('should create portal session successfully', async () => {
      mockStripeService.createPortalSession.mockResolvedValue(mockPortalSession);

      const response = await request(app)
        .post('/api/payment/create-portal-session')
        .send(validPortalRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.url).toBe(mockPortalSession.url);

      expect(mockStripeService.createPortalSession).toHaveBeenCalledWith(
        'cus_test_customer',
        'https://example.com/account'
      );
    });

    test('should validate required customerId', async () => {
      const requestWithoutCustomerId = {
        returnUrl: 'https://example.com/account'
      };

      const response = await request(app)
        .post('/api/payment/create-portal-session')
        .send(requestWithoutCustomerId)
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Customer ID is required' })
        ])
      );

      expect(mockStripeService.createPortalSession).not.toHaveBeenCalled();
    });

    test('should validate return URL format', async () => {
      const requestWithInvalidUrl = {
        customerId: 'cus_test_customer',
        returnUrl: 'invalid_url'
      };

      const response = await request(app)
        .post('/api/payment/create-portal-session')
        .send(requestWithInvalidUrl)
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Valid return URL is required' })
        ])
      );

      expect(mockStripeService.createPortalSession).not.toHaveBeenCalled();
    });

    test('should handle portal service errors', async () => {
      mockStripeService.createPortalSession.mockRejectedValue(
        new Error('Portal creation failed')
      );

      const response = await request(app)
        .post('/api/payment/create-portal-session')
        .send(validPortalRequest)
        .expect(500);

      expect(response.body.error).toBe('Portal creation failed');
    });
  });

  describe('POST /api/payment/webhook', () => {
    const mockWebhookPayload = JSON.stringify({
      id: 'evt_test_webhook',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_session',
          customer: 'cus_test_customer'
        }
      }
    });

    const mockHeaders = {
      'stripe-signature': 'test_signature'
    };

    beforeEach(() => {
      // Mock express.raw middleware behavior
      app = express();
      app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));
      app.use('/api/payment', paymentRoutes);

      app.use((error, _req, res, _next) => {
        res.status(500).json({ error: error.message });
      });
    });

    test('should handle checkout.session.completed webhook', async () => {
      const mockEvent = {
        id: 'evt_test_webhook',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_session',
            customer: 'cus_test_customer'
          }
        }
      };

      mockStripeService.stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const response = await request(app)
        .post('/api/payment/webhook')
        .set(mockHeaders)
        .set('Content-Type', 'application/json')
        .send(Buffer.from(mockWebhookPayload))
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(mockStripeService.stripe.webhooks.constructEvent).toHaveBeenCalledWith(
        expect.any(Buffer),
        'test_signature',
        process.env.STRIPE_WEBHOOK_SECRET || 'dummy_secret'
      );
    });

    test('should handle customer.subscription.deleted webhook', async () => {
      const mockEvent = {
        id: 'evt_test_webhook',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test_subscription',
            customer: 'cus_test_customer'
          }
        }
      };

      mockStripeService.stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const response = await request(app)
        .post('/api/payment/webhook')
        .set(mockHeaders)
        .send(mockWebhookPayload)
        .expect(200);

      expect(response.body.received).toBe(true);
    });

    test('should handle customer.subscription.updated webhook', async () => {
      const mockEvent = {
        id: 'evt_test_webhook',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test_subscription',
            status: 'active'
          }
        }
      };

      mockStripeService.stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const response = await request(app)
        .post('/api/payment/webhook')
        .set(mockHeaders)
        .send(mockWebhookPayload)
        .expect(200);

      expect(response.body.received).toBe(true);
    });

    test('should handle invoice.payment_failed webhook', async () => {
      const mockEvent = {
        id: 'evt_test_webhook',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_test_invoice',
            subscription: 'sub_test_subscription'
          }
        }
      };

      mockStripeService.stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const response = await request(app)
        .post('/api/payment/webhook')
        .set(mockHeaders)
        .send(mockWebhookPayload)
        .expect(200);

      expect(response.body.received).toBe(true);
    });

    test('should handle unknown webhook event types', async () => {
      const mockEvent = {
        id: 'evt_test_webhook',
        type: 'unknown.event.type',
        data: {
          object: {
            id: 'obj_test'
          }
        }
      };

      mockStripeService.stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const response = await request(app)
        .post('/api/payment/webhook')
        .set(mockHeaders)
        .send(mockWebhookPayload)
        .expect(200);

      expect(response.body.received).toBe(true);
    });

    test('should handle webhook signature verification failure', async () => {
      mockStripeService.stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const response = await request(app)
        .post('/api/payment/webhook')
        .set(mockHeaders)
        .send(mockWebhookPayload)
        .expect(400);

      expect(response.text).toContain('Webhook Error: Invalid signature');
    });

    test('should handle webhook processing errors', async () => {
      const mockEvent = {
        id: 'evt_test_webhook',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_session'
          }
        }
      };

      mockStripeService.stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Mock console.log to throw an error when logging payment success
      const originalConsoleLog = console.log;
      console.log = jest.fn((message, ..._args) => {
        if (message === 'Payment succeeded:') {
          throw new Error('Processing error');
        }
        // For other console.log calls, use original behavior
        return originalConsoleLog.apply(console, arguments);
      });

      const response = await request(app)
        .post('/api/payment/webhook')
        .set(mockHeaders)
        .set('Content-Type', 'application/json')
        .send(Buffer.from(mockWebhookPayload))
        .expect(500);

      expect(response.body.error).toBe('Webhook processing failed');

      // Restore console.log
      console.log = originalConsoleLog;
    });

    test('should handle missing stripe signature header', async () => {
      // Mock constructEvent to throw error when signature is missing
      mockStripeService.stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload');
      });

      const response = await request(app)
        .post('/api/payment/webhook')
        .set('Content-Type', 'application/json')
        .send(Buffer.from(mockWebhookPayload))
        .expect(400);

      expect(response.text).toContain('Webhook Error');
    });

    test('should use default webhook secret when env var not set', async () => {
      const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const mockEvent = {
        id: 'evt_test_webhook',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_session' } }
      };

      mockStripeService.stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const response = await request(app)
        .post('/api/payment/webhook')
        .set(mockHeaders)
        .set('Content-Type', 'application/json')
        .send(Buffer.from(mockWebhookPayload))
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(mockStripeService.stripe.webhooks.constructEvent).toHaveBeenCalledWith(
        expect.any(Buffer),
        'test_signature',
        'dummy_secret'
      );

      // Restore env var
      if (originalWebhookSecret) {
        process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/api/payment/create-checkout-session')
        .send('invalid json')
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(mockStripeService.createCheckoutSession).not.toHaveBeenCalled();
    });

    test('should handle very long customer IDs', async () => {
      const longCustomerId = 'cus_' + 'a'.repeat(1000);
      mockStripeService.createPortalSession.mockResolvedValue({
        url: 'https://billing.stripe.com/session/test'
      });

      const response = await request(app)
        .post('/api/payment/create-portal-session')
        .send({
          customerId: longCustomerId,
          returnUrl: 'https://example.com/account'
        })
        .expect(200);

      expect(response.body.url).toBeDefined();
      expect(mockStripeService.createPortalSession).toHaveBeenCalledWith(
        longCustomerId,
        'https://example.com/account'
      );
    });

    test('should handle concurrent payment requests', async () => {
      mockStripeService.createCheckoutSession.mockResolvedValue({
        id: 'cs_test_session',
        url: 'https://checkout.stripe.com/pay/cs_test_session'
      });

      const requests = Array(3).fill().map(() =>
        request(app)
          .post('/api/payment/create-checkout-session')
          .send({
            userId: 'user_123',
            userEmail: 'test@example.com',
            billingCycle: 'monthly'
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledTimes(3);
    });

    test('should handle service timeouts', async () => {
      mockStripeService.createCheckoutSession.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Service timeout')), 100)
        )
      );

      const response = await request(app)
        .post('/api/payment/create-checkout-session')
        .send({
          userId: 'user_123',
          userEmail: 'test@example.com'
        })
        .expect(500);

      expect(response.body.error).toBe('Service timeout');
    }, 10000);
  });
});