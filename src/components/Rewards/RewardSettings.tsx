import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, Target, Save, Info } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface RewardSettingsProps {
  onSave?: () => void;
}

export function RewardSettings({ onSave }: RewardSettingsProps) {
  const { t } = useTranslation('gamification');
  const { family, refreshAuth, isAdmin } = useAuth();
  const [pointToMoneyRate, setPointToMoneyRate] = useState<number>(0);
  const [minimumRedemption, setMinimumRedemption] = useState<number>(0);
  const [weeklyTargetPoints, setWeeklyTargetPoints] = useState<number>(0);
  const [weeklyTargetBonus, setWeeklyTargetBonus] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (family) {
      setPointToMoneyRate(family.point_to_money_rate || 0);
      setMinimumRedemption(family.minimum_redemption || 0);
      setWeeklyTargetPoints(family.weekly_target_points || 0);
      setWeeklyTargetBonus(family.weekly_target_bonus || 0);
    }
  }, [family]);

  if (!isAdmin || !family) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const { error } = await supabase
        .from('families')
        .update({
          point_to_money_rate: pointToMoneyRate,
          minimum_redemption: minimumRedemption,
          weekly_target_points: weeklyTargetPoints,
          weekly_target_bonus: weeklyTargetBonus,
        } as never)
        .eq('id', family.id);

      if (error) throw error;

      await refreshAuth();
      setSaveMessage(t('rewards.settings.savedSuccess'));
      onSave?.();

      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving reward settings:', error);
      setSaveMessage(t('rewards.settings.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const examplePoints = 100;
  const exampleMoney = (examplePoints * pointToMoneyRate).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-5 h-5 text-green-500" />
        <h3 className="text-lg font-semibold text-gray-900">{t('rewards.settings.title')}</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pointToMoneyRate" className="block text-sm font-medium text-gray-700 mb-1">
            {t('rewards.settings.pointsToMoneyRate')}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              id="pointToMoneyRate"
              type="number"
              step="0.01"
              min="0"
              value={pointToMoneyRate}
              onChange={(e) => setPointToMoneyRate(parseFloat(e.target.value) || 0)}
              className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{t('rewards.settings.pointsToMoneyRateHint')}</p>
        </div>

        <div>
          <label htmlFor="minimumRedemption" className="block text-sm font-medium text-gray-700 mb-1">
            {t('rewards.settings.minimumRedemption')}
          </label>
          <input
            id="minimumRedemption"
            type="number"
            min="0"
            value={minimumRedemption}
            onChange={(e) => setMinimumRedemption(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">{t('rewards.settings.minimumRedemptionHint')}</p>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-purple-500" />
          <h4 className="text-md font-semibold text-gray-900">{t('rewards.settings.weeklyBonusTarget')}</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="weeklyTargetPoints" className="block text-sm font-medium text-gray-700 mb-1">
              {t('rewards.settings.weeklyTargetPoints')}
            </label>
            <input
              id="weeklyTargetPoints"
              type="number"
              min="0"
              value={weeklyTargetPoints}
              onChange={(e) => setWeeklyTargetPoints(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">{t('rewards.settings.weeklyTargetPointsHint')}</p>
          </div>

          <div>
            <label htmlFor="weeklyTargetBonus" className="block text-sm font-medium text-gray-700 mb-1">
              {t('rewards.settings.weeklyBonusAmount')}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                id="weeklyTargetBonus"
                type="number"
                step="0.01"
                min="0"
                value={weeklyTargetBonus}
                onChange={(e) => setWeeklyTargetBonus(parseFloat(e.target.value) || 0)}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{t('rewards.settings.weeklyBonusAmountHint')}</p>
          </div>
        </div>
      </div>

      {pointToMoneyRate > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-700">
              {t('rewards.settings.example', { points: examplePoints, money: exampleMoney })}
              {weeklyTargetPoints > 0 && (
                <span className="block mt-1">
                  {t('rewards.settings.weeklyGoalExample', { points: weeklyTargetPoints, bonus: weeklyTargetBonus.toFixed(2) })}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {saveMessage && (
        <div className={`text-sm font-medium ${saveMessage.includes(t('rewards.settings.saveFailed')) ? 'text-red-600' : 'text-green-600'}`}>
          {saveMessage}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
      >
        <Save className="w-4 h-4" />
        {isSaving ? t('rewards.settings.saving') : t('rewards.settings.saveButton')}
      </button>
    </div>
  );
}
