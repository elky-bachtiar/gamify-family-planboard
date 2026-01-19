import { Trophy } from 'lucide-react';
import { getPointsForNextLevel, LEVEL_THRESHOLDS } from '../../../types';

interface LevelProgressProps {
  totalPoints: number;
  currentLevel: number;
  compact?: boolean;
}

export function LevelProgress({ totalPoints, currentLevel, compact = false }: LevelProgressProps) {
  const progress = getPointsForNextLevel(totalPoints);
  const isMaxLevel = currentLevel >= LEVEL_THRESHOLDS.length;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-purple-100 px-2 py-1 rounded-full">
          <Trophy className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-bold text-purple-700">Lv.{currentLevel}</span>
        </div>
        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden min-w-[60px]">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500"
            style={{ width: `${progress.progress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Trophy className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Level {currentLevel}</h3>
            <p className="text-xs text-gray-500">
              {totalPoints.toLocaleString()} total points
            </p>
          </div>
        </div>

        {!isMaxLevel && (
          <div className="text-right">
            <p className="text-sm font-medium text-purple-600">
              {Math.round(progress.progress)}%
            </p>
            <p className="text-xs text-gray-500">
              to Level {currentLevel + 1}
            </p>
          </div>
        )}
      </div>

      {!isMaxLevel ? (
        <div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>{progress.current} pts in level</span>
            <span>{progress.next - totalPoints} pts to go</span>
          </div>
        </div>
      ) : (
        <div className="text-center py-2">
          <span className="text-sm font-medium text-purple-600">
            🎉 Maximum Level Reached!
          </span>
        </div>
      )}
    </div>
  );
}
