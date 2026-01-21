import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, AlertTriangle, Star } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { awardManualPoints } from '../../lib/gamification';

export function ManualPointsManager() {
  const { t } = useTranslation(['admin', 'common']);
  const { familyMember, refreshAuth } = useAuth();
  const { familyMembers } = useFamily();
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Filter out the current admin from the list
  const selectableMembers = familyMembers.filter(m => m.id !== familyMember?.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const pointValue = parseInt(points, 10);
    if (isNaN(pointValue) || pointValue === 0) {
      setError(t('admin:manualPoints.errorInvalidPoints'));
      return;
    }
    if (!selectedMemberId) {
      setError(t('admin:manualPoints.errorSelectMember'));
      return;
    }
    if (!reason.trim()) {
      setError(t('admin:manualPoints.errorEnterReason'));
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!familyMember) return;

    setIsSubmitting(true);
    setShowConfirm(false);

    const pointValue = parseInt(points, 10);
    // Make points negative for deductions
    const actualPoints = pointValue < 0 ? pointValue : -Math.abs(pointValue);

    const result = await awardManualPoints(
      selectedMemberId,
      actualPoints,
      reason.trim(),
      familyMember
    );

    if (result.success) {
      setSuccess(true);
      setSelectedMemberId('');
      setPoints('');
      setReason('');
      refreshAuth();
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(t('admin:manualPoints.errorFailed'));
    }

    setIsSubmitting(false);
  };

  const selectedMember = familyMembers.find(m => m.id === selectedMemberId);
  const pointValue = parseInt(points, 10) || 0;

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Minus className="w-5 h-5 text-red-500" />
        <h3 className="text-sm font-medium text-gray-700">{t('admin:manualPoints.title')}</h3>
      </div>

      <p className="text-xs text-gray-500 mb-4">{t('admin:manualPoints.description')}</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Member Select */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t('admin:manualPoints.selectMember')}
          </label>
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="">{t('admin:manualPoints.selectPlaceholder')}</option>
            {selectableMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} ({member.total_points} {t('common:labels.points')})
              </option>
            ))}
          </select>
        </div>

        {/* Points Input */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t('admin:manualPoints.pointsLabel')}
          </label>
          <input
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder={t('admin:manualPoints.pointsPlaceholder')}
            min="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
          <p className="text-xs text-gray-400 mt-1">{t('admin:manualPoints.pointsHint')}</p>
        </div>

        {/* Reason Input */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t('admin:manualPoints.reasonLabel')}
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('admin:manualPoints.reasonPlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-2 rounded-lg">
            <Star className="w-4 h-4" />
            {t('admin:manualPoints.success')}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !selectedMemberId || !points || !reason.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          <Minus className="w-4 h-4" />
          {isSubmitting ? t('admin:manualPoints.submitting') : t('admin:manualPoints.submitButton')}
        </button>
      </form>

      {/* Confirmation Modal */}
      {showConfirm && selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {t('admin:manualPoints.confirmTitle')}
              </h3>
            </div>

            <p className="text-gray-600 mb-4">
              {t('admin:manualPoints.confirmMessage', {
                name: selectedMember.name,
                points: Math.abs(pointValue)
              })}
            </p>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-700">
                <span className="font-medium">{t('admin:manualPoints.reasonLabel')}:</span> {reason}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                {t('common:buttons.cancel')}
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                {t('admin:manualPoints.confirmButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
