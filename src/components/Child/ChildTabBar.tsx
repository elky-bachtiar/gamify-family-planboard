import { useTranslation } from 'react-i18next';
import { Home, Trophy, BarChart3, Medal, Gift } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export type ChildViewTab = 'home' | 'leaderboard' | 'badges' | 'stats' | 'rewards';

interface ChildTabBarProps {
  activeTab: ChildViewTab;
  onTabChange: (tab: ChildViewTab) => void;
}

export function ChildTabBar({ activeTab, onTabChange }: ChildTabBarProps) {
  const { t } = useTranslation('gamification');
  const { family } = useAuth();

  // Only show rewards tab if rewards are enabled (point_to_money_rate > 0)
  const showRewardsTab = (family?.point_to_money_rate ?? 0) > 0;

  const tabs = [
    { id: 'home' as ChildViewTab, labelKey: 'child.tabs.home', icon: Home },
    { id: 'leaderboard' as ChildViewTab, labelKey: 'child.tabs.leaderboard', icon: Medal },
    { id: 'badges' as ChildViewTab, labelKey: 'child.tabs.badges', icon: Trophy },
    { id: 'stats' as ChildViewTab, labelKey: 'child.tabs.stats', icon: BarChart3 },
    ...(showRewardsTab
      ? [{ id: 'rewards' as ChildViewTab, labelKey: 'child.tabs.rewards', icon: Gift }]
      : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-bottom">
      <div className="flex items-center justify-around py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-all duration-200
                ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Icon
                className={`w-6 h-6 transition-transform duration-200 ${
                  isActive ? 'scale-110' : ''
                }`}
                fill={isActive ? 'currentColor' : 'none'}
              />
              <span className={`text-xs font-medium ${isActive ? 'text-blue-600' : ''}`}>
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
