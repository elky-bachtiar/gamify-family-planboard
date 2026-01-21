import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, LogOut, Camera, Trash2, Star, Flame, Trophy } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { getSupabaseClient } from '../../lib/supabase';
import { getPointsForNextLevel } from '../../types';

interface ChildProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChildProfileModal({ isOpen, onClose }: ChildProfileModalProps) {
  const { t } = useTranslation(['common', 'gamification']);
  const { signOut, refreshAuth } = useAuth();
  const { currentMember, setCurrentMember } = useFamily();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentMember?.avatar_url || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !currentMember) return null;

  const levelProgress = getPointsForNextLevel(currentMember.total_points);

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

  const handleRemoveAvatar = async () => {
    if (!currentMember.avatar_url) {
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setIsUploading(true);
    try {
      const supabase = getSupabaseClient();

      // Delete from storage
      const oldPath = currentMember.avatar_url.split('/').slice(-2).join('/').split('?')[0];
      await supabase.storage.from('avatars-public').remove([oldPath]);

      // Update database
      const { data, error } = await supabase
        .from('family_members')
        .update({ avatar_url: null } as never)
        .eq('id', currentMember.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setCurrentMember(data);
        await refreshAuth();
      }

      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error removing avatar:', error);
      alert(t('common:profile.uploadFailed', 'Failed to update avatar'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveAvatar = async () => {
    if (!selectedFile || !currentMember) return;

    setIsUploading(true);
    try {
      const supabase = getSupabaseClient();

      // Use member ID for PIN users (they don't have user_id)
      const userId = currentMember.user_id || currentMember.id;
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${userId}/avatar.${fileExt}`;

      // Delete old avatar if exists
      if (currentMember.avatar_url) {
        const oldPath = currentMember.avatar_url.split('/').slice(-2).join('/').split('?')[0];
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

      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      // Update database
      const { data, error } = await supabase
        .from('family_members')
        .update({ avatar_url: avatarUrl } as never)
        .eq('id', currentMember.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setCurrentMember(data);
        await refreshAuth();
      }

      setSelectedFile(null);
      onClose();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert(t('common:profile.uploadFailed', 'Failed to upload avatar'));
    } finally {
      setIsUploading(false);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">{t('common:profile.myProfile', 'My Profile')}</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Avatar section */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={currentMember.name}
                  className="w-28 h-28 rounded-full object-cover shadow-lg ring-4 ring-white"
                />
              ) : (
                <div
                  className="w-28 h-28 rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-lg ring-4 ring-white"
                  style={{ backgroundColor: currentMember.color }}
                >
                  {currentMember.name.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Camera button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-colors disabled:bg-gray-300"
                title={t('common:profile.changeAvatar', 'Change avatar')}
              >
                <Camera className="w-5 h-5" />
              </button>

              {/* Remove button */}
              {previewUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={isUploading}
                  className="absolute top-0 right-0 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors disabled:bg-gray-300"
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

            {/* Name */}
            <h3 className="text-2xl font-bold text-gray-900">{currentMember.name}</h3>

            {/* Save button - only show when file selected */}
            {selectedFile && (
              <button
                onClick={handleSaveAvatar}
                disabled={isUploading}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full font-medium transition-colors disabled:bg-gray-300"
              >
                {isUploading ? t('common:buttons.loading') : t('common:profile.savePhoto', 'Save Photo')}
              </button>
            )}
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-3">
            {/* Level */}
            <div className="bg-purple-50 rounded-2xl p-3 text-center">
              <Trophy className="w-6 h-6 text-purple-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-purple-700">{currentMember.current_level}</p>
              <p className="text-xs text-purple-600">{t('common:labels.level')}</p>
            </div>

            {/* Points */}
            <div className="bg-amber-50 rounded-2xl p-3 text-center">
              <Star className="w-6 h-6 text-amber-500 mx-auto mb-1" fill="currentColor" />
              <p className="text-2xl font-bold text-amber-700">{currentMember.total_points.toLocaleString()}</p>
              <p className="text-xs text-amber-600">{t('common:labels.points')}</p>
            </div>

            {/* Streak */}
            <div className="bg-orange-50 rounded-2xl p-3 text-center">
              <Flame className="w-6 h-6 text-orange-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-orange-700">{currentMember.current_streak}</p>
              <p className="text-xs text-orange-600">{t('common:labels.days')}</p>
            </div>
          </div>

          {/* Level progress */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {t('gamification:level.current', { level: currentMember.current_level })}
              </span>
              <span className="text-xs text-gray-500">
                {t('gamification:child.header.percentToLevel', { percent: Math.round(levelProgress.progress), level: currentMember.current_level + 1 })}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-purple-500 to-purple-600"
                style={{ width: `${levelProgress.progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {levelProgress.next - currentMember.total_points} {t('common:labels.points')} {t('gamification:level.toNextLevel', 'to next level')}
            </p>
          </div>
        </div>

        {/* Sign out button */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut || isUploading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-medium disabled:opacity-50"
          >
            <LogOut className="w-5 h-5" />
            {isLoggingOut ? t('common:buttons.loading') : t('common:profile.signOut')}
          </button>
        </div>
      </div>
    </div>
  );
}
