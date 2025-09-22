import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContextProvider';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';

// Lazy load pages - each becomes a separate chunk
const Dashboard = lazy(() => import('./components/Dashboard'));
const PricingPage = lazy(() => import('./components/PricingPage'));
const PaymentPage = lazy(() => import('./components/PaymentPage'));
const PaymentSuccessPage = lazy(() => import('./components/PaymentSuccessPage'));

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
        <Suspense fallback={<LoadingSpinner />}>
          {renderCurrentPage()}
        </Suspense>
      </ProtectedRoute>
    </AuthProvider>
  );
}

export default App;