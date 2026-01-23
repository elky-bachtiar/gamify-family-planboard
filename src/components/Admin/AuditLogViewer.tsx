import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  CheckCircle,
  XCircle,
  Star,
  LogIn,
  UserPlus,
  Pencil,
  Trash2,
  MessageSquare,
  Trophy,
  Clock,
  Filter
} from 'lucide-react';
import { getSupabaseClient } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';

interface AuditLog {
  id: string;
  family_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  login: <LogIn className="w-4 h-4" />,
  create: <UserPlus className="w-4 h-4" />,
  update: <Pencil className="w-4 h-4" />,
  delete: <Trash2 className="w-4 h-4" />,
  approve: <CheckCircle className="w-4 h-4" />,
  reject: <XCircle className="w-4 h-4" />,
  points_awarded: <Star className="w-4 h-4" />,
  points_deducted: <Star className="w-4 h-4" />,
  message_sent: <MessageSquare className="w-4 h-4" />,
  achievement_earned: <Trophy className="w-4 h-4" />,
};

const ACTION_COLORS: Record<string, string> = {
  login: 'text-blue-600 bg-blue-100',
  create: 'text-green-600 bg-green-100',
  update: 'text-amber-600 bg-amber-100',
  delete: 'text-red-600 bg-red-100',
  approve: 'text-green-600 bg-green-100',
  reject: 'text-red-600 bg-red-100',
  points_awarded: 'text-amber-600 bg-amber-100',
  points_deducted: 'text-red-600 bg-red-100',
  message_sent: 'text-purple-600 bg-purple-100',
  achievement_earned: 'text-yellow-600 bg-yellow-100',
};

const ENTITY_TYPES = ['all', 'task', 'member', 'points', 'achievement', 'message'];

export function AuditLogViewer() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const { family } = useAuth();
  const { familyMembers } = useFamily();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<string>('all');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const LOGS_PER_PAGE = 20;

  const fetchLogs = useCallback(async (loadMore = false) => {
    if (!family) return;

    if (!loadMore) {
      setIsLoading(true);
      setPage(0);
    }

    try {
      const supabase = getSupabaseClient();
      const currentPage = loadMore ? page + 1 : 0;

      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('family_id', family.id)
        .order('created_at', { ascending: false })
        .range(currentPage * LOGS_PER_PAGE, (currentPage + 1) * LOGS_PER_PAGE - 1);

      if (selectedMember !== 'all') {
        query = query.eq('actor_id', selectedMember);
      }

      if (selectedEntityType !== 'all') {
        query = query.eq('entity_type', selectedEntityType);
      }

      const { data, error } = await query;

      if (error) throw error;

      const typedData = (data || []) as AuditLog[];

      if (loadMore) {
        setLogs(prev => [...prev, ...typedData]);
        setPage(currentPage);
      } else {
        setLogs(typedData);
      }

      setHasMore(typedData.length === LOGS_PER_PAGE);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [family, page, selectedMember, selectedEntityType]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getMemberName = (memberId: string | null): string => {
    if (!memberId) return t('admin:activity.systemAction');
    const member = familyMembers.find(m => m.id === memberId);
    return member?.name || t('admin:activity.unknownMember');
  };

  const formatAction = (log: AuditLog): string => {
    const details = log.details as Record<string, string | number>;

    switch (log.action) {
      case 'login':
        return t('admin:activity.actions.login');
      case 'create':
        return t('admin:activity.actions.created', { type: log.entity_type, name: details.name || '' });
      case 'update':
        return t('admin:activity.actions.updated', { type: log.entity_type, name: details.name || '' });
      case 'delete':
        return t('admin:activity.actions.deleted', { type: log.entity_type, name: details.name || '' });
      case 'approve':
        return t('admin:activity.actions.approved', { type: log.entity_type, name: details.task_title || '' });
      case 'reject':
        return t('admin:activity.actions.rejected', { type: log.entity_type, reason: details.reason || '' });
      case 'points_awarded':
        return t('admin:activity.actions.pointsAwarded', { points: details.points, target: details.target_name || '' });
      case 'points_deducted':
        return t('admin:activity.actions.pointsDeducted', { points: details.points, target: details.target_name || '', reason: details.reason || '' });
      case 'message_sent':
        return t('admin:activity.actions.messageSent', { recipient: details.recipient_name || t('admin:activity.everyone') });
      case 'achievement_earned':
        return t('admin:activity.actions.achievementEarned', { name: details.achievement_name || '' });
      default:
        return `${log.action} ${log.entity_type}`;
    }
  };

  if (isLoading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-purple-600" />
        <h3 className="font-semibold text-gray-800">{t('admin:activity.title')}</h3>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">{t('admin:activity.filters')}</span>
        </div>

        <select
          value={selectedMember}
          onChange={(e) => setSelectedMember(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">{t('admin:activity.allMembers')}</option>
          {familyMembers.map(member => (
            <option key={member.id} value={member.id}>{member.name}</option>
          ))}
        </select>

        <select
          value={selectedEntityType}
          onChange={(e) => setSelectedEntityType(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          {ENTITY_TYPES.map(type => (
            <option key={type} value={type}>
              {type === 'all' ? t('admin:activity.allTypes') : t(`admin:activity.entityTypes.${type}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Log List */}
      {logs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{t('admin:activity.noLogs')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            const actionColor = ACTION_COLORS[log.action] || 'text-gray-600 bg-gray-100';
            const actionIcon = ACTION_ICONS[log.action] || <Clock className="w-4 h-4" />;

            return (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
              >
                <div className={`p-2 rounded-lg ${actionColor}`}>
                  {actionIcon}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{getMemberName(log.actor_id)}</span>
                    {' '}
                    <span className="text-gray-600">{formatAction(log)}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(log.created_at).toLocaleDateString(i18n.language, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            );
          })}

          {hasMore && (
            <button
              onClick={() => fetchLogs(true)}
              disabled={isLoading}
              className="w-full py-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              {isLoading ? t('common:buttons.loading') : t('admin:activity.loadMore')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
