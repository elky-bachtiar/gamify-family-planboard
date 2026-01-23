import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { FamilyObject } from '../types';

interface ObjectPickerProps {
  selectedObjectIds: string[];
  onObjectsChange: (objectIds: string[]) => void;
  maxSelections?: number;
  compact?: boolean;
}

export function ObjectPicker({
  selectedObjectIds,
  onObjectsChange,
  maxSelections = 5,
  compact = false,
}: ObjectPickerProps) {
  const { t } = useTranslation(['tasks', 'common']);
  const { family } = useAuth();
  const [objects, setObjects] = useState<FamilyObject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(!compact);

  useEffect(() => {
    async function fetchObjects() {
      if (!family) return;

      try {
        const { data, error } = await supabase
          .from('family_objects')
          .select('*')
          .eq('family_id', family.id)
          .order('name');

        if (error) throw error;
        setObjects(data || []);
      } catch (error) {
        console.error('Error fetching family objects:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchObjects();
  }, [family]);

  const toggleObject = (objectId: string) => {
    if (selectedObjectIds.includes(objectId)) {
      onObjectsChange(selectedObjectIds.filter((id) => id !== objectId));
    } else if (selectedObjectIds.length < maxSelections) {
      onObjectsChange([...selectedObjectIds, objectId]);
    }
  };

  const selectedObjects = objects.filter((obj) => selectedObjectIds.includes(obj.id));

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        {t('common:labels.loading')}
      </div>
    );
  }

  if (objects.length === 0) {
    return null; // Don't show picker if no objects are configured
  }

  return (
    <div className="space-y-2">
      {/* Header with expand/collapse for compact mode */}
      <div
        className={`flex items-center justify-between ${compact ? 'cursor-pointer' : ''}`}
        onClick={compact ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {t('tasks:objectPicker.title', 'Associated Objects')}
          </span>
          {selectedObjectIds.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {selectedObjectIds.length}
            </span>
          )}
        </div>
        {compact && (
          <button type="button" className="text-gray-400 hover:text-gray-600">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Selected objects summary (always visible in compact mode) */}
      {compact && selectedObjects.length > 0 && !isExpanded && (
        <div className="flex flex-wrap gap-2">
          {selectedObjects.map((obj) => (
            <div
              key={obj.id}
              className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-full text-sm"
            >
              {obj.image_url && (
                <img src={obj.image_url} alt="" className="w-4 h-4 rounded-full object-cover" />
              )}
              <span className="text-blue-700">{obj.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleObject(obj.id);
                }}
                className="ml-1 text-blue-400 hover:text-blue-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Object grid */}
      {isExpanded && (
        <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
          {objects.map((obj) => {
            const isSelected = selectedObjectIds.includes(obj.id);
            const isDisabled = !isSelected && selectedObjectIds.length >= maxSelections;

            return (
              <button
                key={obj.id}
                type="button"
                onClick={() => toggleObject(obj.id)}
                disabled={isDisabled}
                className={`
                  relative flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all
                  ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }
                  ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}

                {/* Object image or placeholder */}
                {obj.image_url ? (
                  <img
                    src={obj.image_url}
                    alt={obj.name}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Package className="w-5 h-5 text-gray-400" />
                  </div>
                )}

                {/* Object name */}
                <span className="text-xs text-gray-700 text-center line-clamp-1">{obj.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Help text */}
      {isExpanded && (
        <p className="text-xs text-gray-500">
          {t('tasks:objectPicker.hint', 'Select up to {{max}} objects', { max: maxSelections })}
        </p>
      )}
    </div>
  );
}
