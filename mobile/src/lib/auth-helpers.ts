import type { AuthUser } from '@/context/auth';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;

export function validateEmail(email: string) {
  if (!email.trim()) return 'Enter your email address.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address, like name@example.com.';
  return '';
}

export function validateNewPassword(password: string) {
  if (!password) return 'Choose a password.';
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  return '';
}

/** Where each role lands after signing in. Unknown roles return null. */
export function dashboardFor(role: AuthUser['role']) {
  if (role === 'LEARNER') return '/learner' as const;
  if (role === 'ISSUER') return '/issuer' as const;
  if (role === 'ADMIN') return '/admin' as const;
  if (role === 'EMPLOYER') return '/employer' as const;
  return null;
}
