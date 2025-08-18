import { loadStripe } from '@stripe/stripe-js';
import api from './api';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

/**
 * Create a checkout session and redirect to Stripe
 */
export const createCheckoutSession = async (userId, userEmail, billingCycle = 'monthly') => {
  try {
    console.log('Creating checkout session...', { userId, userEmail, billingCycle });
    
    const response = await api.post('/api/payment/create-checkout-session', {
      userId,
      userEmail,
      billingCycle
    });

    if (response.success && response.url) {
      return response;
    } else {
      throw new Error('Invalid response from server');
    }
  } catch (error) {
    console.error('Checkout session error:', error);
    throw new Error(error.response?.data?.error || 'Failed to create checkout session');
  }
};

/**
 * Handle successful payment completion
 */
export const handlePaymentSuccess = async (sessionId) => {
  try {
    console.log('Handling payment success...', sessionId);
    
    const response = await api.post('/api/payment/payment-success', {
      sessionId
    });

    if (response.success) {
      return response.data;
    } else {
      throw new Error('Payment verification failed');
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    throw new Error(error.response?.data?.error || 'Failed to verify payment');
  }
};

/**
 * Redirect to Stripe Checkout
 */
export const redirectToCheckout = async (userId, userEmail, billingCycle = 'monthly') => {
  try {
    const stripe = await stripePromise;
    if (!stripe) {
      throw new Error('Stripe failed to load');
    }

    // Create checkout session
    const session = await createCheckoutSession(userId, userEmail, billingCycle);
    
    // Redirect to Stripe Checkout
    window.location.href = session.url;
    
  } catch (error) {
    console.error('Stripe redirect error:', error);
    throw error;
  }
};

/**
 * Create a customer portal session for subscription management
 */
export const createPortalSession = async (customerId) => {
  try {
    console.log('Creating portal session...', customerId);
    
    const response = await api.post('/api/payment/create-portal-session', {
      customerId,
      returnUrl: `${window.location.origin}/dashboard`
    });

    if (response.success && response.url) {
      window.location.href = response.url;
    } else {
      throw new Error('Failed to create portal session');
    }
  } catch (error) {
    console.error('Portal session error:', error);
    throw new Error(error.response?.data?.error || 'Failed to access customer portal');
  }
};

export default {
  createCheckoutSession,
  handlePaymentSuccess,
  redirectToCheckout,
  createPortalSession
};