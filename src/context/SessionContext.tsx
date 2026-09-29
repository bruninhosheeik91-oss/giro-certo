import React, { createContext, useContext } from 'react';
import { AuthGate } from '../components/AuthGate';
import { useAuthState, type UseAuthState } from '../hooks/useAuthState';

export type SessionContextValue = Pick<
  UseAuthState,
  'configured' | 'loading' | 'session' | 'userId' | 'email' | 'mode' | 'signOut'
>;

const SessionContext = createContext<SessionContextValue | null>(null);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthState();
  const value: SessionContextValue = {
    configured: auth.configured,
    loading: auth.loading,
    session: auth.session,
    userId: auth.userId,
    email: auth.email,
    mode: auth.mode,
    signOut: auth.signOut,
  };

  return (
    <SessionContext.Provider value={value}>
      <AuthGate auth={auth}>{children}</AuthGate>
    </SessionContext.Provider>
  );
};

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
