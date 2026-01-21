import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, LogOut, User, Save, Camera, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFamily } from '../contexts/FamilyContext';
import { supabase } from '../lib/supabase';
import { useColorPalette } from '../hooks/useColorPalette';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { t } = useTranslation(['common', 'gamification', 'admin']);
  const { familyMember, signOut, refreshAuth } = useAuth();
  const { setCurrentMember } = useFamily();
  const { colors } = useColorPalette();
  const [name, setName] = useState(familyMember?.name || '');
  const [selectedColor, setSelectedColor] = useState(familyMember?.color || colors[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(familyMember?.avatar_url || null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !familyMember) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(t('common:profile.invalidFileType', 'Please select an image file'));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert(t('common:profile.fileTooLarge', 'File size must be less than 2MB'));
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleRemoveAvatar = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!selectedFile || !familyMember) return familyMember.avatar_url;

    setIsUploadingAvatar(true);
    try {
      const userId = familyMember.user_id || familyMember.id;
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${userId}/avatar.${fileExt}`;

      // Delete old avatar if exists
      if (familyMember.avatar_url) {
        const oldPath = familyMember.avatar_url.split('/').slice(-2).join('/');
        await supabase.storage.from('avatars-public').remove([oldPath]);
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars-public')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL with cache-busting timestamp
      const { data: { publicUrl } } = supabase.storage
        .from('avatars-public')
        .getPublicUrl(fileName);

      return `${publicUrl}?t=${Date.now()}`;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert(t('common:profile.uploadFailed', 'Failed to upload avatar'));
      return familyMember.avatar_url;
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      let avatarUrl = familyMember.avatar_url;

      // Upload avatar if a new file is selected
      if (selectedFile) {
        avatarUrl = await uploadAvatar();
      } else if (previewUrl === null && familyMember.avatar_url) {
        // User removed avatar
        const oldPath = familyMember.avatar_url.split('/').slice(-2).join('/');
        await supabase.storage.from('avatars-public').remove([oldPath]);
        avatarUrl = null;
      }

      const { data, error } = await supabase
        .from('family_members')
        .update({
          name: name.trim(),
          color: selectedColor,
          avatar_url: avatarUrl,
        } as never)
        .eq('id', familyMember.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setCurrentMember(data);
        await refreshAuth();
      }

      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      onClose();
    } catch (error) {
      console.error('Error signing out:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-gray-600" />
            <h2 className="text-xl font-bold text-gray-900">{t('common:profile.settings')}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={name}
                  className="w-24 h-24 rounded-full object-cover shadow-lg"
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg"
                  style={{ backgroundColor: selectedColor }}
                >
                  {name.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-colors"
                title={t('common:profile.changeAvatar', 'Change avatar')}
              >
                <Camera className="w-4 h-4" />
              </button>
              {previewUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="absolute top-0 right-0 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition-colors"
                  title={t('common:profile.removeAvatar', 'Remove avatar')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            {selectedFile && (
              <p className="text-sm text-gray-600">
                {t('common:profile.newAvatarSelected', 'New avatar selected')}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              {t('common:labels.name')}
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('admin:editMember.nameLabel')}
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
                  className={`w-10 h-10 rounded-full transition-transform ${
                    selectedColor === color ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between mb-1">
              <span>{t('gamification:points.total')}:</span>
              <span className="font-semibold">{familyMember.total_points}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>{t('common:labels.level')}:</span>
              <span className="font-semibold">{familyMember.current_level}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('gamification:streak.dayStreak')}:</span>
              <span className="font-semibold">{familyMember.current_streak} {t('common:labels.days')}</span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 space-y-2">
          <button
            onClick={handleSave}
            disabled={isSaving || isUploadingAvatar || !name.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            <Save className="w-4 h-4" />
            {isSaving || isUploadingAvatar ? t('common:buttons.loading') : t('common:buttons.save')}
          </button>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
          >
            <LogOut className="w-4 h-4" />
            {isLoggingOut ? t('common:buttons.loading') : t('common:profile.signOut')}
          </button>
        </div>
      </div>
    </div>
  );
}
