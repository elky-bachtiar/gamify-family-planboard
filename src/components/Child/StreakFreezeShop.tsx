import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Coins, AlertTriangle, Check, Snowflake } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getStreakFreezeInfo } from '../../lib/gamification';
import { supabase } from '../../lib/supabase';

interface StreakFreezeShopProps {
  onPurchase?: () => void;
}

export function StreakFreezeShop({ onPurchase }: StreakFreezeShopProps) {
  const { t } = useTranslation(['gamification', 'common']);
  const { familyMember, refreshAuth, isPinUser } = useAuth();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!familyMember) return null;

  const freezeInfo = getStreakFreezeInfo(familyMember);

  const handlePurchase = async () => {
    if (!freezeInfo.canPurchase || isPurchasing) return;

    setIsPurchasing(true);
    setError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      let authHeader: string | undefined;

      if (isPinUser) {
        // For PIN users, use the stored token
        const pinToken = sessionStorage.getItem('pin_user_token');
        if (pinToken) {
          authHeader = `Bearer ${pinToken}`;
        }
      } else if (session?.session?.access_token) {
        authHeader = `Bearer ${session.session.access_token}`;
      }

      if (!authHeader) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/purchase-streak-freeze`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify({}),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to purchase streak freeze');
      }

      setSuccess(true);
      refreshAuth();
      onPurchase?.();

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to purchase');
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
          <Snowflake className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            {t('gamification:streakFreeze.shopTitle', 'Streak Freeze')}
          </h3>
          <p className="text-sm text-gray-600">
            {t(
              'gamification:streakFreeze.shopDescription',
              'Protect your streak when you miss a day'
            )}
          </p>
        </div>
      </div>

      {/* Current freezes display */}
      <div className="bg-white rounded-lg p-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-500" />
          <span className="text-sm font-medium text-gray-700">
            {t('gamification:streakFreeze.youHave', 'You have')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: freezeInfo.maxFreezes }).map((_, i) => (
            <div
              key={i}
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                i < freezeInfo.currentFreezes
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-400'
              }`}
            >
              <Shield className="w-4 h-4" />
            </div>
          ))}
        </div>
      </div>

      {/* Purchase section */}
      {freezeInfo.currentFreezes < freezeInfo.maxFreezes ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{t('gamification:streakFreeze.cost', 'Cost')}</span>
            <div className="flex items-center gap-1 font-bold text-amber-600">
              <Coins className="w-4 h-4" />
              {freezeInfo.freezeCost} {t('common:labels.points', 'points')}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {t('gamification:streakFreeze.yourPoints', 'Your points')}
            </span>
            <span className="font-medium text-gray-900">{familyMember.total_points || 0}</span>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-2 rounded-lg">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>
                {t('gamification:streakFreeze.purchaseSuccess', 'Streak freeze purchased!')}
              </span>
            </div>
          )}

          {/* Purchase button */}
          <button
            onClick={handlePurchase}
            disabled={!freezeInfo.canPurchase || isPurchasing}
            className={`
              w-full py-3 rounded-xl font-bold text-white transition-all
              flex items-center justify-center gap-2
              ${
                freezeInfo.canPurchase && !isPurchasing
                  ? 'bg-blue-600 hover:bg-blue-700 active:scale-98'
                  : 'bg-gray-300 cursor-not-allowed'
              }
            `}
          >
            {isPurchasing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('common:labels.loading', 'Loading...')}
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                {freezeInfo.canPurchase
                  ? t('gamification:streakFreeze.buyButton', 'Buy Streak Freeze')
                  : t('gamification:streakFreeze.notEnoughPoints', 'Not enough points')}
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="text-center py-2">
          <div className="text-sm text-blue-600 font-medium">
            {t('gamification:streakFreeze.maxReached', 'Maximum freezes reached!')}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {t('gamification:streakFreeze.maxReachedHint', 'Use one before buying more')}
          </p>
        </div>
      )}

      {/* How it works */}
      <div className="mt-4 pt-4 border-t border-blue-200">
        <p className="text-xs text-gray-500">
          {t(
            'gamification:streakFreeze.howItWorks',
            'Freezes are automatically used when you miss completing a task for the day, protecting your streak from being reset.'
          )}
        </p>
      </div>
    </div>
  );
}
