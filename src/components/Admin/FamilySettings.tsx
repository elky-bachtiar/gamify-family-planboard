import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Globe, Copy, Check, RefreshCw, Save, Users, Crown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

export function FamilySettings() {
  const { t } = useTranslation(['admin', 'common']);
  const { family, refreshAuth } = useAuth();
  const [familyName, setFamilyName] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState('en');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<'member' | 'parent' | null>(null);
  const [regeneratingCode, setRegeneratingCode] = useState<'member' | 'parent' | null>(null);

  useEffect(() => {
    if (family) {
      setFamilyName(family.name);
      setDefaultLanguage(family.default_language || 'en');
    }
  }, [family]);

  if (!family) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const { error: updateError } = await supabase
        .from('families')
        .update({
          name: familyName.trim(),
          default_language: defaultLanguage,
        })
        .eq('id', family.id);

      if (updateError) throw updateError;

      await refreshAuth();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving family settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyCode = async (type: 'member' | 'parent') => {
    const code = type === 'member' ? family.invite_code : family.parent_invite_code;
    const link = type === 'member'
      ? `${window.location.origin}/join/${code}`
      : `${window.location.origin}/join-parent/${code}`;

    try {
      await navigator.clipboard.writeText(link);
      setCopiedCode(type);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleRegenerateCode = async (type: 'member' | 'parent') => {
    setRegeneratingCode(type);
    setError(null);

    try {
      const response = await supabase.functions.invoke('regenerate-invite-code', {
        body: { code_type: type },
      });

      if (response.error) throw response.error;

      await refreshAuth();
    } catch (err) {
      console.error('Error regenerating code:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate code');
    } finally {
      setRegeneratingCode(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Family Name Section */}
      <div className="bg-white rounded-xl p-5 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-800">{t('admin:settings.title')}</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="familyName" className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin:settings.familyNameLabel')}
            </label>
            <input
              id="familyName"
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="defaultLanguage" className="block text-sm font-medium text-gray-700 mb-1">
              <Globe className="w-4 h-4 inline mr-1" />
              {t('admin:settings.defaultLanguageLabel')}
            </label>
            <p className="text-xs text-gray-500 mb-2">{t('admin:settings.defaultLanguageHelp')}</p>
            <select
              id="defaultLanguage"
              value={defaultLanguage}
              onChange={(e) => setDefaultLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {saveSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-600 flex items-center gap-2">
              <Check className="w-4 h-4" />
              {t('admin:settings.saved')}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving || !familyName.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <Save className="w-4 h-4" />
            {isSaving ? t('admin:settings.saving') : t('admin:settings.saveButton')}
          </button>
        </div>
      </div>

      {/* Invite Codes Section */}
      <div className="bg-white rounded-xl p-5 border border-gray-200">
        <h3 className="font-semibold text-gray-800 mb-4">{t('admin:settings.inviteCodesTitle')}</h3>

        <div className="space-y-4">
          {/* Member Invite Code */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-gray-800">{t('admin:inviteCode.title')}</span>
            </div>
            <p className="text-xs text-gray-600 mb-3">{t('admin:inviteCode.description')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-white rounded-lg text-sm font-mono text-gray-800 border border-blue-200 truncate">
                {family.invite_code}
              </code>
              <button
                onClick={() => handleCopyCode('member')}
                className={`p-2 rounded-lg transition-colors ${
                  copiedCode === 'member'
                    ? 'bg-green-500 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                title={t('common:buttons.copyLink')}
              >
                {copiedCode === 'member' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleRegenerateCode('member')}
                disabled={regeneratingCode === 'member'}
                className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
                title={t('admin:settings.regenerateCode')}
              >
                <RefreshCw className={`w-4 h-4 ${regeneratingCode === 'member' ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Parent Invite Code */}
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4 text-amber-600" />
              <span className="font-medium text-gray-800">{t('admin:parentInviteCode.title')}</span>
            </div>
            <p className="text-xs text-gray-600 mb-3">{t('admin:parentInviteCode.description')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-white rounded-lg text-sm font-mono text-gray-800 border border-amber-200 truncate">
                {family.parent_invite_code}
              </code>
              <button
                onClick={() => handleCopyCode('parent')}
                className={`p-2 rounded-lg transition-colors ${
                  copiedCode === 'parent'
                    ? 'bg-green-500 text-white'
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}
                title={t('common:buttons.copyLink')}
              >
                {copiedCode === 'parent' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleRegenerateCode('parent')}
                disabled={regeneratingCode === 'parent'}
                className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
                title={t('admin:settings.regenerateCode')}
              >
                <RefreshCw className={`w-4 h-4 ${regeneratingCode === 'parent' ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
