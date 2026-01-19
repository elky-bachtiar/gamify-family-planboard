import { Trophy, Star, Flame } from 'lucide-react';
import { useFamily } from '../contexts/FamilyContext';
import { getPointsForNextLevel } from '../types';

export function Header() {
  const { currentMember, familyMembers, setCurrentMember } = useFamily();

  if (!currentMember) return null;

  const levelProgress = getPointsForNextLevel(currentMember.total_points);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">Family Planboard</h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-amber-50 px-3 py-2 rounded-lg">
                <Star className="w-5 h-5 text-amber-500" fill="currentColor" />
                <span className="font-semibold text-gray-900">{currentMember.total_points}</span>
              </div>

              <div className="flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-lg">
                <Trophy className="w-5 h-5 text-purple-500" />
                <span className="font-semibold text-gray-900">Level {currentMember.current_level}</span>
              </div>

              {currentMember.current_streak > 0 && (
                <div className="flex items-center gap-2 bg-orange-50 px-3 py-2 rounded-lg">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className="font-semibold text-gray-900">{currentMember.current_streak} days</span>
                </div>
              )}
            </div>

            <select
              value={currentMember.id}
              onChange={(e) => {
                const member = familyMembers.find(m => m.id === e.target.value);
                if (member) setCurrentMember(member);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ borderLeftWidth: '4px', borderLeftColor: currentMember.color }}
            >
              {familyMembers.map(member => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
            <span>Progress to Level {currentMember.current_level + 1}</span>
            <span>{Math.round(levelProgress.progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${levelProgress.progress}%`,
                backgroundColor: currentMember.color,
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
