import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Plus, Pencil, Trash2, X, Save, Camera, Image } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { FamilyObject } from '../../types';

export function ObjectsManager() {
  const { t } = useTranslation(['admin', 'common']);
  const { family } = useAuth();
  const [objects, setObjects] = useState<FamilyObject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingObject, setEditingObject] = useState<FamilyObject | null>(null);
  const [deletingObject, setDeletingObject] = useState<FamilyObject | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (family?.id) {
      loadObjects();
    }
  }, [family?.id]);

  const loadObjects = async () => {
    if (!family?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('family_objects')
        .select('*')
        .eq('family_id', family.id)
        .order('name');

      if (error) throw error;
      setObjects(data || []);
    } catch (err) {
      console.error('Error loading objects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError(t('common:profile.invalidFileType'));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError(t('common:profile.fileTooLarge'));
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setError(null);
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (objectId: string): Promise<string | null> => {
    if (!selectedFile || !family?.id) return null;

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${family.id}/${objectId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('family-objects')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('family-objects')
        .getPublicUrl(fileName);

      return `${publicUrl}?t=${Date.now()}`;
    } catch (err) {
      console.error('Error uploading image:', err);
      return null;
    }
  };

  const openCreateModal = () => {
    setEditingObject(null);
    setName('');
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (obj: FamilyObject) => {
    setEditingObject(obj);
    setName(obj.name);
    setSelectedFile(null);
    setPreviewUrl(obj.image_url);
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !family?.id) return;

    setIsSaving(true);
    setError(null);

    try {
      if (editingObject) {
        // Update existing object
        let imageUrl = editingObject.image_url;

        if (selectedFile) {
          imageUrl = await uploadImage(editingObject.id);
        } else if (previewUrl === null && editingObject.image_url) {
          // User removed image
          const oldPath = `${family.id}/${editingObject.id}`;
          await supabase.storage.from('family-objects').remove([oldPath]);
          imageUrl = null;
        }

        const { error: updateError } = await supabase
          .from('family_objects')
          .update({
            name: name.trim(),
            image_url: imageUrl,
            updated_at: new Date().toISOString(),
          } as never)
          .eq('id', editingObject.id);

        if (updateError) throw updateError;
      } else {
        // Create new object
        const { data: newObject, error: insertError } = await supabase
          .from('family_objects')
          .insert({
            family_id: family.id,
            name: name.trim(),
          } as never)
          .select()
          .single();

        if (insertError) throw insertError;

        if (selectedFile && newObject) {
          const obj = newObject as FamilyObject;
          const imageUrl = await uploadImage(obj.id);
          if (imageUrl) {
            await supabase
              .from('family_objects')
              .update({ image_url: imageUrl } as never)
              .eq('id', obj.id);
          }
        }
      }

      await loadObjects();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving object:', err);
      setError(err instanceof Error ? err.message : t('common:errors.generic'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingObject || !family?.id) return;

    setIsDeleting(true);
    try {
      // Delete image from storage if exists
      if (deletingObject.image_url) {
        const oldPath = `${family.id}/${deletingObject.id}`;
        await supabase.storage.from('family-objects').remove([oldPath]);
      }

      const { error } = await supabase
        .from('family_objects')
        .delete()
        .eq('id', deletingObject.id);

      if (error) throw error;

      await loadObjects();
      setDeletingObject(null);
    } catch (err) {
      console.error('Error deleting object:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700">
            {t('admin:objects.title')}
          </h3>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {t('admin:objects.add')}
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        {t('admin:objects.description')}
      </p>

      {objects.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>{t('admin:objects.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {objects.map((obj) => (
            <div
              key={obj.id}
              className="bg-gray-50 rounded-lg p-3 flex flex-col items-center"
            >
              <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center mb-2 overflow-hidden">
                {obj.image_url ? (
                  <img
                    src={obj.image_url}
                    alt={obj.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Image className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-900 text-center truncate w-full">
                {obj.name}
              </span>
              <div className="flex items-center gap-1 mt-2">
                <button
                  onClick={() => openEditModal(obj)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title={t('common:buttons.edit')}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeletingObject(obj)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title={t('common:buttons.delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-500" />
                <h2 className="text-xl font-bold text-gray-900">
                  {editingObject ? t('admin:objects.editTitle') : t('admin:objects.createTitle')}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Image className="w-12 h-12 text-gray-400" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-colors"
                    title={t('admin:objects.uploadImage')}
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  {previewUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-0 right-0 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition-colors"
                      title={t('admin:objects.removeImage')}
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
              </div>

              <div>
                <label htmlFor="objectName" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin:objects.nameLabel')}
                </label>
                <input
                  id="objectName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('admin:objects.namePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
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
                disabled={isSaving || !name.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                <Save className="w-4 h-4" />
                {isSaving ? t('common:buttons.loading') : t('common:buttons.save')}
              </button>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                {t('common:buttons.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingObject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {t('admin:objects.deleteTitle')}
              </h2>
            </div>

            <div className="p-4">
              <p className="text-gray-600">
                {t('admin:objects.deleteMessage', { name: deletingObject.name })}
              </p>
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button
                onClick={() => setDeletingObject(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                {t('common:buttons.cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 font-medium"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? t('common:buttons.loading') : t('common:buttons.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
