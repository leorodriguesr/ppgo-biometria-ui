import * as SecureStore from 'expo-secure-store';

import { getTokenSso } from '@/src/auth/tokenStorage';
import { ambiente } from '@/src/configs/urlsConfig';

const GOIASPEN_KEY = 'token_prod_goiaspen';
const LEGACY_BIOMETRIA_KEY = 'token_prod_biometria';

async function readKey(key: string): Promise<string> {
  try {
    return (await SecureStore.getItemAsync(key)) ?? '';
  } catch {
    return '';
  }
}

async function writeKey(key: string, value: string): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
    return;
  }
  await SecureStore.setItemAsync(key, trimmed);
}

export async function getProdGoiaspenToken(): Promise<string> {
  return readKey(GOIASPEN_KEY);
}

export async function setProdGoiaspenToken(token: string): Promise<void> {
  await writeKey(GOIASPEN_KEY, token);
  try {
    await SecureStore.deleteItemAsync(LEGACY_BIOMETRIA_KEY);
  } catch {
    // ignore
  }
}

/**
 * Token do GoiásPen de produção, usado só na comparação da identificação por imagem.
 * Em produção, reaproveita a sessão logada. Em homologação, exige o token salvo.
 */
export async function resolveProdGoiaspenToken(): Promise<string | null> {
  if (ambiente === 'PROD') {
    const token = (await getTokenSso())?.trim() ?? '';
    return token || null;
  }
  const saved = (await getProdGoiaspenToken()).trim();
  return saved || null;
}
