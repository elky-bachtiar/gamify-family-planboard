import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Clock, DollarSign, Ban } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { RedemptionWithMember } from '../../types';

export function RedemptionManager() {
  const { t, i18n } = useTranslation('gamification');
  const { family, familyMember, isAdmin } = useAuth();
  const [redemptions, setRedemptions] = useState<RedemptionWithMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!family || !isAdmin) return;

    loadRedemptions();

    const subscription = supabase
      .channel('redemptions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reward_redemptions' }, () => {
        loadRedemptions();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [family, isAdmin]);

  const loadRedemptions = async () => {
    if (!family) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from('reward_redemptions')
      .select('*, family_members(*)')
      .eq('family_id', family.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading redemptions:', error);
    } else {
      setRedemptions(data as RedemptionWithMember[]);
    }
    setIsLoading(false);
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'paid' | 'rejected') => {
    if (!familyMember) return;

    setProcessingId(id);
    try {
      const updateData: Record<string, unknown> = {
        status,
        approved_by: familyMember.id,
        approved_at: new Date().toISOString(),
      };

      // If approving, deduct points from member
      const redemption = redemptions.find(r => r.id === id);
      if (redemption && status === 'approved') {
        // Deduct points
        const { error: pointsError } = await supabase
          .from('family_members')
          .update({
            total_points: Math.max(0, (redemption.family_members?.total_points || 0) - redemption.points_redeemed),
          } as never)
          .eq('id', redemption.member_id as string);

        if (pointsError) throw pointsError;

        // Add to points history (negative)
        await supabase.from('points_history').insert({
          member_id: redemption.member_id,
          family_id: family?.id,
          points: -redemption.points_redeemed,
          reason: `Points redeemed for $${redemption.money_amount.toFixed(2)}`,
        } as never);
      }

      const { error } = await supabase
        .from('reward_redemptions')
        .update(updateData as never)
        .eq('id', id);

      if (error) throw error;

      loadRedemptions();
    } catch (error) {
      console.error('Error updating redemption:', error);
    } finally {
      setProcessingId(null);
    }
  };

  if (!isAdmin || !family) return null;

  const pendingRedemptions = redemptions.filter(r => r.status === 'pending');
  const approvedRedemptions = redemptions.filter(r => r.status === 'approved');
  const completedRedemptions = redemptions.filter(r => r.status === 'paid' || r.status === 'rejected');

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(i18n.language, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-green-500" />
        <h3 className="text-lg font-semibold text-gray-900">{t('rewards.manager.title')}</h3>
      </div>

      {pendingRedemptions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-500" />
            {t('rewards.manager.pendingApproval', { count: pendingRedemptions.length })}
          </h4>
          <div className="space-y-2">
            {pendingRedemptions.map((redemption) => (
              <div
                key={redemption.id}
                className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {redemption.family_members && (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: redemption.family_members.color }}
                    >
                      {redemption.family_members.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900">
                      {redemption.family_members?.name || 'Unknown'}
                    </div>
                    <div className="text-sm text-gray-600">
                      {t('rewards.manager.pointsEquals', { points: redemption.points_redeemed, money: redemption.money_amount.toFixed(2) })}
                    </div>
                    <div className="text-xs text-gray-500">{formatDate(redemption.created_at)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateStatus(redemption.id, 'approved')}
                    disabled={processingId === redemption.id}
                    className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                    title={t('rewards.actions.approve')}
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(redemption.id, 'rejected')}
                    disabled={processingId === redemption.id}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                    title={t('rewards.actions.reject')}
                  >
                    <Ban className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {approvedRedemptions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            {t('rewards.manager.awaitingPayment', { count: approvedRedemptions.length })}
          </h4>
          <div className="space-y-2">
            {approvedRedemptions.map((redemption) => (
              <div
                key={redemption.id}
                className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {redemption.family_members && (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: redemption.family_members.color }}
                    >
                      {redemption.family_members.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900">
                      {redemption.family_members?.name || 'Unknown'}
                    </div>
                    <div className="text-sm text-green-600 font-semibold">
                      {t('rewards.manager.toPay', { amount: redemption.money_amount.toFixed(2) })}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleUpdateStatus(redemption.id, 'paid')}
                  disabled={processingId === redemption.id}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  {processingId === redemption.id ? t('rewards.manager.processing') : t('rewards.actions.markPaid')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {completedRedemptions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">{t('rewards.manager.recentHistory')}</h4>
          <div className="space-y-2">
            {completedRedemptions.slice(0, 5).map((redemption) => (
              <div
                key={redemption.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  redemption.status === 'paid' ? 'bg-gray-50' : 'bg-red-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {redemption.family_members && (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold opacity-60"
                      style={{ backgroundColor: redemption.family_members.color }}
                    >
                      {redemption.family_members.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-700">
                      {redemption.family_members?.name || 'Unknown'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {t('rewards.manager.pointsEquals', { points: redemption.points_redeemed, money: redemption.money_amount.toFixed(2) })}
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    redemption.status === 'paid'
                      ? 'bg-gray-200 text-gray-600'
                      : 'bg-red-100 text-red-600'
                  }`}
                >
                  {t(`rewards.status.${redemption.status}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {redemptions.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          {t('rewards.noRedemptions')}
        </div>
      )}
    </div>
  );
}
