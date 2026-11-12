import AsyncStorage from '@react-native-async-storage/async-storage';

// Offline copy of the learner's passport, so it opens without signal.
// Only non-sensitive summary fields are kept (no email address, signature or login details).
// It is saved per user and deleted on logout. Stored in AsyncStorage (localStorage on the web).

export type CachedCredential = {
  id: string;
  title: string;
  category: string;
  status: string;
  publicId: string;
  issueDate: string;
  expiryDate?: string | null;
  skills: string[];
  issuer?: { name: string };
};

export type CachedUser = { id: string; name: string; role: 'LEARNER' | 'ISSUER' | 'EMPLOYER' | 'ADMIN' };

type CachedPassport = { savedAt: string; credentials: CachedCredential[] };

const PASSPORT_KEY = (userId: string) => `agriskills.passport.${userId}`;
const USER_KEY = 'agriskills.offline-user';

export function toCachedCredential(credential: CachedCredential): CachedCredential {
  return {
    id: credential.id,
    title: credential.title,
    category: credential.category,
    status: credential.status,
    publicId: credential.publicId,
    issueDate: credential.issueDate,
    expiryDate: credential.expiryDate ?? null,
    skills: credential.skills ?? [],
    issuer: credential.issuer ? { name: credential.issuer.name } : undefined,
  };
}

export async function savePassportCache(userId: string, credentials: CachedCredential[]) {
  const value: CachedPassport = { savedAt: new Date().toISOString(), credentials: credentials.map(toCachedCredential) };
  await AsyncStorage.setItem(PASSPORT_KEY(userId), JSON.stringify(value)).catch(() => undefined);
}

export async function loadPassportCache(userId: string): Promise<CachedPassport | null> {
  try {
    const raw = await AsyncStorage.getItem(PASSPORT_KEY(userId));
    return raw ? (JSON.parse(raw) as CachedPassport) : null;
  } catch {
    return null;
  }
}

/** Remembers who is logged in, so a saved login can open the passport offline. */
export async function saveOfflineUser(user: CachedUser) {
  const value: CachedUser = { id: user.id, name: user.name, role: user.role };
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(value)).catch(() => undefined);
}

export async function loadOfflineUser(): Promise<CachedUser | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as CachedUser) : null;
  } catch {
    return null;
  }
}

export async function clearOfflineData() {
  try {
    const user = await loadOfflineUser();
    await AsyncStorage.multiRemove([USER_KEY, ...(user ? [PASSPORT_KEY(user.id)] : [])]);
  } catch {
    // Nothing stored.
  }
}

/** "today at 14:05" / "12 Nov 2026" — when the offline copy was saved. */
export function formatSavedAt(iso: string) {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? `today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}
