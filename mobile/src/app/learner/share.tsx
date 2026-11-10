import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import { useAuth } from '@/context/auth';
import { apiFetch } from '@/lib/api';

type CredentialOption = {
  id: string;
  title: string;
  status: string;
  publicId: string;
};

type ShareLink = {
  id: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  expiresAt: string | null;
  createdAt: string;
};

// The server accepts up to 365 days (MAX_SHARE_DAYS in Server/src/app.ts).
const EXPIRY_OPTIONS = [7, 30, 90, 365];
const expiryLabel = (days: number) => (days === 365 ? '1 year' : `${days} days`);

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never';
}

export default function ShareCredentialScreen() {
  const { token } = useAuth();
  const [credentials, setCredentials] = useState<CredentialOption[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [shareUrl, setShareUrl] = useState('');
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loadingCredentials, setLoadingCredentials] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
  const selected = credentials.find((credential) => credential.id === selectedId);
  const canShare = selected?.status === 'ACTIVE';

  useEffect(() => {
    if (!token) {
      setLoadingCredentials(false);
      setError('Sign in to share a credential.');
      return;
    }

    let active = true;
    apiFetch<{ credentials: CredentialOption[] }>('/learner/credentials', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(({ credentials: items }) => {
        if (!active) return;
        setCredentials(items);
        setSelectedId((items.find((item) => item.status === 'ACTIVE') ?? items[0])?.id ?? '');
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Could not load credentials.');
      })
      .finally(() => {
        if (active) setLoadingCredentials(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const loadLinks = useCallback(async (credentialId: string) => {
    if (!token || !credentialId) {
      setLinks([]);
      return;
    }
    try {
      const { shareLinks } = await apiFetch<{ shareLinks: ShareLink[] }>(
        `/learner/credentials/${encodeURIComponent(credentialId)}/share-links`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setLinks(shareLinks);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load your share links.');
    }
  }, [token]);

  useEffect(() => {
    // A new link URL is only shown once, so clear it when the learner picks another credential.
    setShareUrl('');
    setCopied(false);
    setError('');
    void loadLinks(selectedId);
  }, [selectedId, loadLinks]);

  const createLink = async () => {
    if (!selected || !authHeaders) return;
    setCreating(true);
    setError('');
    setCopied(false);
    try {
      const { shareUrl: url } = await apiFetch<{ shareUrl: string }>(
        `/learner/credentials/${encodeURIComponent(selected.id)}/share-links`,
        { method: 'POST', headers: authHeaders, body: { expiresInDays } },
      );
      setShareUrl(url);
      await loadLinks(selected.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create the share link.');
    } finally {
      setCreating(false);
    }
  };

  const revokeLink = async (linkId: string) => {
    if (!authHeaders) return;
    setRevokingId(linkId);
    setError('');
    try {
      await apiFetch(`/learner/share-links/${encodeURIComponent(linkId)}`, { method: 'DELETE', headers: authHeaders });
      setShareUrl('');
      await loadLinks(selectedId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not turn off the link.');
    } finally {
      setRevokingId('');
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await Clipboard.setStringAsync(shareUrl);
      setCopied(true);
      setError('');
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : 'Could not copy the link.');
    }
  };

  const shareLink = async () => {
    if (!shareUrl || !selected) return;
    try {
      await Share.share({ message: `Verify my ${selected.title} on AgriSkills Passport: ${shareUrl}` });
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Could not open the share sheet.');
    }
  };

  const activeLinks = links.filter((link) => link.status === 'ACTIVE');
  const inactiveCount = links.length - activeLinks.length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Share securely</Text>
      <Text style={styles.heading}>Share a credential</Text>
      <Text style={styles.subtitle}>Choose a qualification and create a private verification link that you can turn off at any time.</Text>

      {loadingCredentials ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color="#1e1e1e" />
          <Text style={styles.stateText}>Loading your credentials…</Text>
        </View>
      ) : credentials.length === 0 ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>No credentials to share</Text>
          <Text style={styles.stateText}>Credentials issued to you will appear here.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionLabel}>Select qualification</Text>
          <View style={styles.options}>
            {credentials.map((credential) => {
              const isSelected = credential.id === selectedId;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  key={credential.id}
                  onPress={() => setSelectedId(credential.id)}
                  style={[styles.option, isSelected && styles.optionSelected]}>
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={styles.optionTitle}>{credential.title}</Text>
                    <Text style={[styles.optionStatus, credential.status !== 'ACTIVE' && styles.optionStatusMuted]}>
                      {credential.status}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {!canShare ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>This credential can’t be shared</Text>
              <Text style={styles.stateText}>Only active credentials can be shared. Expired or revoked credentials stay in your passport for your records.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Link expires after</Text>
              <View style={styles.chips}>
                {EXPIRY_OPTIONS.map((days) => {
                  const isSelected = days === expiresInDays;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      key={days}
                      onPress={() => setExpiresInDays(days)}
                      style={[styles.chip, isSelected && styles.chipSelected]}>
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{expiryLabel(days)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {shareUrl ? (
                <>
                  <View style={styles.qrCard}>
                    <QRCode value={shareUrl} size={192} backgroundColor="#ffffff" color="#2d2d2d" />
                    <Text style={styles.qrCaption}>Scan to view the public verification page</Text>
                  </View>
                  <Text style={styles.sectionLabel}>Share link</Text>
                  <View style={styles.linkCard}>
                    <Text selectable style={styles.linkText}>{shareUrl}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={shareLink}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                    <Text style={styles.primaryButtonText}>Share link</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={copyLink}
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                    <Text style={styles.secondaryButtonText}>{copied ? 'Link copied' : 'Copy link'}</Text>
                  </Pressable>
                  <Text style={styles.hint}>
                    For your security this link is shown only now. If you lose it, create a new one and turn this one off.
                  </Text>
                </>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  disabled={creating}
                  onPress={createLink}
                  style={({ pressed }) => [styles.primaryButton, (pressed || creating) && styles.pressed]}>
                  {creating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Create verification link</Text>
                  )}
                </Pressable>
              )}

              <View style={styles.disclosure}>
                <Text style={styles.disclosureTitle}>What the employer will see</Text>
                <Text style={styles.disclosureText}>
                  Your name, the qualification title, issuing provider, issue and expiry dates,
                  public reference, skills, and whether the credential is genuine and current.
                  Your contact details and account information are not shown.
                </Text>
              </View>
            </>
          )}

          {links.length > 0 ? (
            <>
              <Text style={[styles.sectionLabel, styles.linksHeading]}>Active links for this credential</Text>
              {activeLinks.length === 0 ? (
                <Text style={styles.stateText}>No active links. Links you turned off or that expired no longer work.</Text>
              ) : (
                activeLinks.map((link) => (
                  <View key={link.id} style={styles.linkRow}>
                    <View style={styles.optionCopy}>
                      <Text style={styles.optionTitle}>Created {formatDate(link.createdAt)}</Text>
                      <Text style={styles.linkMeta}>Expires {formatDate(link.expiresAt)}</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Turn off link created ${formatDate(link.createdAt)}`}
                      disabled={revokingId === link.id}
                      onPress={() => revokeLink(link.id)}
                      style={({ pressed }) => [styles.revokeButton, pressed && styles.pressed]}>
                      {revokingId === link.id ? (
                        <ActivityIndicator color="#a33b2d" size="small" />
                      ) : (
                        <Text style={styles.revokeText}>Turn off</Text>
                      )}
                    </Pressable>
                  </View>
                ))
              )}
              {inactiveCount > 0 ? (
                <Text style={styles.hint}>{inactiveCount} older link{inactiveCount === 1 ? '' : 's'} turned off or expired.</Text>
              ) : null}
            </>
          ) : null}
        </>
      )}

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f7f3' },
  content: { padding: 20, paddingBottom: 36 },
  eyebrow: { color: '#1e1e1e', fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  heading: { color: '#2d2d2d', fontSize: 28, fontWeight: '700', marginTop: 6 },
  subtitle: { color: '#707070', fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 22 },
  sectionLabel: { color: '#474747', fontSize: 13, fontWeight: '700', marginBottom: 9, marginTop: 4 },
  options: { gap: 9, marginBottom: 18 },
  option: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#e7e7e7', borderRadius: 13, borderWidth: 1, flexDirection: 'row', padding: 13 },
  optionSelected: { backgroundColor: '#f8f8f8', borderColor: '#282828' },
  radio: { alignItems: 'center', borderColor: '#b4b4b4', borderRadius: 10, borderWidth: 1.5, height: 20, justifyContent: 'center', marginRight: 12, width: 20 },
  radioSelected: { borderColor: '#1d1d1d' },
  radioDot: { backgroundColor: '#1d1d1d', borderRadius: 5, height: 10, width: 10 },
  optionCopy: { flex: 1 },
  optionTitle: { color: '#2d2d2d', fontSize: 14, fontWeight: '600' },
  optionStatus: { color: '#1e1e1e', fontSize: 10, fontWeight: '700', marginTop: 5, textTransform: 'uppercase' },
  optionStatusMuted: { color: '#9a5c15' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: { backgroundColor: '#fff', borderColor: '#e7e7e7', borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  chipSelected: { backgroundColor: '#1d1d1d', borderColor: '#1d1d1d' },
  chipText: { color: '#474747', fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
  qrCard: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#e7ece7', borderRadius: 18, borderWidth: 1, marginBottom: 20, padding: 20 },
  qrCaption: { color: '#707070', fontSize: 12, marginTop: 15, textAlign: 'center' },
  linkCard: { backgroundColor: '#fff', borderColor: '#e7e7e7', borderRadius: 12, borderWidth: 1, marginBottom: 12, padding: 14 },
  linkText: { color: '#4e4e4e', fontSize: 13, lineHeight: 19 },
  primaryButton: { alignItems: 'center', backgroundColor: '#1d1d1d', borderRadius: 12, marginBottom: 10, minHeight: 48, justifyContent: 'center', paddingVertical: 14 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#282828', borderRadius: 12, borderWidth: 1, marginBottom: 10, minHeight: 48, justifyContent: 'center', paddingVertical: 13 },
  secondaryButtonText: { color: '#1d1d1d', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  hint: { color: '#707070', fontSize: 12, lineHeight: 18, marginBottom: 18, marginTop: 4 },
  disclosure: { backgroundColor: '#f0f0f0', borderRadius: 14, marginTop: 8, padding: 15 },
  disclosureTitle: { color: '#414141', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  disclosureText: { color: '#5c5c5c', fontSize: 12, lineHeight: 18 },
  linksHeading: { marginTop: 24 },
  linkRow: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#e7e7e7', borderRadius: 13, borderWidth: 1, flexDirection: 'row', marginBottom: 9, padding: 13 },
  linkMeta: { color: '#707070', fontSize: 12, marginTop: 4 },
  revokeButton: { alignItems: 'center', borderColor: '#e6c2bd', borderRadius: 10, borderWidth: 1, justifyContent: 'center', minHeight: 44, minWidth: 84, paddingHorizontal: 12 },
  revokeText: { color: '#a33b2d', fontSize: 13, fontWeight: '700' },
  stateCard: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, gap: 10, marginBottom: 18, padding: 20 },
  stateTitle: { color: '#2d2d2d', fontSize: 15, fontWeight: '700' },
  stateText: { color: '#707070', fontSize: 13, textAlign: 'center' },
  error: { color: '#a33b2d', fontSize: 13, marginTop: 14 },
});
