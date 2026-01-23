import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileJson, Check, AlertTriangle, Shield, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export function DataExport() {
  const { t } = useTranslation(['admin', 'common']);
  const { family } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleExport = async () => {
    if (!family) return;

    setIsExporting(true);
    setError(null);
    setExportSuccess(false);

    try {
      const response = await supabase.functions.invoke('export-family-data', {
        body: {},
      });

      if (response.error) throw response.error;

      const data = response.data;

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family_data_${family.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('Error exporting data:', err);
      setError(err instanceof Error ? err.message : 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* GDPR Data Export Section */}
      <div className="bg-white rounded-xl p-5 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <FileJson className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-800">{t('admin:gdpr.exportTitle')}</h3>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {t('admin:gdpr.exportDescription')}
        </p>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
          <p className="text-xs text-blue-700">
            {t('admin:gdpr.exportIncludes')}
          </p>
          <ul className="text-xs text-blue-600 mt-2 space-y-1 list-disc list-inside">
            <li>{t('admin:gdpr.includesFamily')}</li>
            <li>{t('admin:gdpr.includesMembers')}</li>
            <li>{t('admin:gdpr.includesTasks')}</li>
            <li>{t('admin:gdpr.includesPoints')}</li>
            <li>{t('admin:gdpr.includesAchievements')}</li>
            <li>{t('admin:gdpr.includesMessages')}</li>
          </ul>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg mb-4">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {exportSuccess && (
          <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-lg mb-4">
            <Check className="w-4 h-4" />
            {t('admin:gdpr.exportSuccess')}
          </div>
        )}

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          <Download className="w-4 h-4" />
          {isExporting ? t('admin:gdpr.exporting') : t('admin:gdpr.exportButton')}
        </button>
      </div>

      {/* Privacy & Consent Section */}
      <div className="bg-white rounded-xl p-5 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-800">{t('admin:gdpr.privacyTitle')}</h3>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {t('admin:gdpr.privacyDescription')}
        </p>

        <div className="space-y-3">
          <button
            onClick={() => setShowConsentModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors font-medium"
          >
            <Shield className="w-4 h-4" />
            {t('admin:gdpr.manageConsent')}
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors font-medium"
          >
            <Trash2 className="w-4 h-4" />
            {t('admin:gdpr.deleteAllData')}
          </button>
        </div>
      </div>

      {/* Consent Management Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t('admin:gdpr.consentModalTitle')}
            </h3>

            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{t('admin:gdpr.dataCollection')}</p>
                  <p className="text-xs text-gray-500">{t('admin:gdpr.dataCollectionDesc')}</p>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5 text-purple-600 rounded" />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{t('admin:gdpr.analytics')}</p>
                  <p className="text-xs text-gray-500">{t('admin:gdpr.analyticsDesc')}</p>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5 text-purple-600 rounded" />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConsentModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                {t('common:buttons.cancel')}
              </button>
              <button
                onClick={() => setShowConsentModal(false)}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                {t('common:buttons.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Data Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {t('admin:gdpr.deleteModalTitle')}
              </h3>
            </div>

            <p className="text-gray-600 mb-4">
              {t('admin:gdpr.deleteModalDescription')}
            </p>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-red-700 font-medium">
                {t('admin:gdpr.deleteWarning')}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                {t('common:buttons.cancel')}
              </button>
              <button
                onClick={() => {
                  // This would trigger full family deletion
                  // For now, just close the modal
                  setShowDeleteModal(false);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                {t('admin:gdpr.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
