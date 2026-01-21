import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FamilyProvider } from './contexts/FamilyContext';
import { ViewProvider, useView } from './contexts/ViewContext';
import { AuthRouter } from './components/Auth/AuthRouter';
import { LandingPage } from './components/Landing';
import { Header } from './components/Header';
import { WeeklyCalendar } from './components/WeeklyCalendar';
import { FamilyPlanboard } from './components/FamilyPlanboard';
import { StatsOverview } from './components/StatsOverview';
import { Leaderboard } from './components/Leaderboard';
import { Achievements } from './components/Achievements';
import { AdminPanel } from './components/AdminPanel';
import { ChildDashboard } from './components/Child';

function Dashboard() {
  const { isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <StatsOverview />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Leaderboard />
          {isAdmin && <AdminPanel />}
        </div>

        <div className="mb-6">
          <WeeklyCalendar />
        </div>

        <div>
          <Achievements />
        </div>
      </main>
    </div>
  );
}

function FamilyPlanboardView() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <FamilyPlanboard />
      </main>
    </div>
  );
}

function MainContent() {
  const { currentView } = useView();
  const { isPinUser, familyMember } = useAuth();

  // PIN users always get the ChildDashboard (even if they're admins)
  if (isPinUser && familyMember) {
    return <ChildDashboard />;
  }

  // Parents can opt into child-mode to see the gamified interface
  if (currentView === 'child-mode' && familyMember) {
    return <ChildDashboard />;
  }

  // Regular users get the standard views
  return currentView === 'dashboard' ? <Dashboard /> : <FamilyPlanboardView />;
}

type AppView = 'landing' | 'auth' | 'app';

function getInitialView(): { view: AppView; authMode: 'login' | 'register' } {
  const path = window.location.pathname;

  if (path === '/login') {
    return { view: 'auth', authMode: 'login' };
  }
  if (path === '/register' || path === '/signup') {
    return { view: 'auth', authMode: 'register' };
  }
  // Root path or any other path - will determine based on auth state
  return { view: 'landing', authMode: 'login' };
}

function AppRouter() {
  const { user, familyMember, isLoading, isPinUser } = useAuth();
  const [appView, setAppView] = useState<AppView>(getInitialView().view);
  const [authMode, setAuthMode] = useState<'login' | 'register'>(getInitialView().authMode);

  // Listen for URL changes
  useEffect(() => {
    const handlePopState = () => {
      const { view, authMode: mode } = getInitialView();
      setAppView(view);
      setAuthMode(mode);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update view when auth state changes
  useEffect(() => {
    if (!isLoading) {
      const isAuthenticated = (isPinUser && familyMember) || user;
      if (isAuthenticated) {
        setAppView('app');
        // Clear URL to root when authenticated
        if (window.location.pathname !== '/') {
          window.history.replaceState({}, '', '/');
        }
      }
    }
  }, [user, familyMember, isPinUser, isLoading]);

  const navigateTo = (view: AppView, mode?: 'login' | 'register') => {
    const paths: Record<string, string> = {
      landing: '/',
      auth: mode === 'register' ? '/register' : '/login',
      app: '/',
    };
    window.history.pushState({}, '', paths[view] || '/');
    setAppView(view);
    if (mode) setAuthMode(mode);
  };

  // Show loading spinner
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const isAuthenticated = (isPinUser && familyMember) || user;

  // Authenticated users see the app
  if (isAuthenticated) {
    // If user has no family member record yet, show family setup via AuthRouter
    if (user && !familyMember) {
      return <AuthRouter />;
    }
    return <MainContent />;
  }

  // Unauthenticated users
  // Show landing page on root path
  if (appView === 'landing' && window.location.pathname === '/') {
    return (
      <LandingPage
        onGetStarted={() => navigateTo('auth', 'register')}
        onLogin={() => navigateTo('auth', 'login')}
      />
    );
  }

  // Show auth pages (login/register)
  return <AuthRouter initialMode={authMode} />;
}

function App() {
  return (
    <AuthProvider>
      <FamilyProvider>
        <ViewProvider>
          <AppRouter />
        </ViewProvider>
      </FamilyProvider>
    </AuthProvider>
  );
}

export default App;
