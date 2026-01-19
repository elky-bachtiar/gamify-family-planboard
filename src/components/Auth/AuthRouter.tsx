import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { FamilySetupPage } from './FamilySetupPage';
import { ChildPinLogin } from './ChildPinLogin';
import type { FamilyMember, Family } from '../../types';

function getChildLoginCode(): string | null {
  const path = window.location.pathname;
  const match = path.match(/^\/child-login\/([A-Za-z0-9]+)$/);
  return match ? match[1] : null;
}

export function AuthRouter() {
  const { user, familyMember, isLoading, isPinUser, signInWithPin } = useAuth();
  const [showLogin, setShowLogin] = useState(true);
  const [childLoginCode, setChildLoginCode] = useState<string | null>(null);

  useEffect(() => {
    const code = getChildLoginCode();
    setChildLoginCode(code);

    // Listen for URL changes
    const handlePopState = () => {
      setChildLoginCode(getChildLoginCode());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Handle child PIN login route
  if (childLoginCode && !isPinUser && !familyMember) {
    return (
      <ChildPinLogin
        inviteCode={childLoginCode}
        onLogin={async (data) => {
          await signInWithPin({
            token: data.token,
            member: data.member as FamilyMember,
            family: data.family as Family | null,
          });
          // Clear the URL to go to dashboard
          window.history.pushState({}, '', '/');
          setChildLoginCode(null);
        }}
        onBack={() => {
          window.history.pushState({}, '', '/');
          setChildLoginCode(null);
        }}
      />
    );
  }

  // PIN user is logged in - they have familyMember set, don't show auth
  if (isPinUser && familyMember) {
    return null;
  }

  // Regular auth flow
  if (!user) {
    return showLogin ? (
      <LoginPage onSwitchToRegister={() => setShowLogin(false)} />
    ) : (
      <RegisterPage onSwitchToLogin={() => setShowLogin(true)} />
    );
  }

  if (!familyMember) {
    return <FamilySetupPage />;
  }

  return null;
}
