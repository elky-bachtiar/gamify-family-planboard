import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flame, Sparkles } from 'lucide-react';
import { useFamily } from '../../contexts/FamilyContext';

interface DailyGreetingProps {
  onDismiss: () => void;
  autoDismissDelay?: number;
}

export function DailyGreeting({ onDismiss, autoDismissDelay = 3000 }: DailyGreetingProps) {
  const { t } = useTranslation(['gamification', 'tasks']);
  const { currentMember } = useFamily();
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');

  useEffect(() => {
    const enterTimer = setTimeout(() => setPhase('show'), 100);
    const exitTimer = setTimeout(() => setPhase('exit'), autoDismissDelay);
    const dismissTimer = setTimeout(onDismiss, autoDismissDelay + 500);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(dismissTimer);
    };
  }, [autoDismissDelay, onDismiss]);

  if (!currentMember) return null;

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('tasks:child.greeting.morning');
    if (hour < 17) return t('tasks:child.greeting.afternoon');
    return t('tasks:child.greeting.evening');
  };

  // Get motivational message based on streak
  const getMotivation = () => {
    const streak = currentMember.current_streak;
    if (streak === 0) return t('gamification:child.dailyGreeting.motivation.startStreak');
    if (streak < 3) return t('gamification:child.dailyGreeting.motivation.greatStart');
    if (streak < 7) return t('gamification:child.dailyGreeting.motivation.momentum');
    if (streak < 14) return t('gamification:child.dailyGreeting.motivation.onFire');
    if (streak < 30) return t('gamification:child.dailyGreeting.motivation.dedication');
    return t('gamification:child.dailyGreeting.motivation.superstar');
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${
        phase === 'enter' ? 'opacity-0' : phase === 'exit' ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={onDismiss}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600" />

      {/* Decorative sparkles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <Sparkles
            key={i}
            className="absolute text-white/20 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${20 + Math.random() * 30}px`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div
        className={`relative text-center px-8 transition-all duration-500 ${
          phase === 'enter'
            ? 'scale-50 opacity-0'
            : phase === 'exit'
            ? 'scale-110 opacity-0'
            : 'scale-100 opacity-100'
        }`}
      >
        {/* Avatar */}
        <div
          className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl font-bold text-white shadow-2xl animate-bounce-in"
          style={{ backgroundColor: currentMember.color }}
        >
          {currentMember.name.charAt(0).toUpperCase()}
        </div>

        {/* Greeting */}
        <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
          {getGreeting()}, {currentMember.name}!
        </h1>

        {/* Streak display */}
        {currentMember.current_streak > 0 && (
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full mb-4">
            <Flame className="w-8 h-8 text-orange-300 animate-flame" fill="currentColor" />
            <span className="text-3xl font-bold text-white">{currentMember.current_streak}</span>
            <span className="text-lg text-white/90">{t('gamification:child.dailyGreeting.dayStreak')}</span>
          </div>
        )}

        {/* Motivation */}
        <p className="text-xl text-white/90 mb-8">{getMotivation()}</p>

        {/* CTA Button */}
        <button
          onClick={onDismiss}
          className="bg-white text-purple-600 font-bold py-4 px-12 rounded-xl shadow-lg
            hover:shadow-xl transform hover:scale-105 transition-all duration-200"
        >
          {t('gamification:child.dailyGreeting.letsGo')}
        </button>

        {/* Tap to dismiss hint */}
        <p className="text-white/60 text-sm mt-6">{t('gamification:child.dailyGreeting.tapToContinue')}</p>
      </div>
    </div>
  );
}
