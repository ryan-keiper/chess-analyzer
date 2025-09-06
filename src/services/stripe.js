// Initialize Stripe only if key is provided (optional for CI/testing)
const stripe = process.env.STRIPE_SECRET_KEY ? 
  require('stripe')(process.env.STRIPE_SECRET_KEY) : 
  null;
const { supabase } = require('./supabase');

/**
 * Create a Stripe Checkout session for Pro subscription
 */
async function createCheckoutSession(userId, userEmail, billingCycle = 'monthly') {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.');
  }
  
  try {
    const price = billingCycle === 'annual' ? 7.99 : 9.99;
    const interval = billingCycle === 'annual' ? 'year' : 'month';
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Chess Analyzer Pro',
              description: 'Unlimited chess analysis with AI-powered explanations',
              images: ['https://your-app-url.com/logo.png'], // Add your logo URL later
            },
            unit_amount: Math.round(price * 100), // Convert to cents
            recurring: {
              interval: interval,
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      customer_email: userEmail,
      metadata: {
        userId: userId,
        tier: 'PRO',
      },
      subscription_data: {
        metadata: {
          userId: userId,
        },
      },
      billing_address_collection: 'required',
      allow_promotion_codes: true, // Allow discount codes
    });

    console.log('Created Stripe checkout session:', session.id);
    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw new Error('Failed to create payment session');
  }
}

/**
 * Handle successful payment - upgrade user to Pro
 */
async function handleSuccessfulPayment(sessionId) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription']
    });
    
    console.log('Retrieved session:', session.id, 'Status:', session.payment_status);
    
    if (session.payment_status === 'paid') {
      const userId = session.metadata.userId;
      const subscription = session.subscription;
      
      // Calculate subscription end date
      let subscriptionExpiresAt = null;
      if (subscription && subscription.current_period_end) {
        subscriptionExpiresAt = new Date(subscription.current_period_end * 1000).toISOString();
      }
      
      // Update user tier in database
      const { error } = await supabase
        .from('user_profiles')
        .update({
          tier: 'PRO',
          stripe_customer_id: session.customer,
          subscription_expires_at: subscriptionExpiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Error updating user tier:', error);
        throw error;
      }

      console.log(`User ${userId} upgraded to Pro successfully`);
      
      // Log the upgrade
      await logUpgrade(userId, {
        sessionId: session.id,
        subscriptionId: subscription?.id,
        amount: session.amount_total,
        interval: subscription?.items?.data[0]?.price?.recurring?.interval
      });
      
      return { 
        success: true, 
        userId, 
        subscriptionId: subscription?.id,
        expiresAt: subscriptionExpiresAt 
      };
    } else {
      throw new Error('Payment not completed');
    }
  } catch (error) {
    console.error('Error handling successful payment:', error);
    throw error;
  }
}

/**
 * Get customer subscription info
 */
async function getCustomerSubscription(customerId) {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    return subscriptions.data[0] || null;
  } catch (error) {
    console.error('Error getting customer subscription:', error);
    return null;
  }
}

/**
 * Cancel customer subscription
 */
async function cancelSubscription(subscriptionId) {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    console.log('Subscription set to cancel at period end:', subscriptionId);
    return subscription;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
}

/**
 * Create customer portal session for subscription management
 */
async function createPortalSession(customerId, returnUrl) {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session;
  } catch (error) {
    console.error('Error creating portal session:', error);
    throw error;
  }
}

/**
 * Log upgrade event
 */
async function logUpgrade(userId, metadata) {
  try {
    const { error } = await supabase
      .from('usage_logs')
      .insert({
        user_id: userId,
        action: 'upgrade_to_pro',
        metadata: metadata,
        created_at: new Date().toISOString()
      });
      
    if (error) {
      console.error('Error logging upgrade:', error);
    }
  } catch (error) {
    console.error('Error in logUpgrade:', error);
  }
}

module.exports = {
  createCheckoutSession,
  handleSuccessfulPayment,
  getCustomerSubscription,
  cancelSubscription,
  createPortalSession,
  stripe
};