import { useState } from 'react';
import { Users, UserPlus, Key } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS } from '../../types';

export function FamilySetupPage() {
  const { user, refreshAuth } = useAuth();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [familyName, setFamilyName] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState<'parent' | 'child'>('parent');

  const [inviteCode, setInviteCode] = useState('');
  const [joinMemberName, setJoinMemberName] = useState('');

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setIsLoading(true);

    try {
      const { data: inviteCodeResult } = await supabase.rpc('generate_invite_code');
      const generatedCode = inviteCodeResult as string;

      const { data: familyData, error: familyError } = await supabase
        .from('families')
        .insert({
          name: familyName.trim(),
          invite_code: generatedCode,
          created_by: user.id,
        })
        .select()
        .single();

      if (familyError) throw familyError;

      const { error: memberError } = await supabase.from('family_members').insert({
        name: memberName.trim(),
        email: user.email,
        role: memberRole,
        family_id: familyData.id,
        user_id: user.id,
        is_admin: memberRole === 'parent',
        color: COLORS[0],
      });

      if (memberError) throw memberError;

      await refreshAuth();
    } catch (err: unknown) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setIsLoading(true);

    try {
      const { data: familyData, error: familyError } = await supabase
        .from('families')
        .select('*')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .maybeSingle();

      if (familyError) throw familyError;

      if (!familyData) {
        throw new Error('Invalid invite code');
      }

      const { data: existingMembers } = await supabase
        .from('family_members')
        .select('color')
        .eq('family_id', familyData.id);

      const usedColors = new Set(existingMembers?.map(m => m.color) || []);
      const availableColor = COLORS.find(c => !usedColors.has(c)) || COLORS[0];

      const { error: memberError } = await supabase.from('family_members').insert({
        name: joinMemberName.trim(),
        email: user.email,
        role: 'child',
        family_id: familyData.id,
        user_id: user.id,
        is_admin: false,
        color: availableColor,
      });

      if (memberError) throw memberError;

      await refreshAuth();
    } catch (err: unknown) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  if (mode === 'choose') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Family Setup</h1>
            <p className="text-gray-600">Create a new family or join an existing one</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setMode('create')}
              className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-center group"
            >
              <UserPlus className="w-12 h-12 text-gray-400 group-hover:text-blue-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Family</h3>
              <p className="text-sm text-gray-600">Start a new family planboard</p>
            </button>

            <button
              onClick={() => setMode('join')}
              className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-center group"
            >
              <Key className="w-12 h-12 text-gray-400 group-hover:text-blue-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Join Family</h3>
              <p className="text-sm text-gray-600">Enter an invite code</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <UserPlus className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Family</h1>
            <p className="text-gray-600">Set up your family planboard</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateFamily} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Family Name
              </label>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="The Smith Family"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="John Smith"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMemberRole('parent')}
                  className={`px-4 py-2 rounded-lg border-2 transition-all ${
                    memberRole === 'parent'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-medium">Parent</div>
                  <div className="text-xs text-gray-600">Admin access</div>
                </button>
                <button
                  type="button"
                  onClick={() => setMemberRole('child')}
                  className={`px-4 py-2 rounded-lg border-2 transition-all ${
                    memberRole === 'child'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-medium">Child</div>
                  <div className="text-xs text-gray-600">Standard access</div>
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Create Family'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Key className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Join a Family</h1>
          <p className="text-gray-600">Enter the invite code from your family</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleJoinFamily} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Invite Code
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="ABC12345"
              maxLength={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase text-center text-xl font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={joinMemberName}
              onChange={(e) => setJoinMemberName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Joining...' : 'Join Family'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
