import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Where the login token is kept so a refresh or app restart doesn't log the user out.
// - Phone, "Remember me" on:  the device's encrypted secure storage (Keychain / Keystore).
// - Phone, "Remember me" off: memory only, so closing the app logs out.
// - Web,   "Remember me" on:  localStorage (kept until logout; the token itself expires after 7 days).
// - Web,   "Remember me" off: sessionStorage (cleared when the browser tab closes).
// Only the token is stored; the user's details are fetched fresh from /me on start-up.
const KEY = 'agriskills.session.token';

function webStores() {
  try {
    return typeof window !== 'undefined' ? { local: window.localStorage, session: window.sessionStorage } : null;
  } catch {
    return null; // Storage can be blocked (private mode, strict settings).
  }
}

export async function saveToken(token: string, remember: boolean) {
  await clearToken();
  if (Platform.OS === 'web') {
    try {
      const stores = webStores();
      (remember ? stores?.local : stores?.session)?.setItem(KEY, token);
    } catch {
      // Ignore: the user simply stays logged in for this page only.
    }
    return;
  }
  if (remember) await SecureStore.setItemAsync(KEY, token).catch(() => undefined);
}

export async function loadToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      const stores = webStores();
      return stores?.session.getItem(KEY) ?? stores?.local.getItem(KEY) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(KEY).catch(() => null);
}

export async function clearToken() {
  if (Platform.OS === 'web') {
    try {
      const stores = webStores();
      stores?.local.removeItem(KEY);
      stores?.session.removeItem(KEY);
    } catch {
      // Nothing stored.
    }
    return;
  }
  await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
}
