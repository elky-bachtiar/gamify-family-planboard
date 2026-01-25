import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useFamily } from '../../contexts/FamilyContext';
import { useAuth } from '../../contexts/AuthContext';
import { logMemberAudit } from '../../lib/auditLog';
import type { FamilyMember } from '../../types';

interface DeleteMemberConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: FamilyMember | null;
}

export function DeleteMemberConfirmModal({
  isOpen,
  onClose,
  member,
}: DeleteMemberConfirmModalProps) {
  const { t } = useTranslation(['admin', 'common']);
  const { refreshMembers } = useFamily();
  const { familyMember, family } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !member) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      // Log audit before deletion (so we have the member info)
      if (familyMember && family) {
        await logMemberAudit(family.id, familyMember.id, 'delete', member.id, member.name, {
          total_points: member.total_points,
          current_level: member.current_level,
        });
      }

      const { error: deleteError } = await supabase
        .from('family_members')
        .delete()
        .eq('id', member.id);

      if (deleteError) throw deleteError;

      await refreshMembers();
      onClose();
    } catch (err) {
      console.error('Error deleting member:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete member');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="text-xl font-bold text-gray-900">{t('admin:deleteMember.title')}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: member.color ?? '#3b82f6' }}
            >
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-medium text-gray-900">{member.name}</div>
              <div className="text-sm text-gray-500">
                {t('admin:deleteMember.pointsAndLevel', {
                  points: member.total_points,
                  level: member.current_level,
                })}
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {t('admin:deleteMember.warningIntro', { name: member.name })}
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>{t('admin:deleteMember.warningPoints')}</li>
              <li>{t('admin:deleteMember.warningAchievements')}</li>
              <li>{t('admin:deleteMember.warningTasks')}</li>
              <li>{t('admin:deleteMember.warningRedemptions')}</li>
            </ul>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 space-y-2">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? t('admin:deleteMember.deleting') : t('admin:deleteMember.deleteButton')}
          </button>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            {t('common:buttons.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
