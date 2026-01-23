import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Check,
  X,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import type { DeductionDispute, PointsHistory, FamilyMember } from '../../types';

interface DisputeWithDetails extends DeductionDispute {
  points_history: PointsHistory | null;
  creator: FamilyMember | null;
}

export function DisputeReviewManager() {
  const { t } = useTranslation(['admin', 'gamification', 'common']);
  const { family, familyMember, refreshAuth } = useAuth();
  const { familyMembers } = useFamily();
  const [disputes, setDisputes] = useState<DisputeWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDispute, setExpandedDispute] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  useEffect(() => {
    if (family) {
      loadDisputes();
    }
  }, [family]);

  const loadDisputes = async () => {
    if (!family) return;

    try {
      // Fetch pending disputes with related data
      const { data: disputesData, error } = await supabase
        .from('deduction_disputes')
        .select(
          `
          *,
          points_history (*)
        `
        )
        .eq('family_id', family.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map creator info from family members
      const disputesWithDetails = (disputesData || []).map((dispute) => ({
        ...dispute,
        points_history: dispute.points_history,
        creator: familyMembers.find((m) => m.id === dispute.created_by) || null,
      }));

      setDisputes(disputesWithDetails);
    } catch (error) {
      console.error('Error loading disputes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolve = async (disputeId: string, decision: 'approved' | 'rejected') => {
    if (!familyMember) return;

    setResolvingId(disputeId);

    try {
      const { data: session } = await supabase.auth.getSession();

      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-dispute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            dispute_id: disputeId,
            decision,
            resolution_note: resolutionNote.trim() || undefined,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to resolve dispute');
      }

      // Refresh data
      await loadDisputes();
      refreshAuth();
      setExpandedDispute(null);
      setResolutionNote('');
    } catch (error) {
      console.error('Error resolving dispute:', error);
      alert(error instanceof Error ? error.message : 'Failed to resolve dispute');
    } finally {
      setResolvingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingCount = disputes.filter((d) => d.status === 'pending').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('admin:disputes.title', 'Deduction Disputes')}
          </h3>
          {pendingCount > 0 && (
            <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">
              {pendingCount} {t('admin:disputes.pending', 'pending')}
            </span>
          )}
        </div>
        <button
          onClick={loadDisputes}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Empty state */}
      {disputes.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h4 className="text-lg font-medium text-gray-900 mb-1">
            {t('admin:disputes.noDisputes', 'No disputes')}
          </h4>
          <p className="text-gray-500 text-sm">
            {t('admin:disputes.noDisputesHint', 'All disputes have been resolved')}
          </p>
        </div>
      )}

      {/* Disputes list */}
      <div className="space-y-3">
        {disputes.map((dispute) => {
          const isExpanded = expandedDispute === dispute.id;
          const isPending = dispute.status === 'pending';

          return (
            <div
              key={dispute.id}
              className={`bg-white rounded-xl border overflow-hidden ${
                isPending ? 'border-yellow-300 shadow-sm' : 'border-gray-200'
              }`}
            >
              {/* Header */}
              <button
                onClick={() => setExpandedDispute(isExpanded ? null : dispute.id)}
                className="w-full p-4 flex items-start justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusColor(dispute.status)}`}
                    >
                      {t(`gamification:disputes.status.${dispute.status}`, dispute.status)}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(dispute.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900">
                      {dispute.creator?.name || 'Unknown'}
                    </span>
                    <span className="text-gray-400">-</span>
                    <span className="text-red-600 font-medium">
                      {dispute.points_history?.points} points
                    </span>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-4 space-y-4">
                  {/* Original deduction */}
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {t('admin:disputes.originalDeduction', 'Original Deduction')}
                    </div>
                    <p className="text-gray-700">{dispute.points_history?.reason}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                      <Clock className="w-3 h-3" />
                      {formatDate(dispute.points_history?.created_at || null)}
                    </div>
                    {/* Deduction evidence */}
                    {dispute.points_history?.evidence_urls &&
                      dispute.points_history.evidence_urls.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {dispute.points_history.evidence_urls.map((url, idx) => (
                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={url}
                                alt={`Deduction evidence ${idx + 1}`}
                                className="w-16 h-16 object-cover rounded-lg border border-red-200"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                  </div>

                  {/* Child's dispute */}
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-xs font-medium text-blue-700 mb-1 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {t('admin:disputes.childResponse', "Child's Response")}
                    </div>
                    <p className="text-gray-700">{dispute.reason}</p>
                    {/* Dispute evidence */}
                    {dispute.evidence_urls && dispute.evidence_urls.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {dispute.evidence_urls.map((url, idx) => (
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={url}
                              alt={`Dispute evidence ${idx + 1}`}
                              className="w-16 h-16 object-cover rounded-lg border border-blue-200"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Resolution info or actions */}
                  {isPending ? (
                    <div className="space-y-3">
                      {/* Resolution note input */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {t('admin:disputes.resolutionNote', 'Resolution note (optional)')}
                        </label>
                        <input
                          type="text"
                          value={resolutionNote}
                          onChange={(e) => setResolutionNote(e.target.value)}
                          placeholder={t(
                            'admin:disputes.resolutionNotePlaceholder',
                            'Add a note...'
                          )}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResolve(dispute.id, 'rejected')}
                          disabled={resolvingId === dispute.id}
                          className="flex-1 flex items-center justify-center gap-2 py-2 px-4 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                          {t('admin:disputes.reject', 'Reject')}
                        </button>
                        <button
                          onClick={() => handleResolve(dispute.id, 'approved')}
                          disabled={resolvingId === dispute.id}
                          className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {resolvingId === dispute.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          {t('admin:disputes.approveRestore', 'Approve & Restore')}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 text-center">
                        {t(
                          'admin:disputes.approveHint',
                          'Approving will restore {{points}} points',
                          { points: Math.abs(dispute.points_history?.points || 0) }
                        )}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs font-medium text-gray-600 mb-1">
                        {t('admin:disputes.resolution', 'Resolution')}
                      </div>
                      <p className="text-gray-700">
                        {dispute.status === 'approved'
                          ? t('admin:disputes.approvedMessage', 'Points restored')
                          : t('admin:disputes.rejectedMessage', 'Dispute rejected')}
                        {dispute.points_restored && ` (+${dispute.points_restored} points)`}
                      </p>
                      {dispute.resolution_note && (
                        <p className="text-sm text-gray-500 mt-1 italic">
                          "{dispute.resolution_note}"
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                        <Clock className="w-3 h-3" />
                        {formatDate(dispute.resolved_at)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
