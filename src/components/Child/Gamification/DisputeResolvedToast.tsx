import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Coins } from 'lucide-react';

interface DisputeResolvedToastProps {
  isOpen: boolean;
  onClose: () => void;
  status: 'approved' | 'rejected';
  pointsRestored?: number;
  resolutionNote?: string;
}

export function DisputeResolvedToast({
  isOpen,
  onClose,
  status,
  pointsRestored,
  resolutionNote,
}: DisputeResolvedToastProps) {
  const { t } = useTranslation(['gamification']);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Trigger animation
      setTimeout(() => setIsVisible(true), 10);

      // Auto close after 5 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for exit animation
  };

  if (!isOpen) return null;

  const isApproved = status === 'approved';

  return (
    <div
      className={`
        fixed top-4 left-4 right-4 z-50 mx-auto max-w-sm
        transition-all duration-300 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
      `}
    >
      <div
        className={`
          rounded-xl shadow-lg overflow-hidden
          ${isApproved ? 'bg-green-500' : 'bg-red-500'}
        `}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div
              className={`
                w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                ${isApproved ? 'bg-green-400' : 'bg-red-400'}
              `}
            >
              {isApproved ? (
                <Check className="w-6 h-6 text-white" />
              ) : (
                <X className="w-6 h-6 text-white" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-bold text-lg">
                {isApproved
                  ? t('gamification:disputes.toastApproved', 'Dispute Approved!')
                  : t('gamification:disputes.toastRejected', 'Dispute Rejected')}
              </h4>

              {isApproved && pointsRestored ? (
                <div className="flex items-center gap-2 mt-1 text-green-100">
                  <Coins className="w-4 h-4" />
                  <span>
                    {t('gamification:disputes.pointsRestored', '+{{points}} points restored!', {
                      points: pointsRestored,
                    })}
                  </span>
                </div>
              ) : null}

              {resolutionNote && (
                <p className="text-sm text-white/80 mt-2 italic">"{resolutionNote}"</p>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={handleClose}
              className="p-1 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/20">
          <div
            className={`h-full bg-white/40 ${isVisible ? 'animate-shrink' : ''}`}
            style={{
              animation: isVisible ? 'shrink 5s linear forwards' : 'none',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}
