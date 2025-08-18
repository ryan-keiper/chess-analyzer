import React, { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './components/Dashboard';
import PricingPage from './components/PricingPage';
import PaymentPage from './components/PaymentPage';
import PaymentSuccessPage from './components/PaymentSuccessPage';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard'); // dashboard, pricing, payment, payment-success
  const [paymentDetails, setPaymentDetails] = useState(null);

  // Check URL on app load to handle Stripe redirects
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/payment-success') {
      setCurrentPage('payment-success');
    }
  }, []);

  const handleNavigateToPage = (page, details = null) => {
    if (page === 'payment' && details) {
      setPaymentDetails(details);
    }
    setCurrentPage(page);
    
    // Update URL for navigation (optional - keeps URL in sync)
    if (page === 'dashboard') {
      window.history.pushState({}, '', '/');
    } else {
      window.history.pushState({}, '', `/${page}`);
    }
  };

  const handleUpgrade = (planDetails, billingCycle) => {
    setPaymentDetails({ planDetails, billingCycle });
    setCurrentPage('payment');
    window.history.pushState({}, '', '/payment');
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'pricing':
        return (
          <PricingPage
            onBack={() => setCurrentPage('dashboard')}
            onUpgrade={handleUpgrade}
            onNavigateToPage={handleNavigateToPage}
          />
        );
      case 'payment':
        return (
          <PaymentPage
            onBack={() => setCurrentPage('pricing')}
            planDetails={paymentDetails?.planDetails}
            billingCycle={paymentDetails?.billingCycle || 'monthly'}
            onNavigateToPage={handleNavigateToPage}
          />
        );
      case 'payment-success':
        return (
          <PaymentSuccessPage
            onNavigateToPage={handleNavigateToPage}
          />
        );
      default:
        return <Dashboard onNavigateToPage={handleNavigateToPage} />;
    }
  };

  return (
    <AuthProvider>
      <ProtectedRoute>
        {renderCurrentPage()}
      </ProtectedRoute>
    </AuthProvider>
  );
}

export default App;