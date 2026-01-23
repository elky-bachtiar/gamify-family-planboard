import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save, User, KeyRound, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useColorPalette } from '../../hooks/useColorPalette';
import { useFamily } from '../../contexts/FamilyContext';
import type { FamilyMember } from '../../types';

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: FamilyMember | null;
}

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function EditMemberModal({ isOpen, onClose, member }: EditMemberModalProps) {
  const { t } = useTranslation(['admin', 'common']);
  const { colors } = useColorPalette();
  const { refreshMembers } = useFamily();
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [enablePinLogin, setEnablePinLogin] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setName(member.name);
      setSelectedColor(member.color ?? '#3b82f6');
      setEnablePinLogin(member.is_pin_user || false);
      setPin('');
      setConfirmPin('');
      setShowPin(false);
    }
  }, [member]);

  if (!isOpen || !member) return null;

  const isPinValid = !enablePinLogin || (pin.length >= 4 && pin === confirmPin);
  const canSave = name.trim().length > 0 && isPinValid;

  const handleSave = async () => {
    if (!canSave) return;

    if (enablePinLogin && pin.length < 4) {
      setError(t('admin:editMember.pinTooShort'));
      return;
    }

    if (enablePinLogin && pin !== confirmPin) {
      setError(t('admin:editMember.pinMismatch'));
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updateData: Record<string, unknown> = {
        name: name.trim(),
        color: selectedColor,
        is_pin_user: enablePinLogin,
      };

      if (enablePinLogin && pin) {
        const pinHash = await hashPin(pin);
        updateData.pin_hash = pinHash;

        if (!member.child_invite_code) {
          const { data: inviteData } = await supabase.rpc('generate_child_invite_code');
          if (inviteData) {
            updateData.child_invite_code = inviteData;
          }
        }
      } else if (!enablePinLogin) {
        updateData.pin_hash = null;
      }

      const { error: updateError } = await supabase
        .from('family_members')
        .update(updateData as never)
        .eq('id', member.id);

      if (updateError) throw updateError;

      await refreshMembers();
      onClose();
    } catch (err) {
      console.error('Error updating member:', err);
      setError(err instanceof Error ? err.message : 'Failed to update member');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setName('');
    setSelectedColor('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-900">{t('admin:editMember.title')}</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
              style={{ backgroundColor: selectedColor }}
            >
              {name.charAt(0).toUpperCase() || '?'}
            </div>
          </div>

          <div>
            <label htmlFor="memberName" className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin:editMember.nameLabel')}
            </label>
            <input
              id="memberName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('admin:editMember.namePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('admin:editMember.colorLabel')}
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

          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="enablePinLogin"
                checked={enablePinLogin}
                onChange={(e) => setEnablePinLogin(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="enablePinLogin"
                className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                {t('admin:editMember.enablePinLogin')}
              </label>
            </div>

            {enablePinLogin && (
              <div className="space-y-3 mt-3">
                <div>
                  <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-1">
                    {member.is_pin_user
                      ? t('admin:editMember.newPinLabel')
                      : t('admin:editMember.pinLabel')}
                  </label>
                  <div className="relative">
                    <input
                      id="pin"
                      type={showPin ? 'text' : 'password'}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder={
                        member.is_pin_user ? t('admin:editMember.pinPlaceholder') : '4-6 digits'
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                      inputMode="numeric"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="confirmPin"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {t('admin:editMember.confirmPinLabel')}
                  </label>
                  <input
                    id="confirmPin"
                    type={showPin ? 'text' : 'password'}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t('admin:editMember.confirmPinPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    inputMode="numeric"
                  />
                </div>
                {pin && confirmPin && pin !== confirmPin && (
                  <p className="text-xs text-red-600">{t('admin:editMember.pinMismatch')}</p>
                )}
                {member.is_pin_user && !pin && (
                  <p className="text-xs text-gray-500">{t('admin:editMember.keepExistingPin')}</p>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 space-y-2">
          <button
            onClick={handleSave}
            disabled={isSaving || !canSave}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            <Save className="w-4 h-4" />
            {isSaving ? t('admin:editMember.saving') : t('admin:editMember.saveButton')}
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
