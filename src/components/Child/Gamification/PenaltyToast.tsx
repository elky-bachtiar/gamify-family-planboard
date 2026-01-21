import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';
import type { PointsHistory } from '../../../types';

interface PenaltyToastProps {
  penalty: PointsHistory;
  onClose: () => void;
  autoCloseDelay?: number;
}

export function PenaltyToast({
  penalty,
  onClose,
  autoCloseDelay = 5000
}: PenaltyToastProps) {
  const { t } = useTranslation(['gamification']);
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

  // Extract reason without "Straf: " prefix for display
  const displayReason = penalty.reason?.replace(/^Straf:\s*/i, '') || t('gamification:child.penalty.unknownReason');

  return (
    <div
      className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-2xl shadow-2xl overflow-hidden max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-black/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              {t('gamification:child.penalty.title')}
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
          {/* Points lost indicator */}
          <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-xl font-bold">{penalty.points}</span>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg">
              {t('gamification:child.penalty.pointsLost', { points: Math.abs(penalty.points) })}
            </h3>
            <p className="text-sm text-white/80 truncate">{displayReason}</p>
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
