import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { getSsoRedirectUri, getUrlLogin } from './AuthApi';
import { setTokenSso } from './tokenStorage';

WebBrowser.maybeCompleteAuthSession();

/** Extrai access_token de query ou hash (mesmo padrão do agenda). */
export function extractAccessToken(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    const fromQuery = parsed.queryParams?.access_token;
    if (typeof fromQuery === 'string' && fromQuery.length > 0) {
      return fromQuery;
    }
    if (Array.isArray(fromQuery) && typeof fromQuery[0] === 'string') {
      return fromQuery[0];
    }
  } catch {
    // fallback abaixo
  }

  const match = url.match(/[#?&]access_token=([^&#]+)/i);
  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }
  return null;
}

export type SsoLoginResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'cancelled' | 'dismissed' | 'no_token' | 'error'; message?: string };

/**
 * Abre o SSO e captura só o access_token.
 * Redirect = localhost (DESV do agenda) para o browser fechar e voltar ao app,
 * sem abrir o sistema web do agendaac4.
 */
export async function loginWithSso(): Promise<SsoLoginResult> {
  const redirectUri = getSsoRedirectUri();
  const loginUrl = getUrlLogin(redirectUri);

  try {
    const result = await WebBrowser.openAuthSessionAsync(loginUrl, redirectUri, {
      preferEphemeralSession: true,
      createTask: false,
    });

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { ok: false, reason: result.type === 'cancel' ? 'cancelled' : 'dismissed' };
    }

    if (result.type !== 'success' || !('url' in result) || !result.url) {
      return { ok: false, reason: 'error', message: 'Resposta inesperada do SSO' };
    }

    const token = extractAccessToken(result.url);
    if (!token) {
      return {
        ok: false,
        reason: 'no_token',
        message: 'Token não encontrado na URL de retorno do SSO',
      };
    }

    await setTokenSso(token);
    return { ok: true, token };
  } catch (error) {
    return {
      ok: false,
      reason: 'error',
      message: error instanceof Error ? error.message : 'Falha ao abrir SSO',
    };
  }
}
