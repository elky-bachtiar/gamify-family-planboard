import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, Star, Target, TrendingUp, Gift } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { supabase } from '../../lib/supabase';
import type { RewardRedemption } from '../../types';

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function RewardsOverview() {
  const { t } = useTranslation('gamification');
  const { family } = useAuth();
  const { currentMember } = useFamily();
  const [weeklyPoints, setWeeklyPoints] = useState(0);
  const [pendingRedemptions, setPendingRedemptions] = useState<RewardRedemption[]>([]);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestedAmount, setRequestedAmount] = useState<number>(0);

  useEffect(() => {
    if (!currentMember || !family) return;

    loadWeeklyPoints();
    loadPendingRedemptions();
  }, [currentMember, family]);

  const loadWeeklyPoints = async () => {
    if (!currentMember || !family) return;

    const weekStart = getWeekStart(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const { data, error } = await supabase
      .from('points_history')
      .select('points')
      .eq('member_id', currentMember.id)
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString());

    if (error) {
      console.error('Error loading weekly points:', error);
      return;
    }

    const total = data.reduce((sum, record) => sum + record.points, 0);
    setWeeklyPoints(total);
  };

  const loadPendingRedemptions = async () => {
    if (!currentMember || !family) return;

    const { data, error } = await supabase
      .from('reward_redemptions')
      .select('*')
      .eq('member_id', currentMember.id)
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading redemptions:', error);
      return;
    }

    setPendingRedemptions(data || []);
  };

  const handleRequestRedemption = async () => {
    if (!currentMember || !family || requestedAmount < family.minimum_redemption) return;

    setIsRequesting(true);
    try {
      const moneyAmount = requestedAmount * (family.point_to_money_rate || 0);

      const { error } = await supabase.from('reward_redemptions').insert({
        family_id: family.id,
        member_id: currentMember.id,
        points_redeemed: requestedAmount,
        money_amount: moneyAmount,
        status: 'pending',
      } as never);

      if (error) throw error;

      setRequestedAmount(0);
      loadPendingRedemptions();
    } catch (error) {
      console.error('Error requesting redemption:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  if (!currentMember || !family) return null;

  const pointToMoneyRate = family.point_to_money_rate || 0;
  const minimumRedemption = family.minimum_redemption || 0;
  const weeklyTargetPoints = family.weekly_target_points || 0;
  const weeklyTargetBonus = family.weekly_target_bonus || 0;
  const totalMoney = currentMember.total_points * pointToMoneyRate;
  const weeklyProgress = weeklyTargetPoints > 0 ? Math.min((weeklyPoints / weeklyTargetPoints) * 100, 100) : 0;
  const reachedWeeklyGoal = weeklyTargetPoints > 0 && weeklyPoints >= weeklyTargetPoints;

  const maxRedeemablePoints = currentMember.total_points;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-6">
        <Gift className="w-6 h-6 text-green-500" />
        <h2 className="text-xl font-bold text-gray-900">{t('rewards.myRewards')}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-amber-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-5 h-5 text-amber-500" fill="currentColor" />
            <span className="text-sm font-medium text-gray-600">{t('points.total')}</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{currentMember.total_points}</div>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium text-gray-600">{t('rewards.cashValue')}</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">${totalMoney.toFixed(2)}</div>
          {pointToMoneyRate > 0 && (
            <div className="text-xs text-gray-500 mt-1">{t('rewards.perPoint', { rate: pointToMoneyRate })}</div>
          )}
        </div>
      </div>

      {weeklyTargetPoints > 0 && (
        <div className="mb-6 bg-purple-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-500" />
              <span className="text-sm font-medium text-gray-700">{t('rewards.weeklyGoal.title')}</span>
            </div>
            <span className="text-sm font-semibold text-purple-600">
              {t('rewards.weeklyGoal.progress', { current: weeklyPoints, target: weeklyTargetPoints })}
            </span>
          </div>
          <div className="w-full bg-purple-200 rounded-full h-3 mb-2">
            <div
              className={`h-3 rounded-full transition-all ${reachedWeeklyGoal ? 'bg-green-500' : 'bg-purple-500'}`}
              style={{ width: `${weeklyProgress}%` }}
            />
          </div>
          {reachedWeeklyGoal ? (
            <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
              <TrendingUp className="w-4 h-4" />
              {t('rewards.weeklyGoal.reached', { bonus: weeklyTargetBonus.toFixed(2) })}
            </div>
          ) : (
            <div className="text-xs text-gray-600">
              {t('rewards.weeklyGoal.earnMore', { remaining: weeklyTargetPoints - weeklyPoints, bonus: weeklyTargetBonus.toFixed(2) })}
            </div>
          )}
        </div>
      )}

      {pointToMoneyRate > 0 && (
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('rewards.requestRedemption')}</h3>

          {maxRedeemablePoints >= minimumRedemption ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="redeemAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('rewards.pointsToRedeem')}
                </label>
                <input
                  id="redeemAmount"
                  type="number"
                  min={minimumRedemption}
                  max={maxRedeemablePoints}
                  value={requestedAmount || ''}
                  onChange={(e) => setRequestedAmount(Math.min(parseInt(e.target.value) || 0, maxRedeemablePoints))}
                  placeholder={t('rewards.minimumPlaceholder', { minimum: minimumRedemption })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {requestedAmount > 0 && (
                  <p className="text-sm text-green-600 mt-1">
                    = ${(requestedAmount * pointToMoneyRate).toFixed(2)}
                  </p>
                )}
              </div>

              <button
                onClick={handleRequestRedemption}
                disabled={isRequesting || requestedAmount < minimumRedemption}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                <DollarSign className="w-4 h-4" />
                {isRequesting ? t('rewards.requesting') : t('rewards.requestRedemption')}
              </button>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              {t('rewards.needMinimum', { minimum: minimumRedemption })}
              <br />
              <span className="text-sm">{t('rewards.keepEarning')}</span>
            </div>
          )}
        </div>
      )}

      {pendingRedemptions.length > 0 && (
        <div className="border-t border-gray-200 pt-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('rewards.redemptionHistory')}</h3>
          <div className="space-y-2">
            {pendingRedemptions.map((redemption) => (
              <div
                key={redemption.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  redemption.status === 'pending'
                    ? 'bg-yellow-50 border border-yellow-200'
                    : redemption.status === 'approved'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <div>
                  <div className="font-medium text-gray-900">{t('points.value', { count: redemption.points_redeemed })}</div>
                  <div className="text-sm text-gray-600">${redemption.money_amount.toFixed(2)}</div>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    redemption.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-700'
                      : redemption.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {t(`rewards.status.${redemption.status}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
