import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Crown, Shield, ShieldOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useFamily } from '../../contexts/FamilyContext';
import { useAuth } from '../../contexts/AuthContext';
import { logMemberAudit } from '../../lib/auditLog';
import type { FamilyMember } from '../../types';

interface ToggleAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: FamilyMember | null;
  adminCount: number;
}

export function ToggleAdminModal({ isOpen, onClose, member, adminCount }: ToggleAdminModalProps) {
  const { t } = useTranslation(['admin', 'common']);
  const { refreshMembers } = useFamily();
  const { refreshAuth, familyMember: currentUser, family } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !member) return null;

  const isPromoting = !member.is_admin;
  const isLastAdmin = member.is_admin && adminCount <= 1;

  const handleToggleAdmin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('toggle-admin', {
        body: {
          memberId: member.id,
          makeAdmin: isPromoting,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to update admin status');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Log audit for admin status change
      if (currentUser && family) {
        await logMemberAudit(family.id, currentUser.id, 'update', member.id, member.name, {
          admin_status_changed: true,
          new_is_admin: isPromoting,
        });
      }

      await refreshMembers();
      await refreshAuth();
      onClose();
    } catch (err) {
      console.error('Error toggling admin:', err);
      setError(err instanceof Error ? err.message : 'Failed to update admin status');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-bold text-gray-900">
              {isPromoting
                ? t('admin:toggleAdmin.promoteTitle')
                : t('admin:toggleAdmin.demoteTitle')}
            </h2>
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
                {member.is_admin ? t('admin:members.admin') : t('admin:toggleAdmin.notAdmin')}
              </div>
            </div>
          </div>

          {isPromoting ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              <p className="font-medium mb-1">{t('admin:toggleAdmin.promoteWarningTitle')}</p>
              <p>{t('admin:toggleAdmin.promoteWarningMessage', { name: member.name })}</p>
            </div>
          ) : isLastAdmin ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <p className="font-medium mb-1">{t('admin:toggleAdmin.lastAdminTitle')}</p>
              <p>{t('admin:toggleAdmin.lastAdminMessage')}</p>
            </div>
          ) : (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
              <p className="font-medium mb-1">{t('admin:toggleAdmin.demoteWarningTitle')}</p>
              <p>{t('admin:toggleAdmin.demoteWarningMessage', { name: member.name })}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 space-y-2">
          {!isLastAdmin && (
            <button
              onClick={handleToggleAdmin}
              disabled={isLoading}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium ${
                isPromoting
                  ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              {isPromoting ? (
                <>
                  <Shield className="w-4 h-4" />
                  {isLoading
                    ? t('admin:toggleAdmin.promoting')
                    : t('admin:toggleAdmin.promoteButton')}
                </>
              ) : (
                <>
                  <ShieldOff className="w-4 h-4" />
                  {isLoading
                    ? t('admin:toggleAdmin.demoting')
                    : t('admin:toggleAdmin.demoteButton')}
                </>
              )}
            </button>
          )}
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
