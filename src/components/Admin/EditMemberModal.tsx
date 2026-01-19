import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useColorPalette } from '../../hooks/useColorPalette';
import { useFamily } from '../../contexts/FamilyContext';
import type { FamilyMember } from '../../types';

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: FamilyMember | null;
}

export function EditMemberModal({ isOpen, onClose, member }: EditMemberModalProps) {
  const { t } = useTranslation(['admin', 'common']);
  const { colors } = useColorPalette();
  const { refreshMembers } = useFamily();
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setName(member.name);
      setSelectedColor(member.color);
    }
  }, [member]);

  if (!isOpen || !member) return null;

  const canSave = name.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;

    setIsSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('family_members')
        .update({ name: name.trim(), color: selectedColor } as never)
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
                    selectedColor === color ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {member.is_pin_user && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              {t('admin:editMember.pinUserWarning')}
            </div>
          )}

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
