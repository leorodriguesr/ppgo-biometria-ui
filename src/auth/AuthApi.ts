import { sistemaNameSSO } from '@/src/configs/sistemaConfig';
import { SSO_REDIRECT_URI, urlsServices } from '@/src/configs/urlsConfig';

import { clearTokenSso, getTokenSso } from './tokenStorage';

const ssoBase = urlsServices.SSOWS;

/** Redirect cadastrado no SSO do agenda (localhost DESV) — só para capturar o token. */
export function getSsoRedirectUri(): string {
  return SSO_REDIRECT_URI;
}

/** URL de autenticação SSO (mesmo fluxo token_only do agenda). */
export function getUrlLogin(redirectUri = getSsoRedirectUri()): string {
  const params = new URLSearchParams({
    response_type: 'token_only',
    client_id: sistemaNameSSO,
    redirect_uri: redirectUri,
  });
  return `${ssoBase}auth?${params.toString()}`;
}

export async function apiValidateTokenSso(token?: string | null): Promise<Response> {
  const t = token ?? (await getTokenSso());
  if (!t) {
    throw new Error('Token SSO ausente');
  }
  return fetch(`${ssoBase}validate?token=${encodeURIComponent(t)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
}

export async function apiLogoutUsuarioLogado(): Promise<void> {
  const token = await getTokenSso();
  if (!token) return;
  try {
    await fetch(`${ssoBase}logout?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } finally {
    await clearTokenSso();
  }
}

/** Headers de autenticação para Java / Python. */
export async function getAuthHeaders(
  extra: Record<string, string> = {}
): Promise<Record<string, string>> {
  const token = await getTokenSso();
  if (!token) {
    return { ...extra };
  }
  return {
    ...extra,
    Authorization: `Bearer ${token}`,
    // Compatível com interceptor do agenda (headers.token)
    token,
  };
}
