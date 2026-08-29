import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { apiLogoutUsuarioLogado, apiValidateTokenSso } from './AuthApi';
import { prepareDataUser, type UserLogado } from './AuthUtils';
import { clearTokenSso, getTokenSso } from './tokenStorage';
import { setUnauthorizedHandler } from './unauthorizedSession';

export type AuthData = {
  userLogado: UserLogado;
  isAuthenticated: boolean;
  verificandoToken: boolean;
  deslogando: boolean;
  deslogar: boolean;
  redirectLogin: boolean;
  bootstrapped: boolean;
  authError: string | null;
  sessionExpired: boolean;
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
  sessionExpired: false,
};

type AuthContextValue = {
  authData: AuthData;
  setAuthData: React.Dispatch<React.SetStateAction<AuthData>>;
  bootstrapSession: () => Promise<void>;
  /** Valida o token no SSO e marca sessão autenticada somente se o validate for OK. */
  acceptSsoToken: (token: string) => Promise<boolean>;
  validateSession: (token?: string) => Promise<boolean>;
  requestLogout: () => void;
  performLogout: () => Promise<void>;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

class InvalidSsoSessionError extends Error {
  constructor() {
    super('INVALID_SSO_SESSION');
    this.name = 'InvalidSsoSessionError';
  }
}

/**
 * Valida o token no SSO. Só autentica se o validate retornar OK com JSON do usuário.
 */
async function resolveUserFromToken(token: string): Promise<UserLogado> {
  const response = await apiValidateTokenSso(token);
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !contentType.includes('application/json')) {
    throw new InvalidSsoSessionError();
  }

  try {
    return prepareDataUser({ ...(await response.json()), token });
  } catch {
    throw new InvalidSsoSessionError();
  }
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
        sessionExpired: false,
        authError: null,
      }));
      return true;
    } catch (error) {
      await clearTokenSso();
      const silent = error instanceof InvalidSsoSessionError;
      setAuthData({
        ...initialAuthData,
        bootstrapped: true,
        authError: silent
          ? null
          : error instanceof Error
            ? error.message
            : 'Falha ao validar token SSO',
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

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuthData((prev) =>
        prev.sessionExpired || prev.deslogar || prev.deslogando
          ? prev
          : { ...prev, sessionExpired: true }
      );
    });
    return () => setUnauthorizedHandler(null);
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
