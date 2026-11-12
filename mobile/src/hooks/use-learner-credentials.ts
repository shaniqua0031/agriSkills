import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/auth';
import { ApiError, apiFetch } from '@/lib/api';
import { type CachedCredential, loadPassportCache, savePassportCache } from '@/lib/passport-cache';

export type LearnerCredential = CachedCredential & { description?: string };

/**
 * The learner's credentials, from the server when it can be reached, otherwise from the copy
 * saved on this device. `savedAt` is set when the offline copy is being shown.
 */
export function useLearnerCredentials() {
  const { token, user } = useAuth();
  const [credentials, setCredentials] = useState<LearnerCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !user) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ credentials: LearnerCredential[] }>('/learner/credentials', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCredentials(data.credentials ?? []);
      setSavedAt(null);
      void savePassportCache(user.id, data.credentials ?? []);
    } catch (requestError) {
      // Status 0 means the server could not be reached (offline or asleep): use the saved copy.
      const cached = requestError instanceof ApiError && requestError.status === 0 ? await loadPassportCache(user.id) : null;
      if (cached) {
        setCredentials(cached.credentials);
        setSavedAt(cached.savedAt);
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Could not load your credentials.');
      }
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    void load();
  }, [load]);

  return { credentials, loading, error, savedAt, reload: load };
}
