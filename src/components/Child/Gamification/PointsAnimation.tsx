import { useEffect, useState } from 'react';
import { Star, Clock } from 'lucide-react';

interface PointsAnimationProps {
  points: number;
  isPending?: boolean;
  onComplete: () => void;
}

export function PointsAnimation({ points, isPending = false, onComplete }: PointsAnimationProps) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');

  useEffect(() => {
    // Phase 1: Enter animation
    const showTimer = setTimeout(() => setPhase('show'), 100);

    // Phase 2: Show for a moment
    const exitTimer = setTimeout(() => setPhase('exit'), 2000);

    // Phase 3: Complete
    const completeTimer = setTimeout(() => onComplete(), 2500);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          phase === 'enter' ? 'opacity-0' : phase === 'exit' ? 'opacity-0' : 'opacity-40'
        }`}
      />

      {/* Content */}
      <div
        className={`relative flex flex-col items-center transition-all duration-500 ${
          phase === 'enter'
            ? 'scale-0 opacity-0'
            : phase === 'exit'
            ? 'scale-150 opacity-0 -translate-y-20'
            : 'scale-100 opacity-100'
        }`}
      >
        {/* Sparkles */}
        <div className="absolute inset-0 -z-10">
          {[...Array(8)].map((_, i) => (
            <span
              key={i}
              className={`absolute text-2xl animate-sparkle-${i % 4}`}
              style={{
                left: `${50 + 40 * Math.cos((i * Math.PI) / 4)}%`,
                top: `${50 + 40 * Math.sin((i * Math.PI) / 4)}%`,
                animationDelay: `${i * 0.1}s`,
              }}
            >
              ✨
            </span>
          ))}
        </div>

        {/* Main celebration text */}
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>

          <h2 className="text-2xl font-bold text-white mb-4 drop-shadow-lg">
            Awesome Job!
          </h2>

          {/* Points display */}
          <div className="flex items-center justify-center gap-2 bg-white/95 backdrop-blur-sm px-6 py-3 rounded-2xl shadow-2xl">
            <Star className="w-8 h-8 text-amber-400" fill="currentColor" />
            <span className="text-4xl font-bold text-amber-600">+{points}</span>
          </div>

          {/* Pending message */}
          {isPending && (
            <div className="mt-4 flex items-center justify-center gap-2 bg-yellow-100/90 backdrop-blur-sm text-yellow-700 px-4 py-2 rounded-full">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Waiting for approval</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
