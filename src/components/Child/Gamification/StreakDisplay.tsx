import { useState, useEffect } from 'react';
import { Flame, Shield, AlertTriangle } from 'lucide-react';
import type { FamilyMember } from '../../../types';
import {
  isInStreakGracePeriod,
  getGracePeriodTimeRemaining,
  formatTimeRemaining,
  getStreakFreezeInfo,
} from '../../../lib/gamification';

interface StreakDisplayProps {
  streakDays: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  member?: FamilyMember | null;
  showGracePeriod?: boolean;
}

export function StreakDisplay({
  streakDays,
  size = 'md',
  showLabel = true,
  member = null,
  showGracePeriod = true,
}: StreakDisplayProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  const sizeConfig = {
    sm: { icon: 'w-4 h-4', text: 'text-sm', padding: 'px-2 py-1' },
    md: { icon: 'w-5 h-5', text: 'text-base', padding: 'px-3 py-1.5' },
    lg: { icon: 'w-8 h-8', text: 'text-xl', padding: 'px-4 py-2' },
  };

  const config = sizeConfig[size];

  // Check grace period status
  const inGracePeriod = member && showGracePeriod ? isInStreakGracePeriod(member) : false;
  const freezeInfo = member ? getStreakFreezeInfo(member) : null;

  // Update countdown timer
  useEffect(() => {
    if (!inGracePeriod || !member) return;

    const updateTimer = () => {
      setTimeRemaining(getGracePeriodTimeRemaining(member));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [inGracePeriod, member]);

  // Get color based on streak length and grace period
  const getStreakColor = () => {
    if (inGracePeriod) return 'text-yellow-600 bg-yellow-100 animate-pulse';
    if (streakDays === 0) return 'text-gray-400 bg-gray-100';
    if (streakDays < 7) return 'text-orange-500 bg-orange-100';
    if (streakDays < 14) return 'text-orange-600 bg-orange-100';
    if (streakDays < 30) return 'text-red-500 bg-red-100';
    return 'text-red-600 bg-gradient-to-r from-red-100 to-orange-100';
  };

  // Check for milestone
  const isMilestone = [7, 14, 30, 50, 100, 365].includes(streakDays);

  if (streakDays === 0 && !inGracePeriod) {
    return (
      <div className={`flex items-center gap-1 ${config.padding} rounded-full ${getStreakColor()}`}>
        <Flame className={`${config.icon} opacity-50`} />
        {showLabel && <span className={`${config.text} font-medium`}>No streak</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex items-center gap-1 ${config.padding} rounded-full ${getStreakColor()} ${
          isMilestone ? 'ring-2 ring-orange-300 ring-offset-1' : ''
        }`}
      >
        {inGracePeriod ? (
          <AlertTriangle className={`${config.icon}`} />
        ) : (
          <Flame
            className={`${config.icon} ${streakDays > 0 ? 'animate-flame' : ''}`}
            fill={streakDays >= 7 ? 'currentColor' : 'none'}
          />
        )}
        <span className={`${config.text} font-bold`}>{streakDays}</span>
        {showLabel && (
          <span className={`${config.text} font-medium`}>{streakDays === 1 ? 'day' : 'days'}</span>
        )}
      </div>

      {/* Grace period warning */}
      {inGracePeriod && timeRemaining > 0 && (
        <div className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded-full flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          <span>{formatTimeRemaining(timeRemaining)} left!</span>
        </div>
      )}

      {/* Freeze indicator */}
      {freezeInfo && freezeInfo.currentFreezes > 0 && !inGracePeriod && size !== 'sm' && (
        <div className="text-xs text-blue-600 flex items-center gap-1">
          <Shield className="w-3 h-3" />
          <span>
            {freezeInfo.currentFreezes} freeze{freezeInfo.currentFreezes !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
