const express = require('express');
const { body, validationResult } = require('express-validator');
const {
  createCheckoutSession,
  handleSuccessfulPayment,
  createPortalSession,
  stripe
} = require('../services/stripe');

const router = express.Router();

// Create Stripe checkout session
router.post('/create-checkout-session',
  [
    body('billingCycle').optional().isIn(['monthly', 'annual']).withMessage('Invalid billing cycle'),
    body('userId').notEmpty().withMessage('User ID is required'),
    body('userEmail').isEmail().withMessage('Valid email is required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid input',
          details: errors.array()
        });
      }

      const { billingCycle = 'monthly', userId, userEmail } = req.body;

      console.log('Creating checkout session for user:', userId, 'Email:', userEmail);

      const session = await createCheckoutSession(userId, userEmail, billingCycle);

      res.json({
        success: true,
        sessionId: session.id,
        url: session.url
      });

    } catch (error) {
      console.error('Create checkout session error:', error);
      next(error);
    }
  }
);

// Handle successful payment
router.post('/payment-success',
  [
    body('sessionId').notEmpty().withMessage('Session ID is required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid input',
          details: errors.array()
        });
      }

      const { sessionId } = req.body;

      console.log('Processing successful payment for session:', sessionId);

      const result = await handleSuccessfulPayment(sessionId);

      res.json({
        success: true,
        message: 'Payment processed successfully',
        ...result
      });

    } catch (error) {
      console.error('Payment success error:', error);
      next(error);
    }
  }
);

// Create customer portal session
router.post('/create-portal-session',
  [
    body('customerId').notEmpty().withMessage('Customer ID is required'),
    body('returnUrl').isURL().withMessage('Valid return URL is required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid input',
          details: errors.array()
        });
      }

      const { customerId, returnUrl } = req.body;

      const session = await createPortalSession(customerId, returnUrl);

      res.json({
        success: true,
        url: session.url
      });

    } catch (error) {
      console.error('Create portal session error:', error);
      next(error);
    }
  }
);

// Stripe webhook endpoint (for handling subscription events)
router.post('/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || 'dummy_secret'
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('Received Stripe webhook:', event.type);

    // Handle different event types
    try {
      switch (event.type) {
      case 'checkout.session.completed':
        console.log('Payment succeeded:', event.data.object.id);
        // Payment succeeded - we handle this in the frontend flow
        break;

      case 'customer.subscription.deleted':
        console.log('Subscription canceled:', event.data.object.id);
        // TODO: Downgrade user to free tier
        break;

      case 'customer.subscription.updated':
        console.log('Subscription updated:', event.data.object.id);
        // TODO: Handle subscription changes
        break;

      case 'invoice.payment_failed':
        console.log('Payment failed for subscription:', event.data.object.subscription);
        // TODO: Handle failed payments
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

module.exports = router;