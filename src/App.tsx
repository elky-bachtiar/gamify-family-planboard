import { AuthProvider } from './contexts/AuthContext';
import { FamilyProvider } from './contexts/FamilyContext';
import { AuthRouter } from './components/Auth/AuthRouter';
import { Header } from './components/Header';
import { WeeklyCalendar } from './components/WeeklyCalendar';
import { StatsOverview } from './components/StatsOverview';
import { Leaderboard } from './components/Leaderboard';
import { Achievements } from './components/Achievements';

function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <StatsOverview />
          </div>
          <div>
            <Leaderboard />
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

function App() {
  return (
    <AuthProvider>
      <FamilyProvider>
        <AuthRouter />
        <Dashboard />
      </FamilyProvider>
    </AuthProvider>
  );
}

export default App;
