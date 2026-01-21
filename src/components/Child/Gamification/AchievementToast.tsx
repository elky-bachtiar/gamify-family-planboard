import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, X } from 'lucide-react';
import type { Achievement } from '../../../types';

interface AchievementToastProps {
  achievement: Achievement;
  onClose: () => void;
  autoCloseDelay?: number;
}

export function AchievementToast({
  achievement,
  onClose,
  autoCloseDelay = 5000
}: AchievementToastProps) {
  const { t } = useTranslation('gamification');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const showTimer = setTimeout(() => setIsVisible(true), 50);

    // Auto-close after delay
    const closeTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, autoCloseDelay);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(closeTimer);
    };
  }, [autoCloseDelay, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className="bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-2xl shadow-2xl overflow-hidden max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-black/10">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              {t('achievements.newlyUnlocked')}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3 flex items-center gap-3">
          {/* Badge icon */}
          <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
            {achievement.icon}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg truncate">{achievement.name}</h3>
            <p className="text-sm text-white/80 truncate">{achievement.description}</p>
          </div>
        </div>

        {/* Progress bar animation */}
        <div className="h-1 bg-black/10">
          <div
            className="h-full bg-white/50 transition-all ease-linear"
            style={{
              width: '100%',
              animation: `shrink ${autoCloseDelay}ms linear forwards`,
            }}
          />
        </div>
      </div>

      {/* Add keyframes for the shrinking progress bar */}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
