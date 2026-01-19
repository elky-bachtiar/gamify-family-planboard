import { useState } from 'react';
import { Users, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { COLORS } from '../types';

interface WelcomeScreenProps {
  onComplete: () => void;
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [members, setMembers] = useState<Array<{ name: string; role: 'parent' | 'child'; color: string }>>([]);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'parent' | 'child'>('child');
  const [isCreating, setIsCreating] = useState(false);

  const addMember = () => {
    if (newName.trim()) {
      setMembers([...members, {
        name: newName.trim(),
        role: newRole,
        color: COLORS[members.length % COLORS.length],
      }]);
      setNewName('');
    }
  };

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const createFamily = async () => {
    if (members.length === 0) return;

    setIsCreating(true);
    try {
      for (const member of members) {
        await supabase.from('family_members').insert({
          name: member.name,
          role: member.role,
          color: member.color,
        });
      }
      onComplete();
    } catch (error) {
      console.error('Error creating family members:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Users className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Family Planboard!</h1>
          <p className="text-gray-600">
            Create your family members to get started with gamified task management
          </p>
        </div>

        <div className="mb-6">
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addMember()}
              placeholder="Enter family member name"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'parent' | 'child')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="child">Child</option>
              <option value="parent">Parent</option>
            </select>
            <button
              onClick={addMember}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {members.length > 0 && (
            <div className="space-y-2 mb-6">
              {members.map((member, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border-l-4"
                  style={{ borderLeftColor: member.color }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                      style={{ backgroundColor: member.color }}
                    >
                      {member.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{member.name}</div>
                      <div className="text-sm text-gray-500 capitalize">{member.role}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeMember(index)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={createFamily}
          disabled={members.length === 0 || isCreating}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isCreating ? 'Creating...' : `Create Family (${members.length} member${members.length !== 1 ? 's' : ''})`}
        </button>
      </div>
    </div>
  );
}
