import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FamilyProvider } from './contexts/FamilyContext';
import { ViewProvider, useView } from './contexts/ViewContext';
import { AuthRouter } from './components/Auth/AuthRouter';
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
  const { isPinUser, isAdmin, familyMember } = useAuth();

  // PIN users (children) get the mobile-first ChildDashboard
  if (isPinUser && !isAdmin && familyMember) {
    return <ChildDashboard />;
  }

  // Regular users get the standard views
  return currentView === 'dashboard' ? <Dashboard /> : <FamilyPlanboardView />;
}

function App() {
  return (
    <AuthProvider>
      <FamilyProvider>
        <ViewProvider>
          <AuthRouter />
          <MainContent />
        </ViewProvider>
      </FamilyProvider>
    </AuthProvider>
  );
}

export default App;
