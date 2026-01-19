import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, UserPlus, Key } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS } from '../../types';
import { LanguageSwitcher } from '../LanguageSwitcher';

function getInviteCodeFromUrl(): string | null {
  const path = window.location.pathname;
  const match = path.match(/^\/join\/([A-Za-z0-9]+)$/);
  return match ? match[1].toUpperCase() : null;
}

export function FamilySetupPage() {
  const { t } = useTranslation(['auth', 'common']);
  const { user, refreshAuth } = useAuth();
  const urlInviteCode = getInviteCodeFromUrl();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>(urlInviteCode ? 'join' : 'choose');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [familyName, setFamilyName] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState<'parent' | 'child'>('parent');

  const [inviteCode, setInviteCode] = useState(urlInviteCode || '');
  const [joinMemberName, setJoinMemberName] = useState('');

  useEffect(() => {
    if (urlInviteCode) {
      setInviteCode(urlInviteCode);
      setMode('join');
    }
  }, [urlInviteCode]);

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setIsLoading(true);

    try {
      // Refresh session to ensure we have the latest auth state
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error(t('auth:familySetup.errors.noSession'));
      }

      const { data: inviteCodeResult } = await supabase.rpc('generate_invite_code');
      const generatedCode = inviteCodeResult as string;

      const { data: familyData, error: familyError } = await supabase
        .from('families')
        .insert({
          name: familyName.trim(),
          invite_code: generatedCode,
          created_by: user.id,
        })
        .select()
        .single();

      if (familyError) {
        console.error('Family insert error:', familyError);
        throw familyError;
      }

      const { error: memberError } = await supabase.from('family_members').insert({
        name: memberName.trim(),
        email: user.email,
        role: memberRole,
        family_id: familyData.id,
        user_id: user.id,
        is_admin: memberRole === 'parent',
        color: COLORS[0],
      });

      if (memberError) {
        console.error('Member insert error:', memberError);
        throw memberError;
      }

      await refreshAuth();
    } catch (err: unknown) {
      console.error('Create family error:', err);
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error(t('auth:familySetup.errors.noSession'));
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/join-family`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inviteCode: inviteCode.trim().toUpperCase(),
          memberName: joinMemberName.trim(),
          color: COLORS[0],
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to join family');
      }

      await refreshAuth();
    } catch (err: unknown) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  if (mode === 'choose') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('auth:familySetup.title')}</h1>
            <p className="text-gray-600">{t('auth:familySetup.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setMode('create')}
              className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-center group"
            >
              <UserPlus className="w-12 h-12 text-gray-400 group-hover:text-blue-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t('auth:familySetup.createOption.title')}
              </h3>
              <p className="text-sm text-gray-600">{t('auth:familySetup.createOption.description')}</p>
            </button>

            <button
              onClick={() => setMode('join')}
              className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-center group"
            >
              <Key className="w-12 h-12 text-gray-400 group-hover:text-blue-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t('auth:familySetup.joinOption.title')}
              </h3>
              <p className="text-sm text-gray-600">{t('auth:familySetup.joinOption.description')}</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <UserPlus className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {t('auth:familySetup.createFamily.title')}
            </h1>
            <p className="text-gray-600">{t('auth:familySetup.createFamily.subtitle')}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateFamily} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth:familySetup.createFamily.familyNameLabel')}
              </label>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder={t('auth:familySetup.createFamily.familyNamePlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth:familySetup.createFamily.yourNameLabel')}
              </label>
              <input
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder={t('auth:familySetup.createFamily.yourNamePlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth:familySetup.createFamily.yourRoleLabel')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMemberRole('parent')}
                  className={`px-4 py-2 rounded-lg border-2 transition-all ${
                    memberRole === 'parent'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-medium">{t('auth:familySetup.createFamily.roleParent')}</div>
                  <div className="text-xs text-gray-600">{t('auth:familySetup.createFamily.roleParentDescription')}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setMemberRole('child')}
                  className={`px-4 py-2 rounded-lg border-2 transition-all ${
                    memberRole === 'child'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-medium">{t('auth:familySetup.createFamily.roleChild')}</div>
                  <div className="text-xs text-gray-600">{t('auth:familySetup.createFamily.roleChildDescription')}</div>
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {t('common:buttons.back')}
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isLoading ? t('auth:familySetup.createFamily.submitting') : t('auth:familySetup.createFamily.submitButton')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Key className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('auth:familySetup.joinFamily.title')}
          </h1>
          <p className="text-gray-600">{t('auth:familySetup.joinFamily.subtitle')}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleJoinFamily} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth:familySetup.joinFamily.inviteCodeLabel')}
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder={t('auth:familySetup.joinFamily.inviteCodePlaceholder')}
              maxLength={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase text-center text-xl font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth:familySetup.joinFamily.yourNameLabel')}
            </label>
            <input
              type="text"
              value={joinMemberName}
              onChange={(e) => setJoinMemberName(e.target.value)}
              placeholder={t('auth:familySetup.joinFamily.yourNamePlaceholder')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('common:buttons.back')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isLoading ? t('auth:familySetup.joinFamily.submitting') : t('auth:familySetup.joinFamily.submitButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
