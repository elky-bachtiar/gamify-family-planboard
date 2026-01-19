import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Palette, Save, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLOR_PALETTES, PaletteKey } from '../../types';

export function PaletteSelector() {
  const { t } = useTranslation('admin');
  const { family, refreshAuth, isAdmin } = useAuth();
  const [selectedPalette, setSelectedPalette] = useState<PaletteKey>('default');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (family?.color_palette) {
      setSelectedPalette(family.color_palette as PaletteKey);
    }
  }, [family]);

  if (!isAdmin || !family) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const { error } = await supabase
        .from('families')
        .update({ color_palette: selectedPalette } as never)
        .eq('id', family.id);

      if (error) throw error;

      await refreshAuth();
      setSaveMessage(t('palette.saved'));
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (error) {
      console.error('Error saving palette:', error);
      setSaveMessage(t('palette.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = selectedPalette !== (family.color_palette || 'default');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Palette className="w-5 h-5 text-purple-500" />
        <h3 className="text-lg font-semibold text-gray-900">{t('palette.title')}</h3>
      </div>

      <p className="text-sm text-gray-600">
        {t('palette.description')}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {(Object.keys(COLOR_PALETTES) as PaletteKey[]).map((key) => {
          const palette = COLOR_PALETTES[key];
          const isSelected = selectedPalette === key;

          return (
            <button
              key={key}
              onClick={() => setSelectedPalette(key)}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">
                  {palette.name}
                </span>
                {isSelected && <Check className="w-4 h-4 text-blue-500" />}
              </div>
              <div className="flex gap-1">
                {palette.colors.slice(0, 8).map((color, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {saveMessage && (
        <div className={`text-sm font-medium ${
          saveMessage.includes(t('palette.saveFailed')) ? 'text-red-600' : 'text-green-600'
        }`}>
          {saveMessage}
        </div>
      )}

      {hasChanges && (
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 font-medium"
        >
          <Save className="w-4 h-4" />
          {isSaving ? t('palette.saving') : t('palette.saveButton')}
        </button>
      )}
    </div>
  );
}
