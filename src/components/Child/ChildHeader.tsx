import { useTranslation } from 'react-i18next';
import { Star, Flame, Trophy, LogOut, Camera } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { getPointsForNextLevel } from '../../types';

interface ChildHeaderProps {
  onAvatarClick?: () => void;
}

export function ChildHeader({ onAvatarClick }: ChildHeaderProps) {
  const { t } = useTranslation(['gamification', 'tasks', 'common']);
  const { signOut } = useAuth();
  const { currentMember } = useFamily();

  if (!currentMember) return null;

  const levelProgress = getPointsForNextLevel(currentMember.total_points ?? 0);

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('tasks:child.greeting.morning');
    if (hour < 17) return t('tasks:child.greeting.afternoon');
    return t('tasks:child.greeting.evening');
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-40">
      <div className="px-4 py-3">
        {/* Top row: Avatar, greeting, stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar - clickable for profile */}
            <button
              onClick={onAvatarClick}
              className="relative group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full"
              title={t('common:profile.tapToEdit', 'Tap to edit profile')}
            >
              {currentMember.avatar_url ? (
                <img
                  src={currentMember.avatar_url}
                  alt={currentMember.name}
                  className="w-12 h-12 rounded-full object-cover shadow-md group-hover:ring-2 group-hover:ring-blue-400 transition-all"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-md group-hover:ring-2 group-hover:ring-blue-400 transition-all"
                  style={{ backgroundColor: currentMember.color ?? '#3b82f6' }}
                >
                  {currentMember.name.charAt(0).toUpperCase()}
                </div>
              )}
              {/* Camera indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 p-1 bg-blue-500 rounded-full shadow-sm">
                <Camera className="w-3 h-3 text-white" />
              </div>
            </button>

            {/* Greeting */}
            <div>
              <p className="text-sm text-gray-500">{getGreeting()}</p>
              <h1 className="text-lg font-bold text-gray-900">{currentMember.name}!</h1>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-2">
            {/* Streak */}
            {(currentMember.current_streak ?? 0) > 0 && (
              <div className="flex items-center gap-1 bg-orange-100 px-2 py-1 rounded-full">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-semibold text-orange-700">
                  {currentMember.current_streak}
                </span>
              </div>
            )}

            {/* Points */}
            <div className="flex items-center gap-1 bg-amber-100 px-2 py-1 rounded-full">
              <Star className="w-4 h-4 text-amber-500" fill="currentColor" />
              <span className="text-sm font-semibold text-amber-700">
                {(currentMember.total_points ?? 0).toLocaleString()}
              </span>
            </div>

            {/* Sign out */}
            <button
              onClick={signOut}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title={t('common:profile.signOut')}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Level progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <Trophy className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium text-gray-700">
                {t('gamification:level.current', { level: currentMember.current_level })}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {t('gamification:child.header.percentToLevel', {
                percent: Math.round(levelProgress.progress),
                level: (currentMember.current_level ?? 1) + 1,
              })}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-purple-500 to-purple-600"
              style={{ width: `${levelProgress.progress}%` }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
