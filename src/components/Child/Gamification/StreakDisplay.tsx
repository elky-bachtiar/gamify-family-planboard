import { Flame } from 'lucide-react';

interface StreakDisplayProps {
  streakDays: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function StreakDisplay({ streakDays, size = 'md', showLabel = true }: StreakDisplayProps) {
  const sizeConfig = {
    sm: { icon: 'w-4 h-4', text: 'text-sm', padding: 'px-2 py-1' },
    md: { icon: 'w-5 h-5', text: 'text-base', padding: 'px-3 py-1.5' },
    lg: { icon: 'w-8 h-8', text: 'text-xl', padding: 'px-4 py-2' },
  };

  const config = sizeConfig[size];

  // Get color based on streak length
  const getStreakColor = () => {
    if (streakDays === 0) return 'text-gray-400 bg-gray-100';
    if (streakDays < 7) return 'text-orange-500 bg-orange-100';
    if (streakDays < 14) return 'text-orange-600 bg-orange-100';
    if (streakDays < 30) return 'text-red-500 bg-red-100';
    return 'text-red-600 bg-gradient-to-r from-red-100 to-orange-100';
  };

  // Check for milestone
  const isMilestone = [7, 14, 30, 50, 100, 365].includes(streakDays);

  if (streakDays === 0) {
    return (
      <div className={`flex items-center gap-1 ${config.padding} rounded-full ${getStreakColor()}`}>
        <Flame className={`${config.icon} opacity-50`} />
        {showLabel && <span className={`${config.text} font-medium`}>No streak</span>}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1 ${config.padding} rounded-full ${getStreakColor()} ${
        isMilestone ? 'ring-2 ring-orange-300 ring-offset-1' : ''
      }`}
    >
      <Flame
        className={`${config.icon} ${streakDays > 0 ? 'animate-flame' : ''}`}
        fill={streakDays >= 7 ? 'currentColor' : 'none'}
      />
      <span className={`${config.text} font-bold`}>{streakDays}</span>
      {showLabel && (
        <span className={`${config.text} font-medium`}>
          {streakDays === 1 ? 'day' : 'days'}
        </span>
      )}
    </div>
  );
}
