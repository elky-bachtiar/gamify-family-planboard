import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { FamilyMember } from '../types';

interface FamilyContextType {
  currentMember: FamilyMember | null;
  familyMembers: FamilyMember[];
  setCurrentMember: (member: FamilyMember | null) => void;
  refreshMembers: () => Promise<void>;
  isLoading: boolean;
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { familyMember, family } = useAuth();
  const [currentMember, setCurrentMember] = useState<FamilyMember | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshMembers = async () => {
    if (!family?.id) {
      setFamilyMembers([]);
      setCurrentMember(null);
      setIsLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('family_id', family.id)
        .order('created_at');

      console.log('[FamilyContext] Family members query:', { data, error, family_id: family.id });

      if (error) throw error;
      setFamilyMembers(data || []);

      // Update currentMember from fresh data, not stale familyMember
      if (familyMember && data) {
        const updatedMember = data.find((m) => m.id === familyMember.id);
        if (updatedMember) {
          setCurrentMember(updatedMember);
        } else {
          setCurrentMember(familyMember);
        }
      }
    } catch (error) {
      console.error('Error fetching family members:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshMembers();

    if (!family?.id) return;

    const supabase = getSupabaseClient();
    const subscription = supabase
      .channel('family_members_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_members' }, () => {
        refreshMembers();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [family?.id, familyMember]);

  return (
    <FamilyContext.Provider
      value={{
        currentMember,
        familyMembers,
        setCurrentMember,
        refreshMembers,
        isLoading,
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const context = useContext(FamilyContext);
  if (context === undefined) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }
  return context;
}
