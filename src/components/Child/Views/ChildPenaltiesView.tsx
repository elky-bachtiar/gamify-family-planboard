import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Camera, Clock, Check, X, ChevronRight, RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import type { PointsHistory, DeductionDispute } from '../../../types';
import { CreateDisputeModal } from '../CreateDisputeModal';

interface DeductionWithDispute extends PointsHistory {
  dispute?: DeductionDispute | null;
}

export function ChildPenaltiesView() {
  const { t } = useTranslation(['gamification', 'common']);
  const { familyMember, family } = useAuth();
  const [deductions, setDeductions] = useState<DeductionWithDispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDeduction, setSelectedDeduction] = useState<PointsHistory | null>(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);

  useEffect(() => {
    if (familyMember && family) {
      loadDeductions();
    }
  }, [familyMember, family]);

  const loadDeductions = async () => {
    if (!familyMember) return;

    try {
      // Fetch deductions (negative points) for this member
      const { data: pointsData, error: pointsError } = await supabase
        .from('points_history')
        .select('*')
        .eq('member_id', familyMember.id)
        .lt('points', 0)
        .order('created_at', { ascending: false })
        .limit(50);

      if (pointsError) throw pointsError;

      // Fetch disputes for these deductions
      const deductionIds = pointsData?.map((d) => d.id) || [];

      if (deductionIds.length > 0) {
        const { data: disputesData, error: disputesError } = await supabase
          .from('deduction_disputes')
          .select('*')
          .in('points_history_id', deductionIds);

        if (disputesError) throw disputesError;

        // Merge disputes with deductions
        const deductionsWithDisputes = pointsData?.map((deduction) => ({
          ...deduction,
          dispute: disputesData?.find((d) => d.points_history_id === deduction.id) || null,
        }));

        setDeductions(deductionsWithDisputes || []);
      } else {
        setDeductions([]);
      }
    } catch (error) {
      console.error('Error loading deductions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const canDispute = (deduction: DeductionWithDispute): boolean => {
    // Already has a dispute
    if (deduction.dispute) return false;

    // Check if within 7 days
    const deductionDate = new Date(deduction.created_at || '');
    const now = new Date();
    const daysSince = (now.getTime() - deductionDate.getTime()) / (1000 * 60 * 60 * 24);

    return daysSince <= 7;
  };

  const getDisputeStatusColor = (status: string) => {
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

  const handleOpenDispute = (deduction: PointsHistory) => {
    setSelectedDeduction(deduction);
    setShowDisputeModal(true);
  };

  const handleDisputeCreated = () => {
    setShowDisputeModal(false);
    setSelectedDeduction(null);
    loadDeductions();
  };

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
        <h2 className="text-lg font-bold text-gray-900">
          {t('gamification:penalties.title', 'Point Deductions')}
        </h2>
        <button
          onClick={loadDeductions}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Empty state */}
      {deductions.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('gamification:penalties.noDeductions', 'No deductions!')}
          </h3>
          <p className="text-gray-500 text-sm">
            {t('gamification:penalties.noDeductionsHint', 'Keep up the great work!')}
          </p>
        </div>
      )}

      {/* Deductions list */}
      <div className="space-y-3">
        {deductions.map((deduction) => (
          <div
            key={deduction.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            {/* Main content */}
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="font-bold text-red-600">
                      {deduction.points} {t('common:labels.points', 'points')}
                    </span>
                  </div>
                  <p className="text-gray-700 mt-1">{deduction.reason}</p>
                </div>

                {/* Evidence indicator */}
                {deduction.evidence_urls && deduction.evidence_urls.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    <Camera className="w-3 h-3" />
                    <span>{deduction.evidence_urls.length}</span>
                  </div>
                )}
              </div>

              {/* Date */}
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                <Clock className="w-3 h-3" />
                <span>{formatDate(deduction.created_at)}</span>
              </div>

              {/* Evidence images */}
              {deduction.evidence_urls && deduction.evidence_urls.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {deduction.evidence_urls.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Evidence ${idx + 1}`}
                      className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Dispute status or action */}
            <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
              {deduction.dispute ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${getDisputeStatusColor(
                        deduction.dispute.status
                      )}`}
                    >
                      {t(
                        `gamification:disputes.status.${deduction.dispute.status}`,
                        deduction.dispute.status
                      )}
                    </span>
                    {deduction.dispute.status === 'approved' &&
                      deduction.dispute.points_restored && (
                        <span className="text-xs text-green-600 font-medium">
                          +{deduction.dispute.points_restored} restored
                        </span>
                      )}
                  </div>
                  {deduction.dispute.resolution_note && (
                    <span className="text-xs text-gray-500 truncate max-w-32">
                      {deduction.dispute.resolution_note}
                    </span>
                  )}
                </div>
              ) : canDispute(deduction) ? (
                <button
                  onClick={() => handleOpenDispute(deduction)}
                  className="w-full flex items-center justify-between text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  <span>{t('gamification:disputes.disputeButton', 'Dispute this deduction')}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <X className="w-4 h-4" />
                  <span>{t('gamification:disputes.cannotDispute', 'Dispute period expired')}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Dispute Modal */}
      {selectedDeduction && (
        <CreateDisputeModal
          isOpen={showDisputeModal}
          onClose={() => {
            setShowDisputeModal(false);
            setSelectedDeduction(null);
          }}
          deduction={selectedDeduction}
          onDisputeCreated={handleDisputeCreated}
        />
      )}
    </div>
  );
}
