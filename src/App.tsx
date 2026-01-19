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

function Dashboard() {
  const { isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <StatsOverview />
          </div>
          <div className="space-y-6">
            <Leaderboard />
            {isAdmin && <AdminPanel />}
          </div>
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
  const { isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <StatsOverview />
          </div>
          <div className="space-y-6">
            <Leaderboard />
            {isAdmin && <AdminPanel />}
          </div>
        </div>

        <div className="mb-6">
          <FamilyPlanboard />
        </div>

        <div>
          <Achievements />
        </div>
      </main>
    </div>
  );
}

function MainContent() {
  const { currentView } = useView();

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
