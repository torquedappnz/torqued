import React, { useState, useEffect, useCallback } from 'react';
import { Landing } from './views/Landing';
import { CustomerPortal } from './views/CustomerPortal';
import { MechanicPortal } from './views/MechanicPortal';
import { AdminPortal } from './views/AdminPortal';
import { useAuth } from './context/AuthContext';

type View = 'landing' | 'customer' | 'mechanic' | 'admin';

function pathToView(path: string): View | null {
  if (path.startsWith('/customer')) return 'customer';
  if (path.startsWith('/mechanic')) return 'mechanic';
  if (path.startsWith('/admin')) return 'admin';
  if (path === '/' || path === '') return 'landing';
  return null;
}

export default function App() {
  const [view, setView] = useState<View>('landing');
  const { isAuthReady, user, userRole } = useAuth();

  const navigateTo = useCallback((next: View) => {
    const path = next === 'landing' ? '/' : `/${next}`;
    window.history.pushState({ view: next }, '', path);
    setView(next);
  }, []);

  // Initialise view from URL and handle browser back/forward
  useEffect(() => {
    const fromPath = pathToView(window.location.pathname);
    if (fromPath) setView(fromPath);

    const onPop = (e: PopStateEvent) => {
      const v: View = e.state?.view ?? pathToView(window.location.pathname) ?? 'landing';
      setView(v);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Redirect logged-in users to their portal if on landing
  useEffect(() => {
    if (user && userRole && view === 'landing') {
      navigateTo(userRole === 'mechanic' ? 'mechanic' : 'customer');
    }
  }, [user, userRole]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-torqued-dark flex items-center justify-center text-white">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-torqued-red border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-bold tracking-tight text-sm text-white/50 animate-pulse">LOADING...</p>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (view) {
      case 'landing':
        return (
          <Landing
            onGetQuote={() => navigateTo('customer')}
            onMechanicPortal={() => navigateTo('mechanic')}
          />
        );
      case 'customer':
        return <CustomerPortal onBack={() => navigateTo('landing')} />;
      case 'mechanic':
        return <MechanicPortal onBack={() => navigateTo('landing')} />;
      case 'admin':
        return <AdminPortal onBack={() => navigateTo('landing')} />;
      default:
        return <Landing onGetQuote={() => navigateTo('customer')} onMechanicPortal={() => navigateTo('mechanic')} />;
    }
  };

  return (
    <div className="min-h-screen font-sans selection:bg-torqued-red selection:text-white">
      {renderView()}
    </div>
  );
}
