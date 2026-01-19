import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, CheckCircle } from 'lucide-react';
import { useFamily } from '../../../contexts/FamilyContext';
import { getPointsForNextLevel } from '../../../types';
import type { Task } from '../../../types';

interface ApprovalCelebrationProps {
  task: Task;
  onClose: () => void;
}

interface Confetti {
  id: number;
  x: number;
  color: string;
  delay: number;
  duration: number;
}

export function ApprovalCelebration({ task, onClose }: ApprovalCelebrationProps) {
  const { t } = useTranslation('gamification');
  const { currentMember } = useFamily();
  const [phase, setPhase] = useState<'enter' | 'show' | 'ready'>('enter');
  const [confetti, setConfetti] = useState<Confetti[]>([]);

  // Generate confetti
  useEffect(() => {
    const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#6BCB77'];
    const newConfetti: Confetti[] = [];

    for (let i = 0; i < 50; i++) {
      newConfetti.push({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2,
      });
    }

    setConfetti(newConfetti);
  }, []);

  useEffect(() => {
    const enterTimer = setTimeout(() => setPhase('show'), 100);
    const readyTimer = setTimeout(() => setPhase('ready'), 500);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(readyTimer);
    };
  }, []);

  const levelProgress = currentMember ? getPointsForNextLevel(currentMember.total_points) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-br from-purple-600/90 to-blue-600/90 backdrop-blur-sm
          transition-opacity duration-300 ${phase === 'enter' ? 'opacity-0' : 'opacity-100'}`}
        onClick={phase === 'ready' ? onClose : undefined}
      />

      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confetti.map(c => (
          <div
            key={c.id}
            className="absolute w-3 h-3 rounded-sm animate-confetti-fall"
            style={{
              left: `${c.x}%`,
              backgroundColor: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div
        className={`relative z-10 text-center px-6 max-w-sm mx-auto transition-all duration-500
          ${phase === 'enter' ? 'scale-50 opacity-0' : 'scale-100 opacity-100'}`}
      >
        {/* Success icon */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 rounded-full mb-4 animate-bounce-in">
            <CheckCircle className="w-16 h-16 text-white" />
          </div>
        </div>

        {/* Approved text */}
        <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">
          {t('child.celebration.approvedBig')}
        </h1>

        {/* Task name */}
        <p className="text-xl text-white/90 mb-6">
          "{task.title}"
        </p>

        {/* Points earned */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl mb-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Star className="w-10 h-10 text-amber-400 animate-pulse" fill="currentColor" />
            <span className="text-5xl font-bold text-amber-500">+{task.point_value}</span>
          </div>

          {currentMember && (
            <div className="text-gray-600">
              <p className="text-sm mb-2">
                {t('child.celebration.total', { points: currentMember.total_points.toLocaleString() })}
              </p>

              {levelProgress && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>{t('level.current', { level: currentMember.current_level })}</span>
                    <span>{Math.round(levelProgress.progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-1000"
                      style={{ width: `${levelProgress.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Close button */}
        {phase === 'ready' && (
          <button
            onClick={onClose}
            className="bg-white text-purple-600 font-bold py-4 px-12 rounded-xl shadow-lg
              hover:shadow-xl transform hover:scale-105 transition-all duration-200 animate-fade-in"
          >
            {t('child.celebration.awesome')}
          </button>
        )}
      </div>
    </div>
  );
}
