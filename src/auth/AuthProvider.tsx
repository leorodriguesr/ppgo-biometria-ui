import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { apiLogoutUsuarioLogado, apiValidateTokenSso } from './AuthApi';
import { prepareDataUser, type UserLogado } from './AuthUtils';
import { clearTokenSso, getTokenSso } from './tokenStorage';

export type AuthData = {
  userLogado: UserLogado;
  isAuthenticated: boolean;
  verificandoToken: boolean;
  deslogando: boolean;
  deslogar: boolean;
  redirectLogin: boolean;
  bootstrapped: boolean;
  authError: string | null;
};

const initialAuthData: AuthData = {
  userLogado: {},
  isAuthenticated: false,
  verificandoToken: false,
  deslogando: false,
  deslogar: false,
  redirectLogin: false,
  bootstrapped: false,
  authError: null,
};

type AuthContextValue = {
  authData: AuthData;
  setAuthData: React.Dispatch<React.SetStateAction<AuthData>>;
  bootstrapSession: () => Promise<void>;
  /** Persiste o token e marca sessão autenticada (sem entrar no sistema agenda). */
  acceptSsoToken: (token: string) => Promise<boolean>;
  validateSession: (token?: string) => Promise<boolean>;
  requestLogout: () => void;
  performLogout: () => Promise<void>;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Valida o token no SSO (opcional). Se validate falhar mas o token existir,
 * ainda autentica — o objetivo é só guardar o access_token para as APIs.
 */
async function resolveUserFromToken(token: string): Promise<UserLogado> {
  try {
    const response = await apiValidateTokenSso(token);
    if (response.ok) {
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        return prepareDataUser({ ...(await response.json()), token });
      }
    }
  } catch {
    // ignore — token ainda é útil para as APIs
  }
  return prepareDataUser({ token });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authData, setAuthData] = useState<AuthData>(initialAuthData);

  const clearAuthError = useCallback(() => {
    setAuthData((prev) => ({ ...prev, authError: null }));
  }, []);

  const acceptSsoToken = useCallback(async (token: string) => {
    setAuthData((prev) => ({
      ...prev,
      verificandoToken: true,
      authError: null,
    }));

    try {
      const userLogado = await resolveUserFromToken(token);
      setAuthData((prev) => ({
        ...prev,
        userLogado,
        isAuthenticated: true,
        verificandoToken: false,
        bootstrapped: true,
        deslogar: false,
        redirectLogin: false,
        authError: null,
      }));
      return true;
    } catch (error) {
      setAuthData({
        ...initialAuthData,
        bootstrapped: true,
        authError: error instanceof Error ? error.message : 'Falha ao salvar token SSO',
      });
      return false;
    }
  }, []);

  const validateSession = useCallback(
    async (tokenArg?: string) => {
      const token = tokenArg ?? (await getTokenSso());
      if (!token) {
        setAuthData((prev) => ({
          ...prev,
          isAuthenticated: false,
          verificandoToken: false,
          bootstrapped: true,
          userLogado: {},
        }));
        return false;
      }
      return acceptSsoToken(token);
    },
    [acceptSsoToken]
  );

  const bootstrapSession = useCallback(async () => {
    const token = await getTokenSso();
    if (!token) {
      setAuthData((prev) => ({ ...prev, bootstrapped: true, isAuthenticated: false }));
      return;
    }
    await acceptSsoToken(token);
  }, [acceptSsoToken]);

  const requestLogout = useCallback(() => {
    setAuthData((prev) => ({ ...prev, deslogar: true }));
  }, []);

  const performLogout = useCallback(async () => {
    setAuthData((prev) => ({ ...prev, deslogando: true }));
    try {
      await apiLogoutUsuarioLogado();
    } catch {
      await clearTokenSso();
    } finally {
      setAuthData({
        ...initialAuthData,
        bootstrapped: true,
        redirectLogin: true,
      });
    }
  }, []);

  const value = useMemo(
    () => ({
      authData,
      setAuthData,
      bootstrapSession,
      acceptSsoToken,
      validateSession,
      requestLogout,
      performLogout,
      clearAuthError,
    }),
    [
      authData,
      bootstrapSession,
      acceptSsoToken,
      validateSession,
      requestLogout,
      performLogout,
      clearAuthError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return ctx;
}
