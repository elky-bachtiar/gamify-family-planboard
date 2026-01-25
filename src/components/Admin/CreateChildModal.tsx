import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, UserPlus, Copy, Check, Link, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useColorPalette } from '../../hooks/useColorPalette';
import { logMemberAudit } from '../../lib/auditLog';

interface CreateChildModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateChildModal({ isOpen, onClose }: CreateChildModalProps) {
  const { t } = useTranslation(['admin', 'common']);
  const { family, familyMember, refreshAuth } = useAuth();
  const { colors } = useColorPalette();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [selectedColor, setSelectedColor] = useState(colors[0]);
  const [showPin, setShowPin] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !family) return null;

  const isValidPin = /^\d{4,6}$/.test(pin);
  const pinsMatch = pin === confirmPin;
  const canCreate = name.trim() && isValidPin && pinsMatch;

  const handleCreate = async () => {
    if (!canCreate) return;

    setIsCreating(true);
    setError(null);

    try {
      // Call the create-child edge function
      const { data, error: fnError } = await supabase.functions.invoke('create-child', {
        body: {
          name: name.trim(),
          pin,
          color: selectedColor,
          family_id: family.id,
        },
      });

      if (fnError) throw fnError;

      if (data?.error) {
        throw new Error(data.error);
      }

      // Generate the invite link
      const inviteLink = `${window.location.origin}/child-login/${data.child_invite_code}`;
      setCreatedInviteLink(inviteLink);

      // Log audit for member creation
      if (familyMember && data.member_id) {
        await logMemberAudit(family.id, familyMember.id, 'create', data.member_id, name.trim(), {
          is_pin_user: true,
          color: selectedColor,
        });
      }

      // Refresh auth to update family members
      await refreshAuth();
    } catch (err) {
      console.error('Error creating child:', err);
      setError(err instanceof Error ? err.message : 'Failed to create child account');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!createdInviteLink) return;

    try {
      await navigator.clipboard.writeText(createdInviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleClose = () => {
    setName('');
    setPin('');
    setConfirmPin('');
    setSelectedColor(colors[0]);
    setError(null);
    setCreatedInviteLink(null);
    setCopied(false);
    onClose();
  };

  // Success view after creating child
  if (createdInviteLink) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              <h2 className="text-xl font-bold text-gray-900">
                {t('admin:createChild.success.title')}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div
                className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-white text-2xl font-bold mb-3"
                style={{ backgroundColor: selectedColor }}
              >
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="text-lg font-semibold text-gray-900">{name}</div>
              <div className="text-sm text-gray-600">
                {t('admin:createChild.success.message', { name })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Link className="w-4 h-4 inline-block mr-1" />
                {t('admin:createChild.success.copyLink')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdInviteLink}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono"
                />
                <button
                  onClick={handleCopyLink}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    copied
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      {t('common:buttons.copied')}
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      {t('common:buttons.copy')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleClose}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {t('common:buttons.close')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Create form view
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-900">{t('admin:createChild.title')}</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">{t('admin:createChild.subtitle')}</p>

          <div>
            <label htmlFor="childName" className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin:createChild.nameLabel')}
            </label>
            <input
              id="childName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('admin:createChild.namePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin:createChild.pinLabel')}
            </label>
            <div className="relative">
              <input
                id="pin"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('admin:createChild.pinPlaceholder')}
                inputMode="numeric"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {pin && !isValidPin && (
              <p className="text-xs text-red-500 mt-1">{t('admin:createChild.pinHelp')}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPin" className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth:register.confirmPasswordLabel')}
            </label>
            <input
              id="confirmPin"
              type={showPin ? 'text' : 'password'}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('admin:createChild.pinPlaceholder')}
              inputMode="numeric"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {confirmPin && !pinsMatch && (
              <p className="text-xs text-red-500 mt-1">
                {t('auth:register.errors.passwordMismatch')}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('admin:createChild.colorLabel')}
            </label>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    selectedColor === color
                      ? 'ring-2 ring-offset-2 ring-blue-500 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 space-y-2">
          <button
            onClick={handleCreate}
            disabled={isCreating || !canCreate}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            <UserPlus className="w-4 h-4" />
            {isCreating ? t('admin:createChild.creating') : t('admin:createChild.createButton')}
          </button>
          <button
            onClick={handleClose}
            className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            {t('common:buttons.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
