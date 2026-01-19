import { useState } from 'react';
import { Copy, Check, Users, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFamily } from '../contexts/FamilyContext';

export function AdminPanel() {
  const { family, isAdmin } = useAuth();
  const { familyMembers } = useFamily();
  const [copied, setCopied] = useState(false);

  if (!isAdmin || !family) return null;

  const inviteLink = `${window.location.origin}/join/${family.invite_code}`;

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-purple-500" />
        <h2 className="text-xl font-bold text-gray-900">Admin Panel</h2>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Invite Code</h3>
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
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Link
                </>
              )}
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-700">
              Family Members ({familyMembers.length})
            </h3>
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
                      Admin
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-semibold">{member.total_points}</span> points
                  <span className="mx-2">|</span>
                  Level <span className="font-semibold">{member.current_level}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
