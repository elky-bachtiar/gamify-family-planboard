import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, setPinAuthToken } from '../lib/supabase';
import type { FamilyMember, Family } from '../types';

const PIN_SESSION_KEY = 'pin_session';

interface PinSession {
  token: string;
  member: FamilyMember;
  family: Family | null;
}

interface AuthContextType {
  user: User | null;
  familyMember: FamilyMember | null;
  family: Family | null;
  isLoading: boolean;
  isAdmin: boolean;
  isPinUser: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithPin: (data: { token: string; member: FamilyMember; family: Family | null }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [familyMember, setFamilyMember] = useState<FamilyMember | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPinUser, setIsPinUser] = useState(false);

  const loadUserData = async (currentUser: User | null) => {
    if (!currentUser) {
      setFamilyMember(null);
      setFamily(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data: memberData, error: memberError } = await supabase
        .from('family_members')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (memberError) throw memberError;

      setFamilyMember(memberData);

      if (memberData?.family_id) {
        const { data: familyData, error: familyError } = await supabase
          .from('families')
          .select('*')
          .eq('id', memberData.family_id)
          .single();

        if (familyError) throw familyError;
        setFamily(familyData);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPinSession = (): boolean => {
    try {
      const stored = localStorage.getItem(PIN_SESSION_KEY);
      if (stored) {
        const session: PinSession = JSON.parse(stored);

        // Set up authenticated Supabase client for PIN users
        console.log('[PIN Auth] Restoring PIN session from localStorage');
        setPinAuthToken(session.token);

        setFamilyMember(session.member);
        setFamily(session.family);
        setIsPinUser(true);
        setIsLoading(false);
        return true;
      }
    } catch (error) {
      console.error('Error loading PIN session:', error);
      localStorage.removeItem(PIN_SESSION_KEY);
    }
    return false;
  };

  const refreshPinMemberData = async (memberId: string) => {
    try {
      const { data: memberData, error: memberError } = await supabase
        .from('family_members')
        .select('*')
        .eq('id', memberId)
        .single();

      if (memberError) throw memberError;

      if (memberData?.family_id) {
        const { data: familyData, error: familyError } = await supabase
          .from('families')
          .select('*')
          .eq('id', memberData.family_id)
          .single();

        if (familyError) throw familyError;

        // Update stored session
        const stored = localStorage.getItem(PIN_SESSION_KEY);
        if (stored) {
          const session: PinSession = JSON.parse(stored);
          session.member = memberData;
          session.family = familyData;
          localStorage.setItem(PIN_SESSION_KEY, JSON.stringify(session));
        }

        setFamilyMember(memberData);
        setFamily(familyData);
      }
    } catch (error) {
      console.error('Error refreshing PIN member data:', error);
    }
  };

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const initAuth = async () => {
      // First check for PIN session
      const hasPinSession = loadPinSession();
      if (hasPinSession) {
        return;
      }

      // Otherwise check for Supabase auth
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      await loadUserData(session?.user ?? null);

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        // Ignore auth state changes if we're using PIN session
        if (isPinUser) return;

        setUser(session?.user ?? null);
        loadUserData(session?.user ?? null);
      });

      subscription = data.subscription;
    };

    initAuth();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const refreshAuth = async () => {
    setIsLoading(true);
    if (isPinUser && familyMember) {
      await refreshPinMemberData(familyMember.id);
      setIsLoading(false);
    } else {
      await loadUserData(user);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithPin = async (data: { token: string; member: FamilyMember; family: Family | null }) => {
    const session: PinSession = {
      token: data.token,
      member: data.member,
      family: data.family,
    };
    localStorage.setItem(PIN_SESSION_KEY, JSON.stringify(session));

    // Set up authenticated Supabase client for PIN users
    // This creates a new client with the Authorization header set
    console.log('[PIN Auth] Setting up authenticated Supabase client');
    setPinAuthToken(data.token);

    setFamilyMember(data.member);
    setFamily(data.family);
    setIsPinUser(true);
    setUser(null);
  };

  const signOut = async () => {
    if (isPinUser) {
      localStorage.removeItem(PIN_SESSION_KEY);
      setPinAuthToken(null);
      setFamilyMember(null);
      setFamily(null);
      setIsPinUser(false);
    } else {
      await supabase.auth.signOut();
    }
  };

  const isAdmin = familyMember?.is_admin ?? false;

  return (
    <AuthContext.Provider
      value={{
        user,
        familyMember,
        family,
        isLoading,
        isAdmin,
        isPinUser,
        signIn,
        signUp,
        signInWithPin,
        signOut,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
