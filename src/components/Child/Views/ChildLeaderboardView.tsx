import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Medal, Crown, Flame } from 'lucide-react';
import { getSupabaseClient } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useFamily } from '../../../contexts/FamilyContext';
import type { FamilyMember } from '../../../types';

export function ChildLeaderboardView() {
  const { t } = useTranslation('gamification');
  const { family } = useAuth();
  const { currentMember } = useFamily();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (family) {
      loadMembers();

      const supabase = getSupabaseClient();
      const subscription = supabase
        .channel('child_leaderboard_changes')
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

    setIsLoading(true);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('family_members')
      .select('*')
      .eq('family_id', family.id)
      .order('total_points', { ascending: false });

    if (!error && data) {
      setMembers(data);
    }
    setIsLoading(false);
  };

  const getRankDisplay = (index: number) => {
    if (index === 0) {
      return (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg">
          <Crown className="w-5 h-5 text-white" />
        </div>
      );
    }
    if (index === 1) {
      return (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center shadow-md">
          <Medal className="w-5 h-5 text-white" />
        </div>
      );
    }
    if (index === 2) {
      return (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center shadow-md">
          <Medal className="w-5 h-5 text-white" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
        <span className="text-lg font-bold text-gray-500">{index + 1}</span>
      </div>
    );
  };

  const getCardStyle = (index: number, memberId: string) => {
    const isMe = memberId === currentMember?.id;

    if (index === 0) {
      return `bg-gradient-to-r from-yellow-50 to-amber-50 border-2 ${isMe ? 'border-yellow-400' : 'border-yellow-200'}`;
    }
    if (index === 1) {
      return `bg-gradient-to-r from-gray-50 to-slate-50 border-2 ${isMe ? 'border-gray-400' : 'border-gray-200'}`;
    }
    if (index === 2) {
      return `bg-gradient-to-r from-amber-50 to-orange-50 border-2 ${isMe ? 'border-amber-400' : 'border-amber-200'}`;
    }
    return `bg-white border-2 ${isMe ? 'border-blue-400' : 'border-gray-100'}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg">
          <Trophy className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{t('leaderboard.title')}</h1>
      </div>

      {/* Leaderboard list */}
      <div className="space-y-3">
        {members.map((member, index) => {
          const isMe = member.id === currentMember?.id;

          return (
            <div
              key={member.id}
              className={`${getCardStyle(index, member.id)} rounded-xl p-4 transition-all ${
                isMe ? 'shadow-md scale-[1.02]' : ''
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Rank */}
                {getRankDisplay(index)}

                {/* Avatar */}
                {member.avatar_url ? (
                  <img
                    src={member.avatar_url}
                    alt={member.name}
                    className={`w-14 h-14 rounded-full object-cover border-2 ${
                      isMe ? 'border-blue-400' : 'border-white'
                    } shadow-sm`}
                  />
                ) : (
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl border-2 ${
                      isMe ? 'border-blue-400' : 'border-white'
                    } shadow-sm`}
                    style={{ backgroundColor: member.color ?? '#3b82f6' }}
                  >
                    {member.name[0].toUpperCase()}
                  </div>
                )}

                {/* Name and level */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold text-gray-900 truncate ${isMe ? 'text-blue-600' : ''}`}
                    >
                      {member.name}
                      {isMe && (
                        <span className="ml-1 text-xs text-blue-500">
                          ({t('child.leaderboard.you')})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {t('level.current', { level: member.current_level })}
                  </div>
                </div>

                {/* Points and streak */}
                <div className="text-right flex-shrink-0">
                  <div
                    className={`text-xl font-bold ${index === 0 ? 'text-amber-600' : 'text-gray-900'}`}
                  >
                    {member.total_points?.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">{t('points.total')}</div>

                  {/* Streak badge */}
                  {(member.current_streak ?? 0) > 0 && (
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <Flame className="w-4 h-4 text-orange-500" fill="currentColor" />
                      <span className="text-sm font-semibold text-orange-500">
                        {member.current_streak}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {members.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('leaderboard.noMembers')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
