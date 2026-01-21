import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { AchievementToast } from '../components/Child/Gamification/AchievementToast';
import type { NewlyAwardedAchievement } from '../lib/gamification';

interface AchievementNotificationContextType {
  showAchievements: (achievements: NewlyAwardedAchievement[]) => void;
}

const AchievementNotificationContext = createContext<AchievementNotificationContextType | null>(null);

export function AchievementNotificationProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<NewlyAwardedAchievement[]>([]);
  const [current, setCurrent] = useState<NewlyAwardedAchievement | null>(null);

  const showAchievements = useCallback((achievements: NewlyAwardedAchievement[]) => {
    if (achievements.length === 0) return;

    setQueue(prev => [...prev, ...achievements]);
  }, []);

  // Process queue - show next achievement when current one is dismissed
  const handleClose = useCallback(() => {
    setCurrent(null);
  }, []);

  // When queue changes and no current, show next
  if (queue.length > 0 && !current) {
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
  }

  return (
    <AchievementNotificationContext.Provider value={{ showAchievements }}>
      {children}
      {current && (
        <AchievementToast
          achievement={{
            id: current.id,
            name: current.name,
            description: current.description,
            icon: current.icon,
            condition_type: 'first_task', // Not used for display
            condition_value: 0, // Not used for display
            family_id: null,
            created_at: new Date().toISOString(),
          }}
          onClose={handleClose}
          autoCloseDelay={4000}
        />
      )}
    </AchievementNotificationContext.Provider>
  );
}

export function useAchievementNotification() {
  const context = useContext(AchievementNotificationContext);
  if (!context) {
    throw new Error('useAchievementNotification must be used within AchievementNotificationProvider');
  }
  return context;
}
