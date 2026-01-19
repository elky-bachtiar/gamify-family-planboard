import { useState, useEffect } from 'react';
import { Trophy, Medal, Crown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { FamilyMember } from '../types';

export function Leaderboard() {
  const { family } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);

  useEffect(() => {
    if (family) {
      loadMembers();

      const subscription = supabase
        .channel('leaderboard_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'family_members' }, () => {
          loadMembers();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [family]);

  const loadMembers = async () => {
    if (!family) return;

    const { data, error } = await supabase
      .from('family_members')
      .select('*')
      .eq('family_id', family.id)
      .order('total_points', { ascending: false });

    if (!error && data) {
      setMembers(data);
    }
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="w-6 h-6 text-yellow-500" />;
    if (index === 1) return <Medal className="w-6 h-6 text-gray-400" />;
    if (index === 2) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="text-lg font-bold text-gray-400">#{index + 1}</span>;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-6">
        <Trophy className="w-6 h-6 text-yellow-500" />
        <h2 className="text-xl font-bold text-gray-900">Family Leaderboard</h2>
      </div>

      <div className="space-y-3">
        {members.map((member, index) => (
          <div
            key={member.id}
            className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
              index === 0
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center justify-center w-10">
              {getRankIcon(index)}
            </div>

            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: member.color }}
            >
              {member.name[0].toUpperCase()}
            </div>

            <div className="flex-1">
              <div className="font-semibold text-gray-900">{member.name}</div>
              <div className="text-sm text-gray-600">
                Level {member.current_level} • {member.total_points} points
              </div>
            </div>

            {member.current_streak > 0 && (
              <div className="text-right">
                <div className="text-2xl font-bold text-orange-500">{member.current_streak}</div>
                <div className="text-xs text-gray-500">day streak</div>
              </div>
            )}
          </div>
        ))}

        {members.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No family members yet
          </div>
        )}
      </div>
    </div>
  );
}
