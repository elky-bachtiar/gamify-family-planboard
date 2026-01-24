import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Gift, Clock, Check, TrendingUp, Target, AlertCircle } from 'lucide-react';
import { getSupabaseClient } from '../../../lib/supabase';
import { useFamily } from '../../../contexts/FamilyContext';
import { useAuth } from '../../../contexts/AuthContext';
import type { RewardRedemption } from '../../../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function ChildRewardsView() {
  const { t, i18n } = useTranslation('gamification');
  const { currentMember } = useFamily();
  const { family, refreshAuth } = useAuth();
  const [weeklyPoints, setWeeklyPoints] = useState(0);
  const [pendingRedemptions, setPendingRedemptions] = useState<RewardRedemption[]>([]);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestedAmount, setRequestedAmount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!currentMember || !family) return;

    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([loadWeeklyPoints(), loadPendingRedemptions()]);
      setIsLoading(false);
    };

    loadData();
  }, [currentMember, family]);

  const loadWeeklyPoints = async () => {
    if (!currentMember || !family) return;

    const supabase = getSupabaseClient();
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

    const supabase = getSupabaseClient();
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
    if (!currentMember || !family) return;

    // Clear any previous error
    setErrorMessage(null);

    // Basic client-side validation
    if (requestedAmount < (family.minimum_redemption ?? 0)) {
      setErrorMessage(t('child.rewards.minimumError', { minimum: family.minimum_redemption }));
      return;
    }

    setIsRequesting(true);
    try {
      // Get auth token for the edge function
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // For PIN users, we need to get the token from sessionStorage
      const token = session?.access_token ?? sessionStorage.getItem('pin_user_token');

      if (!token) {
        setErrorMessage(t('child.rewards.authError'));
        return;
      }

      // Call the edge function for server-side validation
      const response = await fetch(`${SUPABASE_URL}/functions/v1/request-redemption`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ points_redeemed: requestedAmount }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (data.available !== undefined && data.requested !== undefined) {
          setErrorMessage(
            t('child.rewards.insufficientPoints', {
              available: data.available,
              requested: data.requested,
            })
          );
        } else if (response.status === 429) {
          setErrorMessage(t('child.rewards.rateLimitError'));
        } else {
          setErrorMessage(data.error || t('child.rewards.genericError'));
        }
        return;
      }

      // Success
      setRequestedAmount(0);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      await loadPendingRedemptions();
      refreshAuth();
    } catch (error) {
      console.error('Error requesting redemption:', error);
      setErrorMessage(t('child.rewards.networkError'));
    } finally {
      setIsRequesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
      </div>
    );
  }

  if (!currentMember || !family) return null;

  const pointToMoneyRate = family.point_to_money_rate || 0;
  const minimumRedemption = family.minimum_redemption || 0;
  const weeklyTargetPoints = family.weekly_target_points || 0;
  const weeklyTargetBonus = family.weekly_target_bonus || 0;
  const memberPoints = currentMember.total_points ?? 0;

  // Calculate pending points to prevent duplicate requests
  const pendingPointsTotal = pendingRedemptions
    .filter((r) => r.status === 'pending' || r.status === 'approved')
    .reduce((sum, r) => sum + r.points_redeemed, 0);
  const availablePoints = Math.max(0, memberPoints - pendingPointsTotal);

  const totalMoney = memberPoints * pointToMoneyRate;
  const weeklyProgress =
    weeklyTargetPoints > 0 ? Math.min((weeklyPoints / weeklyTargetPoints) * 100, 100) : 0;
  const reachedWeeklyGoal = weeklyTargetPoints > 0 && weeklyPoints >= weeklyTargetPoints;
  const canRedeem = availablePoints >= minimumRedemption && pointToMoneyRate > 0;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(i18n.language, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Format currency based on language
  const formatCurrency = (amount: number) => {
    const currencySymbol = i18n.language === 'nl' ? '\u20ac' : '$';
    return `${currencySymbol}${amount.toFixed(2)}`;
  };

  return (
    <div className="px-4 py-4 space-y-6 pb-20">
      {/* Points & Value Card */}
      <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-3">
          <Gift className="w-6 h-6" />
          <h2 className="text-lg font-bold">{t('child.rewards.title')}</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-green-100 text-sm">{t('child.rewards.yourPoints')}</p>
            <div className="flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-300" fill="currentColor" />
              <span className="text-3xl font-bold">{memberPoints.toLocaleString()}</span>
            </div>
          </div>

          {pointToMoneyRate > 0 && (
            <div>
              <p className="text-green-100 text-sm">{t('child.rewards.worthAmount')}</p>
              <p className="text-3xl font-bold">{formatCurrency(totalMoney)}</p>
            </div>
          )}
        </div>

        {/* Show pending vs available when there are pending requests */}
        {pendingPointsTotal > 0 && (
          <div className="mt-4 pt-4 border-t border-green-300/30">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-green-100">{t('child.rewards.pendingPoints')}</p>
                <p className="font-bold text-amber-200">-{pendingPointsTotal.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-green-100">{t('child.rewards.availablePoints')}</p>
                <p className="font-bold">{availablePoints.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Weekly Goal Progress */}
      {weeklyTargetPoints > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-500" />
              <span className="font-semibold text-gray-900">{t('rewards.weeklyGoal.title')}</span>
            </div>
            <span className="text-sm font-medium text-purple-600">
              {weeklyPoints} / {weeklyTargetPoints}
            </span>
          </div>

          <div className="w-full bg-purple-100 rounded-full h-4 mb-2">
            <div
              className={`h-4 rounded-full transition-all duration-500 ${
                reachedWeeklyGoal ? 'bg-green-500' : 'bg-purple-500'
              }`}
              style={{ width: `${weeklyProgress}%` }}
            />
          </div>

          {reachedWeeklyGoal ? (
            <div className="flex items-center gap-2 text-green-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">
                {t('rewards.weeklyGoal.reached', { bonus: weeklyTargetBonus.toFixed(2) })}
              </span>
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              {t('rewards.weeklyGoal.earnMore', {
                remaining: weeklyTargetPoints - weeklyPoints,
                bonus: weeklyTargetBonus.toFixed(2),
              })}
            </p>
          )}
        </div>
      )}

      {/* Request Redemption Section */}
      {pointToMoneyRate > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">{t('child.rewards.requestPayout')}</h3>

          {canRedeem ? (
            <div className="space-y-4">
              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('rewards.pointsToRedeem')}
                </label>
                <input
                  type="number"
                  min={minimumRedemption}
                  max={availablePoints}
                  value={requestedAmount || ''}
                  onChange={(e) =>
                    setRequestedAmount(Math.min(parseInt(e.target.value) || 0, availablePoints))
                  }
                  placeholder={t('rewards.minimumPlaceholder', { minimum: minimumRedemption })}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {requestedAmount > 0 && (
                  <p className="text-lg font-semibold text-green-600 mt-2">
                    = {formatCurrency(requestedAmount * pointToMoneyRate)}
                  </p>
                )}
              </div>

              {/* Quick Select Buttons */}
              <div className="flex gap-2 flex-wrap">
                {[minimumRedemption, Math.floor(availablePoints / 2), availablePoints]
                  .filter((v, i, arr) => v >= minimumRedemption && arr.indexOf(v) === i && v > 0)
                  .slice(0, 3)
                  .map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setRequestedAmount(amount)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        requestedAmount === amount
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {amount}
                    </button>
                  ))}
              </div>

              {/* Submit Button */}
              <button
                onClick={handleRequestRedemption}
                disabled={
                  isRequesting ||
                  requestedAmount < minimumRedemption ||
                  requestedAmount > availablePoints
                }
                className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg"
              >
                <Gift className="w-5 h-5" />
                {isRequesting ? t('rewards.requesting') : t('child.rewards.requestButton')}
              </button>

              {/* Success Message */}
              {showSuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">{t('child.rewards.successMessage')}</span>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium">{errorMessage}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                <Star className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">
                {t('child.rewards.minimumNeeded', { minimum: minimumRedemption })}
              </p>
              <p className="text-sm text-gray-500 mt-1">{t('rewards.keepEarning')}</p>
            </div>
          )}
        </div>
      )}

      {/* Pending Redemptions */}
      {pendingRedemptions.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">{t('child.rewards.pendingRequests')}</h3>
          <div className="space-y-3">
            {pendingRedemptions.map((redemption) => (
              <div
                key={redemption.id}
                className={`flex items-center justify-between p-4 rounded-xl ${
                  redemption.status === 'pending'
                    ? 'bg-amber-50 border border-amber-200'
                    : 'bg-green-50 border border-green-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {redemption.status === 'pending' ? (
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Check className="w-5 h-5 text-green-600" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" fill="currentColor" />
                      <span className="font-bold text-gray-900">{redemption.points_redeemed}</span>
                      <span className="text-gray-500">=</span>
                      <span className="font-bold text-green-600">
                        {formatCurrency(redemption.money_amount)}
                      </span>
                    </div>
                    {redemption.created_at && (
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(redemption.created_at)}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    redemption.status === 'pending'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  {t(`rewards.status.${redemption.status}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No rewards enabled message */}
      {pointToMoneyRate === 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
            <Gift className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600">{t('child.rewards.notEnabled')}</p>
        </div>
      )}
    </div>
  );
}
