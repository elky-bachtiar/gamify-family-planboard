import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { TaskCard } from './TaskCard';
import type { TaskWithMember } from '../types';

interface SortableTaskCardProps {
  task: TaskWithMember;
  onUpdate: () => void;
  onTaskClick?: (task: TaskWithMember) => void;
  isDragEnabled: boolean;
}

export function SortableTaskCard({
  task,
  onUpdate,
  onTaskClick,
  isDragEnabled,
}: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: !isDragEnabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {isDragEnabled && (
        <button
          {...attributes}
          {...listeners}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 p-1 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          aria-label="Drag to reorder task"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      <TaskCard task={task} onUpdate={onUpdate} onTaskClick={onTaskClick} />
    </div>
  );
}
