import React from 'react';
import type { UseAuthState } from '../hooks/useAuthState';
import { AuthView } from './AuthView';

type AuthGateProps = {
  auth: UseAuthState;
  children: React.ReactNode;
};

export const AuthGate: React.FC<AuthGateProps> = ({ auth, children }) => {
  if (!auth.configured) return <>{children}</>;

  if (auth.loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#090d16]">
        <div className="w-8 h-8 border-2 border-emerald-500/40 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (auth.isRecovery) {
    return <AuthView auth={auth} />;
  }

  if (auth.status === 'signedIn') return <>{children}</>;

  return <AuthView auth={auth} />;
};
