import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Download, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useFamily } from '../../../contexts/FamilyContext';
import { getSupabaseClient } from '../../../lib/supabase';
import { downloadTaskICS, downloadMultipleTasksICS } from '../../../lib/icsGenerator';
import type { Task } from '../../../types';

interface CalendarExportProps {
  /** Single task to export (optional) */
  task?: Task;
  /** Compact mode for inline buttons */
  compact?: boolean;
}

export function CalendarExport({ task, compact = false }: CalendarExportProps) {
  const { t } = useTranslation(['common', 'tasks']);
  const { family } = useAuth();
  const { currentMember, familyMembers } = useFamily();
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const handleExportSingle = async () => {
    if (!task) return;

    setIsExporting(true);
    try {
      const assignee = task.assigned_to
        ? familyMembers.find(m => m.id === task.assigned_to)
        : null;
      const createdBy = task.created_by
        ? familyMembers.find(m => m.id === task.created_by)
        : null;

      downloadTaskICS(task, assignee, createdBy);
      setExported(true);
      setTimeout(() => setExported(false), 2000);
    } catch (error) {
      console.error('Error exporting task:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async () => {
    if (!family?.id || !currentMember?.id) return;

    setIsExporting(true);
    try {
      const supabase = getSupabaseClient();

      // Fetch all pending tasks for the current member
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('family_id', family.id)
        .eq('assigned_to', currentMember.id)
        .in('status', ['pending', 'pending_approval'])
        .eq('is_archived', false)
        .order('due_date', { ascending: true });

      if (error) throw error;

      if (tasks && tasks.length > 0) {
        downloadMultipleTasksICS(tasks as Task[], familyMembers, `my_tasks_${new Date().toISOString().split('T')[0]}.ics`);
        setExported(true);
        setTimeout(() => setExported(false), 2000);
      }
    } catch (error) {
      console.error('Error exporting tasks:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Compact mode - just an icon button for single task export
  if (compact && task) {
    return (
      <button
        onClick={handleExportSingle}
        disabled={isExporting}
        className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
        title={t('common:exportToCalendar')}
      >
        {isExporting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : exported ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : (
          <Calendar className="w-5 h-5" />
        )}
      </button>
    );
  }

  // Single task export button
  if (task) {
    return (
      <button
        onClick={handleExportSingle}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('common:exporting')}
          </>
        ) : exported ? (
          <>
            <CheckCircle className="w-4 h-4 text-green-500" />
            {t('common:exported')}
          </>
        ) : (
          <>
            <Calendar className="w-4 h-4" />
            {t('common:exportToCalendar')}
          </>
        )}
      </button>
    );
  }

  // Export all tasks button
  return (
    <button
      onClick={handleExportAll}
      disabled={isExporting}
      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow hover:shadow-md transition-all disabled:opacity-50"
    >
      {isExporting ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          {t('common:exporting')}
        </>
      ) : exported ? (
        <>
          <CheckCircle className="w-5 h-5" />
          {t('common:exported')}
        </>
      ) : (
        <>
          <Download className="w-5 h-5" />
          {t('common:exportAllTasks')}
        </>
      )}
    </button>
  );
}
