import * as SecureStore from 'expo-secure-store';

export const TOKEN_SSO_KEY = 'token_sso';

export async function getTokenSso(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_SSO_KEY);
  } catch {
    return null;
  }
}

export async function setTokenSso(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_SSO_KEY, token);
}

export async function clearTokenSso(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_SSO_KEY);
  } catch {
    // ignore
  }
}
