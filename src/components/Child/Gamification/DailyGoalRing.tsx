interface DailyGoalRingProps {
  completed: number;
  total: number;
  size?: number;
}

export function DailyGoalRing({ completed, total, size = 80 }: DailyGoalRingProps) {
  const progress = total > 0 ? (completed / total) * 100 : 0;
  const isComplete = completed >= total && total > 0;

  // SVG circle calculations
  const strokeWidth = size * 0.1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const getProgressColor = () => {
    if (isComplete) return '#22C55E'; // green-500
    if (progress >= 50) return '#3B82F6'; // blue-500
    return '#94A3B8'; // gray-400
  };

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Background circle */}
      <svg className="absolute transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getProgressColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>

      {/* Center content */}
      <div className="flex flex-col items-center justify-center">
        {isComplete ? (
          <span className="text-xl">✅</span>
        ) : (
          <>
            <span className="text-lg font-bold text-gray-800">
              {completed}/{total}
            </span>
            <span className="text-xs text-gray-500">tasks</span>
          </>
        )}
      </div>
    </div>
  );
}
