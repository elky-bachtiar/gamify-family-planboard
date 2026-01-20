import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import { useFamily } from '../../contexts/FamilyContext';
import { useAuth } from '../../contexts/AuthContext';
import { ChildHeader } from './ChildHeader';
import { ChildTabBar, ChildViewTab } from './ChildTabBar';
import { TodayTaskList } from './TodayTaskList';
import { AdminApprovalBanner } from './AdminApprovalBanner';
import { TaskCompletionModal } from './TaskCompletionModal';
import { ChildCreateTaskModal } from './ChildCreateTaskModal';
import { DailyGreeting } from './DailyGreeting';
import { PointsAnimation } from './Gamification/PointsAnimation';
import { ApprovalCelebration } from './Gamification/ApprovalCelebration';
import { ChildBadgesView } from './Views/ChildBadgesView';
import { ChildStatsView } from './Views/ChildStatsView';
import type { TaskWithMember, Task } from '../../types';

// Session storage key for greeting shown today
const GREETING_SHOWN_KEY = 'child_greeting_shown';

export function ChildDashboard() {
  const { currentMember } = useFamily();
  const { refreshAuth } = useAuth();
  const [activeTab, setActiveTab] = useState<ChildViewTab>('home');
  const [selectedTask, setSelectedTask] = useState<TaskWithMember | null>(null);
  const [showGreeting, setShowGreeting] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [createTaskDefaultTitle, setCreateTaskDefaultTitle] = useState<string | undefined>();
  const [taskListKey, setTaskListKey] = useState(0); // For refreshing task list

  // Celebration states
  const [showPointsAnimation, setShowPointsAnimation] = useState(false);
  const [pendingPoints, setPendingPoints] = useState(0);
  const [approvedTask, setApprovedTask] = useState<Task | null>(null);

  // Check if we should show greeting (once per session)
  useEffect(() => {
    const today = new Date().toDateString();
    const greetingShown = sessionStorage.getItem(GREETING_SHOWN_KEY);

    if (greetingShown !== today && currentMember) {
      setShowGreeting(true);
      sessionStorage.setItem(GREETING_SHOWN_KEY, today);
    }
  }, [currentMember]);

  const handleDismissGreeting = useCallback(() => {
    setShowGreeting(false);
  }, []);

  // Subscribe to task approvals for celebration
  useEffect(() => {
    if (!currentMember) return;

    const supabase = getSupabaseClient();

    const channel = supabase
      .channel('child-task-approvals')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `completed_by=eq.${currentMember.id}`,
        },
        (payload) => {
          const oldTask = payload.old as Task;
          const newTask = payload.new as Task;

          // Detect approval: pending_approval -> completed
          if (oldTask.status === 'pending_approval' && newTask.status === 'completed') {
            console.log('[Child] Task approved!', newTask.title);
            setApprovedTask(newTask);
            // Refresh member data to get updated points
            refreshAuth();
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentMember?.id, refreshAuth]);

  const handleTaskClick = (task: TaskWithMember) => {
    setSelectedTask(task);
  };

  const handleTaskComplete = (_task: TaskWithMember, points: number) => {
    // Show points animation for completion (pending approval)
    setPendingPoints(points);
    setShowPointsAnimation(true);

    // Close modal after short delay
    setTimeout(() => {
      setSelectedTask(null);
    }, 300);
  };

  const handlePointsAnimationComplete = () => {
    setShowPointsAnimation(false);
    setPendingPoints(0);
  };

  const handleApprovalCelebrationClose = () => {
    setApprovedTask(null);
  };

  const handleCreateTask = useCallback((defaultTitle?: string) => {
    setCreateTaskDefaultTitle(defaultTitle);
    setShowCreateTask(true);
  }, []);

  const handleTaskCreated = useCallback(() => {
    // Refresh the task list by incrementing the key
    setTaskListKey(k => k + 1);
  }, []);

  const handleTaskClaimed = useCallback(() => {
    // Refresh the task list to show the claimed task in "My Tasks"
    setTaskListKey(k => k + 1);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <ChildHeader />

      {/* Admin Approval Banner - only shows for admins when there are pending items */}
      <AdminApprovalBanner />

      {/* Main content area */}
      <main>
        {activeTab === 'home' && (
          <TodayTaskList
            key={taskListKey}
            onTaskClick={handleTaskClick}
            onCreateTask={handleCreateTask}
          />
        )}

        {activeTab === 'badges' && (
          <ChildBadgesView />
        )}

        {activeTab === 'stats' && (
          <ChildStatsView />
        )}
      </main>

      {/* Bottom tab bar */}
      <ChildTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Task completion modal */}
      {selectedTask && (
        <TaskCompletionModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onComplete={handleTaskComplete}
          onClaimSuccess={handleTaskClaimed}
        />
      )}

      {/* Points animation overlay */}
      {showPointsAnimation && (
        <PointsAnimation
          points={pendingPoints}
          isPending={true}
          onComplete={handlePointsAnimationComplete}
        />
      )}

      {/* Approval celebration overlay */}
      {approvedTask && (
        <ApprovalCelebration
          task={approvedTask}
          onClose={handleApprovalCelebrationClose}
        />
      )}

      {/* Daily greeting overlay */}
      {showGreeting && (
        <DailyGreeting onDismiss={handleDismissGreeting} />
      )}

      {/* Create task modal */}
      <ChildCreateTaskModal
        isOpen={showCreateTask}
        onClose={() => {
          setShowCreateTask(false);
          setCreateTaskDefaultTitle(undefined);
        }}
        onTaskCreated={handleTaskCreated}
        defaultTitle={createTaskDefaultTitle}
      />
    </div>
  );
}
