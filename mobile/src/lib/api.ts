import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 3000;

// The API address. Set EXPO_PUBLIC_API_URL to force one (e.g. the Render URL). Otherwise, in
// development, it is worked out from where the app was loaded, so it keeps working when the
// laptop's Wi-Fi address changes:
// - web: the same computer that served the page (localhost, or the laptop's IP from a phone browser)
// - Expo Go / dev build on a phone: the computer running Expo (Metro), i.e. this laptop
function resolveApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:${API_PORT}`;
  }
  const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (metroHost) return `http://${metroHost}:${API_PORT}`;
  // Android emulator's alias for the host computer.
  return `http://10.0.2.2:${API_PORT}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: Record<string, unknown> | string | null;
};

/** An error from the API, with the HTTP status and the server's machine-readable code (if any). */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

function browserIsOffline() {
  return Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false;
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}) {
  const { body, headers, ...rest } = options;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(headers ?? {}),
      },
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    if (browserIsOffline()) {
      throw new ApiError("You're offline. Check your internet or Wi-Fi connection and try again.", 0, 'OFFLINE');
    }
    throw new ApiError(
      `Can't reach the server at ${API_BASE_URL}. Check that it is running and that this device is on the same network.`,
      0,
      'UNREACHABLE',
    );
  }

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(`The server sent an unexpected response (HTTP ${response.status}).`, response.status);
  }

  if (!response.ok) {
    throw new ApiError(data?.error ?? `Request failed (HTTP ${response.status}).`, response.status, data?.code, data);
  }

  return data as T;
}
