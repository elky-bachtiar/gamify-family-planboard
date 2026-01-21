import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Users, Shield, DollarSign, UserPlus, Link, CheckCircle2, Pencil, Trash2, Crown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFamily } from '../contexts/FamilyContext';
import { RewardSettings, RedemptionManager } from './Rewards';
import { CreateChildModal } from './Admin/CreateChildModal';
import { TaskApprovalManager } from './Admin/TaskApprovalManager';
import { EditMemberModal } from './Admin/EditMemberModal';
import { DeleteMemberConfirmModal } from './Admin/DeleteMemberConfirmModal';
import { ToggleAdminModal } from './Admin/ToggleAdminModal';
import { PaletteSelector } from './Admin/PaletteSelector';
import { ManualPointsManager } from './Admin/ManualPointsManager';
import type { FamilyMember } from '../types';

export function AdminPanel() {
  const { t } = useTranslation(['admin', 'common']);
  const { family, isAdmin, refreshAuth } = useAuth();
  const { familyMembers } = useFamily();
  const [copied, setCopied] = useState(false);
  const [copiedParent, setCopiedParent] = useState(false);
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null);
  const [isCreateChildOpen, setIsCreateChildOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'approvals' | 'rewards'>('members');
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [deletingMember, setDeletingMember] = useState<FamilyMember | null>(null);
  const [togglingAdminMember, setTogglingAdminMember] = useState<FamilyMember | null>(null);

  if (!isAdmin || !family) return null;

  const inviteLink = `${window.location.origin}/join/${family.invite_code}`;
  const parentInviteLink = family.parent_invite_code
    ? `${window.location.origin}/join-parent/${family.parent_invite_code}`
    : null;
  const adminCount = familyMembers.filter(m => m.is_admin).length;

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyParentInvite = async () => {
    if (!parentInviteLink) return;
    try {
      await navigator.clipboard.writeText(parentInviteLink);
      setCopiedParent(true);
      setTimeout(() => setCopiedParent(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyPinLink = async (memberId: string, childInviteCode: string) => {
    try {
      const pinLink = `${window.location.origin}/child-login/${childInviteCode}`;
      await navigator.clipboard.writeText(pinLink);
      setCopiedMemberId(memberId);
      setTimeout(() => setCopiedMemberId(null), 2000);
    } catch (err) {
      console.error('Failed to copy PIN link:', err);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-500" />
          <h2 className="text-xl font-bold text-gray-900">{t('admin:panel.title')}</h2>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'members'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4 inline-block mr-1" />
            {t('admin:panel.tabs.members')}
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'approvals'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 inline-block mr-1" />
            {t('admin:panel.tabs.approvals')}
          </button>
          <button
            onClick={() => setActiveTab('rewards')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'rewards'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <DollarSign className="w-4 h-4 inline-block mr-1" />
            {t('admin:panel.tabs.rewards')}
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'members' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">{t('admin:inviteCode.title')}</h3>
                <p className="text-xs text-gray-500 mb-2">{t('admin:inviteCode.description')}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono text-gray-800 truncate">
                    {family.invite_code}
                  </code>
                  <button
                    onClick={handleCopyInvite}
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
                        {t('common:buttons.copyLink')}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {parentInviteLink && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    <Crown className="w-4 h-4 inline-block mr-1 text-yellow-500" />
                    {t('admin:parentInviteCode.title')}
                  </h3>
                  <p className="text-xs text-gray-500 mb-2">{t('admin:parentInviteCode.description')}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-yellow-50 rounded-lg text-sm font-mono text-gray-800 truncate">
                      {family.parent_invite_code}
                    </code>
                    <button
                      onClick={handleCopyParentInvite}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        copiedParent
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      }`}
                    >
                      {copiedParent ? (
                        <>
                          <Check className="w-4 h-4" />
                          {t('common:buttons.copied')}
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          {t('common:buttons.copyLink')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  <h3 className="text-sm font-medium text-gray-700">
                    {t('admin:members.count', { count: familyMembers.length })}
                  </h3>
                </div>
                <button
                  onClick={() => setIsCreateChildOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <UserPlus className="w-4 h-4" />
                  {t('admin:members.addChild')}
                </button>
              </div>
              <div className="space-y-2">
                {familyMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: member.color }}
                      />
                      <span className="font-medium text-gray-900">{member.name}</span>
                      {member.is_admin && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                          {t('admin:members.admin')}
                        </span>
                      )}
                      {member.is_pin_user && (
                        <>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                            {t('admin:members.pinUser')}
                          </span>
                          {member.child_invite_code && (
                            <button
                              onClick={() => handleCopyPinLink(member.id, member.child_invite_code!)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                copiedMemberId === member.id
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              {copiedMemberId === member.id ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  {t('common:buttons.copied')}
                                </>
                              ) : (
                                <>
                                  <Link className="w-3 h-3" />
                                  {t('common:buttons.copyLink')}
                                </>
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-gray-600">
                        <span className="font-semibold">{member.total_points}</span> {t('common:labels.points')}
                        <span className="mx-2">|</span>
                        {t('common:labels.level')} <span className="font-semibold">{member.current_level}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setTogglingAdminMember(member)}
                          className={`p-1.5 rounded transition-colors ${
                            member.is_admin
                              ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50'
                              : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                          }`}
                          title={member.is_admin ? t('admin:members.demoteAdmin') : t('admin:members.promoteAdmin')}
                        >
                          <Crown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingMember(member)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title={t('admin:members.editMember')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {!member.is_admin && (
                          <button
                            onClick={() => setDeletingMember(member)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title={t('admin:members.deleteMember')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6 mt-6">
              <PaletteSelector />
            </div>

            <div className="border-t border-gray-200 pt-6 mt-6">
              <ManualPointsManager />
            </div>
          </div>
        )}

        {activeTab === 'approvals' && (
          <TaskApprovalManager />
        )}

        {activeTab === 'rewards' && (
          <div className="space-y-8">
            <RewardSettings onSave={refreshAuth} />
            <div className="border-t border-gray-200 pt-6">
              <RedemptionManager />
            </div>
          </div>
        )}
      </div>

      <CreateChildModal
        isOpen={isCreateChildOpen}
        onClose={() => setIsCreateChildOpen(false)}
      />

      <EditMemberModal
        isOpen={!!editingMember}
        onClose={() => setEditingMember(null)}
        member={editingMember}
      />

      <DeleteMemberConfirmModal
        isOpen={!!deletingMember}
        onClose={() => setDeletingMember(null)}
        member={deletingMember}
      />

      <ToggleAdminModal
        isOpen={!!togglingAdminMember}
        onClose={() => setTogglingAdminMember(null)}
        member={togglingAdminMember}
        adminCount={adminCount}
      />
    </div>
  );
}
