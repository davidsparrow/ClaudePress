import { createContext, useContext, type ReactNode } from 'react';

export type AuthRole = 'admin' | 'client';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member';
}

export interface AuthWorkspace {
  id: string;
  name: string;
  planTier: 'free' | 'pro' | 'agency';
}

export interface AuthState {
  role: AuthRole;
  user?: AuthUser;
  workspace?: AuthWorkspace;
  siteId?: string;
  /** True when the session was issued by GET /api/demo/session (DEMO_MODE=1). */
  isDemo?: boolean;
}

const AuthContext = createContext<AuthState>({ role: 'admin' });

export function AuthProvider({ value, children }: { value: AuthState; children: ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
