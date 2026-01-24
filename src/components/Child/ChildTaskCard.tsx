import { useTranslation } from 'react-i18next';
import {
  Circle,
  CheckCircle,
  Clock,
  Star,
  ChevronRight,
  Hand,
  Tag,
  CalendarDays,
  Sparkles,
  Trophy,
  Gift,
  BookOpen,
  Shirt,
  Utensils,
  Dog,
  Brush,
  Music,
  Gamepad2,
  Dumbbell,
  Pencil,
  ShoppingBag,
  Bed,
  Trash2,
  Flower2,
  Car,
  Heart,
} from 'lucide-react';
import type { TaskWithMember } from '../../types';

interface ChildTaskCardProps {
  task: TaskWithMember;
  onClick: (task: TaskWithMember) => void;
  isClaimable?: boolean;
  isPendingCreation?: boolean;
  isOverdue?: boolean;
  isWeeklyTask?: boolean;
}

// Icon configurations with colors
const TASK_ICONS = [
  {
    keywords: ['bed', 'slaap', 'sleep'],
    icon: Bed,
    bgColor: 'bg-green-500',
    textColor: 'text-white',
  },
  {
    keywords: ['clean', 'schoon', 'opruim', 'room', 'kamer', 'tidy'],
    icon: Sparkles,
    bgColor: 'bg-amber-500',
    textColor: 'text-white',
  },
  {
    keywords: ['dish', 'afwas', 'vaat', 'kitchen', 'keuken', 'cook', 'kook'],
    icon: Utensils,
    bgColor: 'bg-orange-500',
    textColor: 'text-white',
  },
  {
    keywords: ['read', 'lees', 'book', 'boek', 'study', 'homework', 'huiswerk'],
    icon: BookOpen,
    bgColor: 'bg-blue-500',
    textColor: 'text-white',
  },
  {
    keywords: ['cloth', 'kled', 'laundry', 'was', 'fold', 'vouw'],
    icon: Shirt,
    bgColor: 'bg-indigo-500',
    textColor: 'text-white',
  },
  {
    keywords: ['pet', 'huisdier', 'dog', 'hond', 'cat', 'kat', 'animal', 'feed'],
    icon: Dog,
    bgColor: 'bg-amber-600',
    textColor: 'text-white',
  },
  {
    keywords: ['brush', 'tand', 'teeth', 'bath', 'shower', 'douche', 'wash'],
    icon: Brush,
    bgColor: 'bg-cyan-500',
    textColor: 'text-white',
  },
  {
    keywords: ['music', 'muziek', 'piano', 'guitar', 'practice', 'oefen', 'instrument'],
    icon: Music,
    bgColor: 'bg-pink-500',
    textColor: 'text-white',
  },
  {
    keywords: ['game', 'spel', 'play', 'screen'],
    icon: Gamepad2,
    bgColor: 'bg-purple-500',
    textColor: 'text-white',
  },
  {
    keywords: ['exercise', 'sport', 'gym', 'run', 'walk', 'fitness'],
    icon: Dumbbell,
    bgColor: 'bg-red-500',
    textColor: 'text-white',
  },
  {
    keywords: ['write', 'schrijf', 'draw', 'teken', 'art', 'create', 'craft'],
    icon: Pencil,
    bgColor: 'bg-teal-500',
    textColor: 'text-white',
  },
  {
    keywords: ['shop', 'winkel', 'buy', 'koop', 'grocery'],
    icon: ShoppingBag,
    bgColor: 'bg-rose-500',
    textColor: 'text-white',
  },
  {
    keywords: ['trash', 'vuil', 'garbage', 'bin', 'recycle'],
    icon: Trash2,
    bgColor: 'bg-gray-600',
    textColor: 'text-white',
  },
  {
    keywords: ['garden', 'tuin', 'plant', 'water', 'flower', 'bloem'],
    icon: Flower2,
    bgColor: 'bg-lime-500',
    textColor: 'text-white',
  },
  {
    keywords: ['car', 'auto', 'drive', 'vehicle'],
    icon: Car,
    bgColor: 'bg-slate-600',
    textColor: 'text-white',
  },
  {
    keywords: ['help', 'assist', 'chore', 'taak', 'task'],
    icon: Heart,
    bgColor: 'bg-pink-400',
    textColor: 'text-white',
  },
  {
    keywords: ['gift', 'reward', 'beloning', 'prize'],
    icon: Gift,
    bgColor: 'bg-violet-500',
    textColor: 'text-white',
  },
  {
    keywords: ['win', 'goal', 'achievement', 'trophy'],
    icon: Trophy,
    bgColor: 'bg-yellow-500',
    textColor: 'text-white',
  },
];

// Get icon and color based on task title
const getTaskIcon = (title: string, priority: string) => {
  const lowerTitle = title.toLowerCase();

  // Find matching icon based on keywords
  for (const config of TASK_ICONS) {
    if (config.keywords.some((keyword) => lowerTitle.includes(keyword))) {
      return config;
    }
  }

  // Default based on priority
  switch (priority) {
    case 'high':
      return { icon: Trophy, bgColor: 'bg-amber-500', textColor: 'text-white' };
    case 'medium':
      return { icon: Sparkles, bgColor: 'bg-blue-500', textColor: 'text-white' };
    default:
      return { icon: Star, bgColor: 'bg-green-500', textColor: 'text-white' };
  }
};

export function ChildTaskCard({
  task,
  onClick,
  isClaimable = false,
  isPendingCreation = false,
  isOverdue = false,
  isWeeklyTask = false,
}: ChildTaskCardProps) {
  const { t, i18n } = useTranslation('gamification');
  const isPending = task.status === 'pending';
  const isPendingApproval = task.status === 'pending_approval';
  const isCompleted = task.status === 'completed';

  // Get task icon configuration
  const taskIconConfig = getTaskIcon(task.title, task.priority ?? 'medium');
  const TaskIcon = taskIconConfig.icon;

  // Get status icon and styling
  const getStatusConfig = () => {
    if (isCompleted) {
      return {
        icon: <CheckCircle className="w-6 h-6 text-green-500" />,
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        textDecoration: 'line-through text-gray-400',
        statusBadge: (
          <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
            {t('child.celebration.approved')}
          </span>
        ),
      };
    }
    if (isPendingApproval) {
      return {
        icon: <Clock className="w-6 h-6 text-yellow-500" />,
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        textDecoration: '',
        statusBadge: (
          <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full animate-pulse">
            {t('child.completion.waitingApproval')}
          </span>
        ),
      };
    }
    // Claimable tasks (unassigned) get special styling
    if (isClaimable) {
      return {
        icon: <Hand className="w-6 h-6 text-blue-500" />,
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-300 border-dashed',
        textDecoration: '',
        statusBadge: (
          <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
            {t('child.taskCard.tapToClaim')}
          </span>
        ),
      };
    }
    // Pending creation approval (child-created task waiting for parent)
    if (isPendingCreation) {
      return {
        icon: <Clock className="w-6 h-6 text-orange-500" />,
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-300 border-dashed',
        textDecoration: '',
        statusBadge: (
          <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full animate-pulse">
            {t('child.taskCard.waitingForParent')}
          </span>
        ),
      };
    }
    return {
      icon: <Circle className="w-6 h-6 text-gray-300" />,
      bgColor: 'bg-white',
      borderColor: 'border-gray-200',
      textDecoration: '',
      statusBadge: null,
    };
  };

  const config = getStatusConfig();

  // Format time helper for datetime strings
  const formatTimeValue = (datetime: string | null) => {
    if (!datetime) return null;
    const date = new Date(datetime);
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Format time helper for time-only strings (HH:MM:SS)
  const formatTimeOnly = (timeStr: string | null) => {
    if (!timeStr) return null;
    const [hoursStr, minutesStr] = timeStr.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = minutesStr.padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Format due time or time range if start time is set
  const formatTimeDisplay = () => {
    if (!task.due_datetime) return null;

    const dueTime = formatTimeValue(task.due_datetime);

    // Prefer start_time column (time-only), fall back to start_datetime
    const startTimeCol = (task as { start_time?: string | null }).start_time;
    const startTime = startTimeCol
      ? formatTimeOnly(startTimeCol)
      : formatTimeValue(task.start_datetime);

    // If we have both start and due time, show as range
    if (startTime && dueTime) {
      return `${startTime} - ${dueTime}`;
    }

    return dueTime;
  };

  // Format due date for overdue tasks
  const formatDueDate = () => {
    if (!task.due_date) return null;
    const date = new Date(task.due_date + 'T00:00:00');
    return date.toLocaleDateString(i18n.language, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const timeDisplay = formatTimeDisplay();
  const dueDate = isOverdue ? formatDueDate() : null;
  const tags = task.associated_items || [];

  const isDisabled = isCompleted || isPendingCreation;

  return (
    <button
      onClick={() => onClick(task)}
      disabled={isDisabled}
      className={`w-full p-4 rounded-xl border-2 ${config.borderColor} ${config.bgColor}
        transition-all duration-200 active:scale-[0.98] touch-manipulation
        ${!isDisabled ? 'hover:shadow-md hover:border-blue-300' : 'cursor-default'}
        min-h-[80px] flex items-center gap-4`}
    >
      {/* Beautiful task icon */}
      <div
        className={`flex-shrink-0 w-12 h-12 rounded-xl ${
          isCompleted
            ? 'bg-green-500'
            : isPendingApproval
              ? 'bg-yellow-500'
              : isClaimable
                ? 'bg-blue-500'
                : isPendingCreation
                  ? 'bg-orange-400'
                  : taskIconConfig.bgColor
        } flex items-center justify-center shadow-sm ${isCompleted ? 'opacity-70' : ''}`}
      >
        {isCompleted ? (
          <CheckCircle className="w-6 h-6 text-white" />
        ) : isPendingApproval ? (
          <Clock className="w-6 h-6 text-white" />
        ) : isClaimable ? (
          <Hand className="w-6 h-6 text-white" />
        ) : isPendingCreation ? (
          <Clock className="w-6 h-6 text-white" />
        ) : (
          <TaskIcon className={`w-6 h-6 ${taskIconConfig.textColor}`} />
        )}
      </div>

      {/* Task content */}
      <div className="flex-1 text-left min-w-0">
        <h3 className={`font-semibold text-gray-900 ${config.textDecoration} truncate`}>
          {task.title}
        </h3>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {/* Weekly task badge */}
          {isWeeklyTask && (
            <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {t('tasks:weeklyTask.badge', 'This Week')}
            </span>
          )}

          {/* Status badge */}
          {config.statusBadge}

          {/* Due date for overdue tasks */}
          {dueDate && (
            <span className="text-xs text-orange-600 flex items-center gap-1 font-medium">
              <CalendarDays className="w-3 h-3" />
              {dueDate}
            </span>
          )}

          {/* Due time or time range */}
          {timeDisplay && !config.statusBadge && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeDisplay}
            </span>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <>
              {tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
              {tags.length > 2 && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                  +{tags.length - 2}
                </span>
              )}
            </>
          )}
        </div>

        {/* Description preview - move below if tags present */}
        {task.description && !config.statusBadge && tags.length === 0 && (
          <span className="text-xs text-gray-500 truncate max-w-[200px] mt-1 block">
            {task.description}
          </span>
        )}
      </div>

      {/* Points */}
      <div className="flex-shrink-0 flex items-center gap-1">
        <Star className="w-5 h-5 text-amber-400" fill="currentColor" />
        <span className="font-bold text-amber-600">{task.point_value}</span>
      </div>

      {/* Chevron for pending/claimable tasks (not for pending creation) */}
      {(isPending || isClaimable) && !isPendingCreation && (
        <ChevronRight
          className={`w-5 h-5 flex-shrink-0 ${isClaimable ? 'text-blue-400' : 'text-gray-400'}`}
        />
      )}
    </button>
  );
}
