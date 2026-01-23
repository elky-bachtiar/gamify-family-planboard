import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Camera, AlertTriangle, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { PointsHistory } from '../../types';

interface CreateDisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  deduction: PointsHistory;
  onDisputeCreated: () => void;
}

export function CreateDisputeModal({
  isOpen,
  onClose,
  deduction,
  onDisputeCreated,
}: CreateDisputeModalProps) {
  const { t } = useTranslation(['gamification', 'common']);
  const { familyMember, family, isPinUser } = useAuth();
  const [reason, setReason] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !familyMember || !family) return;

    if (evidenceUrls.length + files.length > 3) {
      setError(t('gamification:disputes.maxPhotos', 'Maximum 3 photos allowed'));
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const uploadedUrls: string[] = [];

      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          throw new Error('Only image files are allowed');
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          throw new Error('Image must be smaller than 5MB');
        }

        // Generate unique filename
        const ext = file.name.split('.').pop();
        const filename = `${family.id}/${familyMember.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('dispute-evidence')
          .upload(filename, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage.from('dispute-evidence').getPublicUrl(filename);

        uploadedUrls.push(urlData.publicUrl);
      }

      setEvidenceUrls([...evidenceUrls, ...uploadedUrls]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeEvidence = (index: number) => {
    setEvidenceUrls(evidenceUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!reason.trim() || !familyMember || !family) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      let authHeader: string | undefined;

      if (isPinUser) {
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-dispute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify({
            points_history_id: deduction.id,
            reason: reason.trim(),
            evidence_urls: evidenceUrls.length > 0 ? evidenceUrls : undefined,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create dispute');
      }

      onDisputeCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create dispute');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            {t('gamification:disputes.createTitle', 'Dispute Deduction')}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Original deduction info */}
          <div className="bg-red-50 rounded-lg p-3 border border-red-200">
            <div className="text-sm font-medium text-red-700 mb-1">
              {t('gamification:disputes.originalDeduction', 'Original Deduction')}
            </div>
            <div className="text-lg font-bold text-red-600">{deduction.points} points</div>
            <div className="text-sm text-gray-600 mt-1">{deduction.reason}</div>
          </div>

          {/* Reason input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('gamification:disputes.reasonLabel', 'Why are you disputing this?')}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t(
                'gamification:disputes.reasonPlaceholder',
                'Explain why you think this deduction was unfair...'
              )}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              maxLength={1000}
            />
            <div className="text-xs text-gray-400 text-right mt-1">{reason.length}/1000</div>
          </div>

          {/* Evidence upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('gamification:disputes.evidenceLabel', 'Add evidence (optional)')}
            </label>

            {/* Uploaded images */}
            {evidenceUrls.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {evidenceUrls.map((url, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={url}
                      alt={`Evidence ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeEvidence(idx)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload button */}
            {evidenceUrls.length < 3 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors w-full justify-center"
              >
                {isUploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-blue-500 rounded-full animate-spin" />
                    <span>{t('common:labels.uploading', 'Uploading...')}</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5" />
                    <span>{t('gamification:disputes.addPhoto', 'Add Photo')}</span>
                  </>
                )}
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            <p className="text-xs text-gray-500 mt-2">
              {t('gamification:disputes.photoHint', 'Max 3 photos, 5MB each')}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
            >
              {t('common:buttons.cancel', 'Cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!reason.trim() || isSubmitting}
              className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{t('common:labels.submitting', 'Submitting...')}</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>{t('gamification:disputes.submitButton', 'Submit Dispute')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
