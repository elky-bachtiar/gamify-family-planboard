import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Users, Shield, DollarSign, UserPlus, Link, CheckCircle2, Pencil, Trash2, Crown, Package } from 'lucide-react';
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
import { ObjectsManager } from './Admin/ObjectsManager';
import type { FamilyMember } from '../types';

export function AdminPanel() {
  const { t } = useTranslation(['admin', 'common']);
  const { family, isAdmin, refreshAuth } = useAuth();
  const { familyMembers } = useFamily();
  const [copied, setCopied] = useState(false);
  const [copiedParent, setCopiedParent] = useState(false);
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null);
  const [isCreateChildOpen, setIsCreateChildOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'approvals' | 'rewards' | 'objects'>('members');
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
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-0 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-purple-100 rounded-xl">
            <Shield className="w-5 h-5 text-purple-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{t('admin:panel.title')}</h2>
        </div>

        {/* Tab Navigation - Below Title */}
        <div className="flex gap-1 border-b border-gray-200 -mx-5 px-5">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === 'members'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="w-4 h-4" />
            {t('admin:panel.tabs.members')}
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === 'approvals'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {t('admin:panel.tabs.approvals')}
          </button>
          <button
            onClick={() => setActiveTab('rewards')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === 'rewards'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            {t('admin:panel.tabs.rewards')}
          </button>
          <button
            onClick={() => setActiveTab('objects')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === 'objects'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Package className="w-4 h-4" />
            {t('admin:panel.tabs.objects')}
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'members' && (
          <div className="space-y-6">
            {/* Invite Codes Section */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Regular Invite Code Card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-800">{t('admin:inviteCode.title')}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">{t('admin:inviteCode.description')}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-4 py-2.5 bg-white rounded-lg text-sm font-mono text-gray-800 border border-blue-200 shadow-sm">
                    {family.invite_code}
                  </code>
                  <button
                    onClick={handleCopyInvite}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm ${
                      copied
                        ? 'bg-green-500 text-white'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
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

              {/* Parent Invite Code Card */}
              {parentInviteLink && (
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-5 border border-amber-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-amber-100 rounded-lg">
                      <Crown className="w-4 h-4 text-amber-600" />
                    </div>
                    <h3 className="font-semibold text-gray-800">{t('admin:parentInviteCode.title')}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">{t('admin:parentInviteCode.description')}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-4 py-2.5 bg-white rounded-lg text-sm font-mono text-gray-800 border border-amber-200 shadow-sm">
                      {family.parent_invite_code}
                    </code>
                    <button
                      onClick={handleCopyParentInvite}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm ${
                        copiedParent
                          ? 'bg-green-500 text-white'
                          : 'bg-amber-500 text-white hover:bg-amber-600'
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

            {/* Family Members Section */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-purple-100 rounded-lg">
                    <Users className="w-4 h-4 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-gray-800">
                    {t('admin:members.count', { count: familyMembers.length })}
                  </h3>
                </div>
                <button
                  onClick={() => setIsCreateChildOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all shadow-sm text-sm font-medium"
                >
                  <UserPlus className="w-4 h-4" />
                  {t('admin:members.addChild')}
                </button>
              </div>
              <div className="space-y-3">
                {familyMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{member.name}</span>
                          {member.is_admin && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              <Crown className="w-3 h-3" />
                              {t('admin:members.admin')}
                            </span>
                          )}
                          {member.is_pin_user && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              PIN
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                          <span><span className="font-medium text-gray-700">{member.total_points}</span> {t('common:labels.points')}</span>
                          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                          <span>{t('common:labels.level')} <span className="font-medium text-gray-700">{member.current_level}</span></span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.is_pin_user && member.child_invite_code && (
                        <button
                          onClick={() => handleCopyPinLink(member.id, member.child_invite_code!)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            copiedMemberId === member.id
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {copiedMemberId === member.id ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              {t('common:buttons.copied')}
                            </>
                          ) : (
                            <>
                              <Link className="w-3.5 h-3.5" />
                              {t('common:buttons.copyLink')}
                            </>
                          )}
                        </button>
                      )}
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => setTogglingAdminMember(member)}
                          className={`p-2 rounded-lg transition-all ${
                            member.is_admin
                              ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                              : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
                          }`}
                          title={member.is_admin ? t('admin:members.demoteAdmin') : t('admin:members.promoteAdmin')}
                        >
                          <Crown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingMember(member)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title={t('admin:members.editMember')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {!member.is_admin && (
                          <button
                            onClick={() => setDeletingMember(member)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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

            {/* Palette Selector Section */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <PaletteSelector />
            </div>

            {/* Manual Points Section */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <ManualPointsManager />
            </div>
          </div>
        )}

        {activeTab === 'approvals' && (
          <TaskApprovalManager />
        )}

        {activeTab === 'rewards' && (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <RewardSettings onSave={refreshAuth} />
            </div>
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <RedemptionManager />
            </div>
          </div>
        )}

        {activeTab === 'objects' && (
          <ObjectsManager />
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
