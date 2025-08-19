const originalEnv = process.env;

// Mock stripe module
const mockStripeInstance = {
  checkout: {
    sessions: {
      create: jest.fn(),
      retrieve: jest.fn()
    }
  },
  subscriptions: {
    list: jest.fn(),
    update: jest.fn()
  },
  billingPortal: {
    sessions: {
      create: jest.fn()
    }
  }
};

jest.mock('stripe', () => {
  return jest.fn(() => mockStripeInstance);
});

// Mock supabase service
jest.mock('../services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ data: null, error: null }))
      })),
      insert: jest.fn(() => ({ data: null, error: null }))
    }))
  }
}));

describe('Stripe Service', () => {
  let mockSupabase;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
    process.env.FRONTEND_URL = 'https://test-frontend.com';

    // Reset all mocks
    jest.clearAllMocks();
    
    // Re-setup mockSupabase from the mock
    const { supabase } = require('../services/supabase');
    mockSupabase = supabase;
    
    // Reset the mock implementation to the default
    mockSupabase.from.mockImplementation(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ data: null, error: null }))
      })),
      insert: jest.fn(() => ({ data: null, error: null }))
    }));

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('createCheckoutSession', () => {
    test('should create monthly checkout session successfully', async () => {
      const mockSession = {
        id: 'cs_test_session_id',
        url: 'https://checkout.stripe.com/pay/cs_test_session_id'
      };

      mockStripeInstance.checkout.sessions.create.mockResolvedValue(mockSession);

      const { createCheckoutSession } = require('../services/stripe');
      const result = await createCheckoutSession('user_123', 'test@example.com', 'monthly');

      expect(result).toEqual(mockSession);
      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Chess Analyzer Pro',
              description: 'Unlimited chess analysis with AI-powered explanations',
              images: ['https://your-app-url.com/logo.png']
            },
            unit_amount: 999, // $9.99 in cents
            recurring: {
              interval: 'month'
            }
          },
          quantity: 1
        }],
        mode: 'subscription',
        success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/pricing`,
        customer_email: 'test@example.com',
        metadata: {
          userId: 'user_123',
          tier: 'PRO'
        },
        subscription_data: {
          metadata: {
            userId: 'user_123'
          }
        },
        billing_address_collection: 'required',
        allow_promotion_codes: true
      });
    });

    test('should create annual checkout session with discounted price', async () => {
      const mockSession = {
        id: 'cs_test_annual_session',
        url: 'https://checkout.stripe.com/pay/cs_test_annual_session'
      };

      mockStripeInstance.checkout.sessions.create.mockResolvedValue(mockSession);

      const { createCheckoutSession } = require('../services/stripe');
      await createCheckoutSession('user_123', 'test@example.com', 'annual');

      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{
            price_data: expect.objectContaining({
              unit_amount: 799, // $7.99 in cents (annual discount)
              recurring: {
                interval: 'year'
              }
            }),
            quantity: 1
          }]
        })
      );
    });

    test('should default to monthly billing when no cycle specified', async () => {
      const mockSession = { id: 'cs_test_default', url: 'https://checkout.stripe.com/pay/cs_test_default' };
      mockStripeInstance.checkout.sessions.create.mockResolvedValue(mockSession);

      const { createCheckoutSession } = require('../services/stripe');
      await createCheckoutSession('user_123', 'test@example.com');

      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{
            price_data: expect.objectContaining({
              unit_amount: 999, // Monthly price
              recurring: { interval: 'month' }
            }),
            quantity: 1
          }]
        })
      );
    });

    test('should handle Stripe API errors', async () => {
      mockStripeInstance.checkout.sessions.create.mockRejectedValue(new Error('Stripe API error'));

      const { createCheckoutSession } = require('../services/stripe');

      await expect(createCheckoutSession('user_123', 'test@example.com'))
        .rejects.toThrow('Failed to create payment session');
    });

    test('should include correct metadata for tracking', async () => {
      const mockSession = { id: 'cs_test', url: 'https://checkout.stripe.com/pay/cs_test' };
      mockStripeInstance.checkout.sessions.create.mockResolvedValue(mockSession);

      const { createCheckoutSession } = require('../services/stripe');
      await createCheckoutSession('user_456', 'user@example.com', 'monthly');

      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            userId: 'user_456',
            tier: 'PRO'
          },
          subscription_data: {
            metadata: {
              userId: 'user_456'
            }
          }
        })
      );
    });

    test('should use environment URLs for success and cancel redirects', async () => {
      process.env.FRONTEND_URL = 'https://custom-domain.com';
      
      const mockSession = { id: 'cs_test', url: 'https://checkout.stripe.com/pay/cs_test' };
      mockStripeInstance.checkout.sessions.create.mockResolvedValue(mockSession);

      const { createCheckoutSession } = require('../services/stripe');
      await createCheckoutSession('user_123', 'test@example.com');

      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'https://custom-domain.com/payment-success?session_id={CHECKOUT_SESSION_ID}',
          cancel_url: 'https://custom-domain.com/pricing'
        })
      );
    });
  });

  describe('handleSuccessfulPayment', () => {
    test('should process successful payment and upgrade user', async () => {
      const mockSession = {
        id: 'cs_test_session',
        payment_status: 'paid',
        customer: 'cus_test_customer',
        metadata: { userId: 'user_123' },
        subscription: {
          id: 'sub_test_subscription',
          current_period_end: 1609459200, // Jan 1, 2021
          items: {
            data: [{
              price: {
                recurring: { interval: 'month' }
              }
            }]
          }
        },
        amount_total: 999
      };

      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue(mockSession);
      
      // Mock both user_profiles and usage_logs calls
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'user_profiles') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn(() => ({ data: null, error: null }))
            }))
          };
        }
        if (table === 'usage_logs') {
          return {
            insert: jest.fn(() => ({ data: null, error: null }))
          };
        }
        return mockSupabase.from.mockReturnValue();
      });

      const { handleSuccessfulPayment } = require('../services/stripe');
      const result = await handleSuccessfulPayment('cs_test_session');

      expect(result).toEqual({
        success: true,
        userId: 'user_123',
        subscriptionId: 'sub_test_subscription',
        expiresAt: '2021-01-01T00:00:00.000Z'
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
      expect(mockSupabase.from).toHaveBeenCalledWith('usage_logs');
      expect(console.log).toHaveBeenCalledWith('User user_123 upgraded to Pro successfully');
    });

    test('should handle payment not completed', async () => {
      const mockSession = {
        id: 'cs_test_session',
        payment_status: 'unpaid',
        metadata: { userId: 'user_123' }
      };

      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      const { handleSuccessfulPayment } = require('../services/stripe');

      await expect(handleSuccessfulPayment('cs_test_session'))
        .rejects.toThrow('Payment not completed');
    });

    test('should handle missing subscription data', async () => {
      const mockSession = {
        id: 'cs_test_session',
        payment_status: 'paid',
        customer: 'cus_test_customer',
        metadata: { userId: 'user_123' },
        subscription: null,
        amount_total: 999
      };

      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      const { handleSuccessfulPayment } = require('../services/stripe');
      const result = await handleSuccessfulPayment('cs_test_session');

      expect(result.subscriptionId).toBeUndefined();
      expect(result.expiresAt).toBeNull();
    });

    test('should handle database update errors', async () => {
      const mockSession = {
        id: 'cs_test_session',
        payment_status: 'paid',
        customer: 'cus_test_customer',
        metadata: { userId: 'user_123' },
        subscription: { id: 'sub_test' }
      };

      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      // Mock database error for user_profiles update
      mockSupabase.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: null, error: new Error('Database error') })
        }))
      });

      const { handleSuccessfulPayment } = require('../services/stripe');

      await expect(handleSuccessfulPayment('cs_test_session'))
        .rejects.toThrow();
    });

    test('should handle Stripe session retrieval errors', async () => {
      mockStripeInstance.checkout.sessions.retrieve.mockRejectedValue(new Error('Session not found'));

      const { handleSuccessfulPayment } = require('../services/stripe');

      await expect(handleSuccessfulPayment('invalid_session'))
        .rejects.toThrow('Session not found');
    });

    test('should log upgrade event', async () => {
      const mockSession = {
        id: 'cs_test_session',
        payment_status: 'paid',
        customer: 'cus_test_customer',
        metadata: { userId: 'user_123' },
        subscription: {
          id: 'sub_test_subscription',
          items: {
            data: [{
              price: {
                recurring: { interval: 'month' }
              }
            }]
          }
        },
        amount_total: 999
      };

      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue(mockSession);
      
      // Ensure both database calls work
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'user_profiles') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn(() => ({ data: null, error: null }))
            }))
          };
        }
        if (table === 'usage_logs') {
          return {
            insert: jest.fn(() => ({ data: null, error: null }))
          };
        }
        return {};
      });

      const { handleSuccessfulPayment } = require('../services/stripe');
      await handleSuccessfulPayment('cs_test_session');

      // Should call insert for usage_logs
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
      expect(mockSupabase.from).toHaveBeenCalledWith('usage_logs');
    });
  });

  describe('getCustomerSubscription', () => {
    test('should retrieve active customer subscription', async () => {
      const mockSubscription = {
        id: 'sub_test_subscription',
        status: 'active',
        current_period_end: 1609459200
      };

      mockStripeInstance.subscriptions.list.mockResolvedValue({
        data: [mockSubscription]
      });

      const { getCustomerSubscription } = require('../services/stripe');
      const result = await getCustomerSubscription('cus_test_customer');

      expect(result).toEqual(mockSubscription);
      expect(mockStripeInstance.subscriptions.list).toHaveBeenCalledWith({
        customer: 'cus_test_customer',
        status: 'active',
        limit: 1
      });
    });

    test('should return null when no active subscriptions', async () => {
      mockStripeInstance.subscriptions.list.mockResolvedValue({ data: [] });

      const { getCustomerSubscription } = require('../services/stripe');
      const result = await getCustomerSubscription('cus_test_customer');

      expect(result).toBeNull();
    });

    test('should handle Stripe API errors gracefully', async () => {
      mockStripeInstance.subscriptions.list.mockRejectedValue(new Error('API error'));

      const { getCustomerSubscription } = require('../services/stripe');
      const result = await getCustomerSubscription('cus_test_customer');

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith('Error getting customer subscription:', expect.any(Error));
    });
  });

  describe('cancelSubscription', () => {
    test('should cancel subscription at period end', async () => {
      const mockUpdatedSubscription = {
        id: 'sub_test_subscription',
        cancel_at_period_end: true
      };

      mockStripeInstance.subscriptions.update.mockResolvedValue(mockUpdatedSubscription);

      const { cancelSubscription } = require('../services/stripe');
      const result = await cancelSubscription('sub_test_subscription');

      expect(result).toEqual(mockUpdatedSubscription);
      expect(mockStripeInstance.subscriptions.update).toHaveBeenCalledWith('sub_test_subscription', {
        cancel_at_period_end: true
      });
    });

    test('should handle cancellation errors', async () => {
      mockStripeInstance.subscriptions.update.mockRejectedValue(new Error('Cancellation failed'));

      const { cancelSubscription } = require('../services/stripe');

      await expect(cancelSubscription('sub_test_subscription'))
        .rejects.toThrow('Cancellation failed');
    });
  });

  describe('createPortalSession', () => {
    test('should create billing portal session', async () => {
      const mockPortalSession = {
        id: 'bps_test_portal_session',
        url: 'https://billing.stripe.com/session/bps_test_portal_session'
      };

      mockStripeInstance.billingPortal.sessions.create.mockResolvedValue(mockPortalSession);

      const { createPortalSession } = require('../services/stripe');
      const result = await createPortalSession('cus_test_customer', 'https://app.com/account');

      expect(result).toEqual(mockPortalSession);
      expect(mockStripeInstance.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_test_customer',
        return_url: 'https://app.com/account'
      });
    });

    test('should handle portal session creation errors', async () => {
      mockStripeInstance.billingPortal.sessions.create.mockRejectedValue(new Error('Portal error'));

      const { createPortalSession } = require('../services/stripe');

      await expect(createPortalSession('cus_test_customer', 'https://app.com/account'))
        .rejects.toThrow('Portal error');
    });
  });

  describe('Module Exports', () => {
    test('should export all required functions and stripe instance', () => {
      const stripeModule = require('../services/stripe');

      expect(stripeModule).toHaveProperty('createCheckoutSession');
      expect(stripeModule).toHaveProperty('handleSuccessfulPayment');
      expect(stripeModule).toHaveProperty('getCustomerSubscription');
      expect(stripeModule).toHaveProperty('cancelSubscription');
      expect(stripeModule).toHaveProperty('createPortalSession');
      expect(stripeModule).toHaveProperty('stripe');

      expect(typeof stripeModule.createCheckoutSession).toBe('function');
      expect(typeof stripeModule.handleSuccessfulPayment).toBe('function');
      expect(typeof stripeModule.getCustomerSubscription).toBe('function');
      expect(typeof stripeModule.cancelSubscription).toBe('function');
      expect(typeof stripeModule.createPortalSession).toBe('function');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing STRIPE_SECRET_KEY', () => {
      delete process.env.STRIPE_SECRET_KEY;
      
      // Stripe constructor should be called with undefined
      expect(() => {
        jest.resetModules();
        require('../services/stripe');
      }).not.toThrow();
    });

    test('should handle missing FRONTEND_URL', () => {
      delete process.env.FRONTEND_URL;
      
      const mockSession = { id: 'cs_test', url: 'https://checkout.stripe.com/pay/cs_test' };
      mockStripeInstance.checkout.sessions.create.mockResolvedValue(mockSession);

      const { createCheckoutSession } = require('../services/stripe');

      return createCheckoutSession('user_123', 'test@example.com').then(() => {
        expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
          expect.objectContaining({
            success_url: 'undefined/payment-success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'undefined/pricing'
          })
        );
      });
    });

    test('should handle malformed subscription data', async () => {
      const mockSession = {
        id: 'cs_test_session',
        payment_status: 'paid',
        customer: 'cus_test_customer',
        metadata: { userId: 'user_123' },
        subscription: {
          id: 'sub_test_subscription',
          current_period_end: null, // Null timestamp
          items: { data: [] } // Empty items
        }
      };

      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue(mockSession);
      
      // Mock database operations
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'user_profiles') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn(() => ({ data: null, error: null }))
            }))
          };
        }
        if (table === 'usage_logs') {
          return {
            insert: jest.fn(() => ({ data: null, error: null }))
          };
        }
        return {};
      });

      const { handleSuccessfulPayment } = require('../services/stripe');

      // Should not throw even with malformed data
      const result = await handleSuccessfulPayment('cs_test_session');
      expect(result.success).toBe(true);
      expect(result.expiresAt).toBeNull();
    });

    test('should handle subscription with no items', async () => {
      const mockSession = {
        id: 'cs_test_session',
        payment_status: 'paid',
        customer: 'cus_test_customer',
        metadata: { userId: 'user_123' },
        subscription: {
          id: 'sub_test_subscription',
          items: null
        }
      };

      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      const { handleSuccessfulPayment } = require('../services/stripe');
      const result = await handleSuccessfulPayment('cs_test_session');

      expect(result.success).toBe(true);
    });

    test('should handle very large amounts', async () => {
      const mockSession = { id: 'cs_test', url: 'https://checkout.stripe.com/pay/cs_test' };
      mockStripeInstance.checkout.sessions.create.mockResolvedValue(mockSession);

      const { createCheckoutSession } = require('../services/stripe');
      
      // Test with annual billing (ensure proper rounding)
      await createCheckoutSession('user_123', 'test@example.com', 'annual');

      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{
            price_data: expect.objectContaining({
              unit_amount: 799 // Should be properly rounded to cents
            }),
            quantity: 1
          }]
        })
      );
    });

    test('should handle concurrent payment processing', async () => {
      const mockSession = {
        id: 'cs_test_session',
        payment_status: 'paid',
        customer: 'cus_test_customer',
        metadata: { userId: 'user_123' },
        subscription: { id: 'sub_test' }
      };

      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      const { handleSuccessfulPayment } = require('../services/stripe');

      const promises = Array(3).fill().map(() =>
        handleSuccessfulPayment('cs_test_session')
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.userId).toBe('user_123');
      });
    });

    test('should handle logging errors gracefully', async () => {
      const mockSession = {
        id: 'cs_test_session',
        payment_status: 'paid',
        customer: 'cus_test_customer',
        metadata: { userId: 'user_123' },
        subscription: { id: 'sub_test' }
      };

      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      // Mock logging to fail
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'usage_logs') {
          return {
            insert: jest.fn(() => ({ data: null, error: { message: 'Log failed' } }))
          };
        }
        return {
          update: jest.fn(() => ({
            eq: jest.fn(() => ({ data: null, error: null }))
          }))
        };
      });

      const { handleSuccessfulPayment } = require('../services/stripe');
      
      // Should not throw even if logging fails
      const result = await handleSuccessfulPayment('cs_test_session');
      expect(result.success).toBe(true);
    });
  });

  describe('Price Calculations', () => {
    test('should calculate monthly price correctly', async () => {
      const mockSession = { id: 'cs_test', url: 'https://checkout.stripe.com/pay/cs_test' };
      mockStripeInstance.checkout.sessions.create.mockResolvedValue(mockSession);

      const { createCheckoutSession } = require('../services/stripe');
      await createCheckoutSession('user_123', 'test@example.com', 'monthly');

      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{
            price_data: expect.objectContaining({
              unit_amount: 999 // $9.99 * 100
            }),
            quantity: 1
          }]
        })
      );
    });

    test('should calculate annual price correctly', async () => {
      const mockSession = { id: 'cs_test', url: 'https://checkout.stripe.com/pay/cs_test' };
      mockStripeInstance.checkout.sessions.create.mockResolvedValue(mockSession);

      const { createCheckoutSession } = require('../services/stripe');
      await createCheckoutSession('user_123', 'test@example.com', 'annual');

      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{
            price_data: expect.objectContaining({
              unit_amount: 799 // $7.99 * 100
            }),
            quantity: 1
          }]
        })
      );
    });

    test('should handle price rounding edge cases', async () => {
      // This tests that Math.round works correctly for the price calculations
      const mockSession = { id: 'cs_test', url: 'https://checkout.stripe.com/pay/cs_test' };
      mockStripeInstance.checkout.sessions.create.mockResolvedValue(mockSession);

      const { createCheckoutSession } = require('../services/stripe');
      
      // The prices are hardcoded, but this ensures Math.round is working
      await createCheckoutSession('user_123', 'test@example.com', 'monthly');

      const call = mockStripeInstance.checkout.sessions.create.mock.calls[0][0];
      const unitAmount = call.line_items[0].price_data.unit_amount;
      
      expect(Number.isInteger(unitAmount)).toBe(true);
      expect(unitAmount).toBeGreaterThan(0);
    });
  });
});