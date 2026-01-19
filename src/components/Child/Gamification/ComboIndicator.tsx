import { Zap } from 'lucide-react';

interface ComboIndicatorProps {
  comboCount: number;
  maxBonus?: number;
  bonusPercent?: number;
}

export function ComboIndicator({
  comboCount,
  maxBonus = 50,
  bonusPercent = 10
}: ComboIndicatorProps) {
  if (comboCount <= 0) return null;

  const currentBonus = Math.min(comboCount * bonusPercent, maxBonus);
  const isMaxed = currentBonus >= maxBonus;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-sm
        ${isMaxed
          ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-lg'
          : 'bg-orange-100 text-orange-700'
        } animate-bounce-in`}
    >
      <Zap
        className={`w-4 h-4 ${isMaxed ? 'animate-pulse' : ''}`}
        fill={isMaxed ? 'currentColor' : 'none'}
      />
      <span>x{comboCount}</span>
      <span className={`${isMaxed ? 'text-yellow-100' : 'text-orange-500'}`}>
        +{currentBonus}%
      </span>
    </div>
  );
}

// Utility function for calculating combo bonus
export function calculateComboBonus(
  basePoints: number,
  comboCount: number,
  bonusPercent: number = 10,
  maxBonus: number = 50
): { bonus: number; total: number; bonusPercent: number } {
  const currentBonusPercent = Math.min(comboCount * bonusPercent, maxBonus);
  const bonus = Math.floor(basePoints * (currentBonusPercent / 100));
  return {
    bonus,
    total: basePoints + bonus,
    bonusPercent: currentBonusPercent,
  };
}

// Constants for combo system
export const COMBO_WINDOW_MINUTES = 30;
export const COMBO_BONUS_PERCENT = 10;
export const MAX_COMBO_BONUS = 50;

// Check if still within combo window
export function isWithinComboWindow(lastCompletedAt: Date | null): boolean {
  if (!lastCompletedAt) return false;
  const diff = Date.now() - lastCompletedAt.getTime();
  return diff < COMBO_WINDOW_MINUTES * 60 * 1000;
}
