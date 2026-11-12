import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import { apiFetch } from '@/lib/api';
import { EXPIRY_OPTIONS, expiryLabel, formatShareDate } from '@/lib/share-options';

// A curated profile: the learner ticks several credentials and gets one link and QR code for all
// of them (Server/src/profile-links.ts). The employer sees each credential checked separately.

export type ShareableCredential = { id: string; title: string; status: string };

type ProfileLink = {
  id: string;
  title: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  expiresAt: string | null;
  createdAt: string;
  credentials: Array<{ id: string; title: string }>;
};

const MAX_CREDENTIALS = 20;
const MAX_TITLE = 80;

export function ProfileShare({ credentials, token }: { credentials: ShareableCredential[]; token: string }) {
  // Kept in the order the learner ticked them; the public page lists them in this order.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [shareUrl, setShareUrl] = useState('');
  const [links, setLinks] = useState<ProfileLink[]>([]);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const loadLinks = useCallback(async () => {
    try {
      const { profileLinks } = await apiFetch<{ profileLinks: ProfileLink[] }>('/learner/profile-links', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLinks(profileLinks);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load your profile links.');
    }
  }, [token]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  const toggle = (id: string) => {
    setShareUrl('');
    setCopied(false);
    setSelectedIds((current) => (current.includes(id)
      ? current.filter((selected) => selected !== id)
      : current.length >= MAX_CREDENTIALS ? current : [...current, id]));
  };

  const createLink = async () => {
    if (selectedIds.length === 0) return;
    setCreating(true);
    setError('');
    setCopied(false);
    try {
      const { shareUrl: url } = await apiFetch<{ shareUrl: string }>('/learner/profile-links', {
        method: 'POST',
        headers: authHeaders,
        body: { credentialIds: selectedIds, expiresInDays, title: title.trim() || undefined },
      });
      setShareUrl(url);
      await loadLinks();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create the profile link.');
    } finally {
      setCreating(false);
    }
  };

  const startAgain = () => {
    setShareUrl('');
    setCopied(false);
    setSelectedIds([]);
    setTitle('');
  };

  const revokeLink = async (linkId: string) => {
    setRevokingId(linkId);
    setError('');
    try {
      await apiFetch(`/learner/profile-links/${encodeURIComponent(linkId)}`, { method: 'DELETE', headers: authHeaders });
      await loadLinks();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not turn off the link.');
    } finally {
      setRevokingId('');
    }
  };

  const copyLink = async () => {
    try {
      await Clipboard.setStringAsync(shareUrl);
      setCopied(true);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : 'Could not copy the link.');
    }
  };

  const shareLink = async () => {
    try {
      await Share.share({ message: `Verify my credentials on AgriSkills Passport: ${shareUrl}` });
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Could not open the share sheet.');
    }
  };

  const activeLinks = links.filter((link) => link.status === 'ACTIVE');
  const inactiveCount = links.length - activeLinks.length;
  const hasActiveCredential = credentials.some((credential) => credential.status === 'ACTIVE');

  return (
    <>
      {shareUrl ? (
        <>
          <View style={styles.qrCard}>
            <QRCode value={shareUrl} size={192} backgroundColor="#ffffff" color="#2d2d2d" />
            <Text style={styles.qrCaption}>
              Scan to view {selectedIds.length} credential{selectedIds.length === 1 ? '' : 's'} on one page
            </Text>
          </View>
          <Text style={styles.sectionLabel}>Profile link</Text>
          <View style={styles.linkCard}>
            <Text selectable style={styles.linkText}>{shareUrl}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={shareLink} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>Share link</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={copyLink} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryButtonText}>{copied ? 'Link copied' : 'Copy link'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={startAgain} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryButtonText}>Make another profile</Text>
          </Pressable>
          <Text style={styles.hint}>
            For your security this link is shown only now. If you lose it, create a new one and turn this one off.
          </Text>
        </>
      ) : !hasActiveCredential ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>No active credentials</Text>
          <Text style={styles.stateText}>Only active credentials can be added to a profile.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionLabel}>Choose credentials ({selectedIds.length} selected)</Text>
          <View style={styles.options}>
            {credentials.map((credential) => {
              const isActive = credential.status === 'ACTIVE';
              const position = selectedIds.indexOf(credential.id);
              const isSelected = position !== -1;
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected, disabled: !isActive }}
                  disabled={!isActive}
                  key={credential.id}
                  onPress={() => toggle(credential.id)}
                  style={[styles.option, isSelected && styles.optionSelected, !isActive && styles.optionDisabled]}>
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected ? <Text style={styles.checkboxNumber}>{position + 1}</Text> : null}
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={styles.optionTitle}>{credential.title}</Text>
                    <Text style={[styles.optionStatus, !isActive && styles.optionStatusMuted]}>
                      {isActive ? credential.status : `${credential.status} · can't be shared`}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>Credentials appear on the profile in the order you tick them.</Text>

          <Text style={styles.sectionLabel}>Profile title (optional)</Text>
          <TextInput
            accessibilityLabel="Profile title"
            maxLength={MAX_TITLE}
            onChangeText={setTitle}
            placeholder="e.g. Farm supervisor application"
            placeholderTextColor="#9a9a9a"
            style={styles.input}
            value={title}
          />

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

          <Pressable
            accessibilityRole="button"
            disabled={creating || selectedIds.length === 0}
            onPress={createLink}
            style={({ pressed }) => [styles.primaryButton, (pressed || creating) && styles.pressed, selectedIds.length === 0 && styles.disabled]}>
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {selectedIds.length === 0 ? 'Choose at least one credential' : `Create profile link (${selectedIds.length})`}
              </Text>
            )}
          </Pressable>

          <View style={styles.disclosure}>
            <Text style={styles.disclosureTitle}>What the employer will see</Text>
            <Text style={styles.disclosureText}>
              Your name, the profile title, and for each credential: the title, issuing provider, issue and expiry
              dates, public reference, skills, and whether it is genuine and current. Your contact details and other
              credentials are not shown.
            </Text>
          </View>
        </>
      )}

      {links.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, styles.linksHeading]}>Active profile links</Text>
          {activeLinks.length === 0 ? (
            <Text style={styles.stateText}>No active profile links.</Text>
          ) : (
            activeLinks.map((link) => (
              <View key={link.id} style={styles.linkRow}>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>{link.title ?? `Profile of ${link.credentials.length} credential${link.credentials.length === 1 ? '' : 's'}`}</Text>
                  <Text style={styles.linkMeta} numberOfLines={2}>{link.credentials.map((credential) => credential.title).join(', ')}</Text>
                  <Text style={styles.linkMeta}>Created {formatShareDate(link.createdAt)} · Expires {formatShareDate(link.expiresAt)}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Turn off profile link created ${formatShareDate(link.createdAt)}`}
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
            <Text style={styles.hint}>{inactiveCount} older profile link{inactiveCount === 1 ? '' : 's'} turned off or expired.</Text>
          ) : null}
        </>
      ) : null}

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { color: '#474747', fontSize: 13, fontWeight: '700', marginBottom: 9, marginTop: 4 },
  options: { gap: 9, marginBottom: 8 },
  option: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#e7e7e7', borderRadius: 13, borderWidth: 1, flexDirection: 'row', padding: 13 },
  optionSelected: { backgroundColor: '#f8f8f8', borderColor: '#282828' },
  optionDisabled: { opacity: 0.55 },
  checkbox: { alignItems: 'center', borderColor: '#b4b4b4', borderRadius: 6, borderWidth: 1.5, height: 22, justifyContent: 'center', marginRight: 12, width: 22 },
  checkboxSelected: { backgroundColor: '#1d1d1d', borderColor: '#1d1d1d' },
  checkboxNumber: { color: '#fff', fontSize: 12, fontWeight: '800' },
  optionCopy: { flex: 1 },
  optionTitle: { color: '#2d2d2d', fontSize: 14, fontWeight: '600' },
  optionStatus: { color: '#1e1e1e', fontSize: 10, fontWeight: '700', marginTop: 5, textTransform: 'uppercase' },
  optionStatusMuted: { color: '#9a5c15' },
  input: { backgroundColor: '#fff', borderColor: '#e7e7e7', borderRadius: 12, borderWidth: 1, color: '#2d2d2d', fontSize: 15, marginBottom: 18, minHeight: 48, paddingHorizontal: 14 },
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
  disabled: { opacity: 0.5 },
  hint: { color: '#707070', fontSize: 12, lineHeight: 18, marginBottom: 18, marginTop: 4 },
  disclosure: { backgroundColor: '#f0f0f0', borderRadius: 14, marginTop: 8, padding: 15 },
  disclosureTitle: { color: '#414141', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  disclosureText: { color: '#5c5c5c', fontSize: 12, lineHeight: 18 },
  linksHeading: { marginTop: 24 },
  linkRow: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#e7e7e7', borderRadius: 13, borderWidth: 1, flexDirection: 'row', gap: 10, marginBottom: 9, padding: 13 },
  linkMeta: { color: '#707070', fontSize: 12, marginTop: 4 },
  revokeButton: { alignItems: 'center', borderColor: '#e6c2bd', borderRadius: 10, borderWidth: 1, justifyContent: 'center', minHeight: 44, minWidth: 84, paddingHorizontal: 12 },
  revokeText: { color: '#a33b2d', fontSize: 13, fontWeight: '700' },
  stateCard: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, gap: 10, marginBottom: 18, padding: 20 },
  stateTitle: { color: '#2d2d2d', fontSize: 15, fontWeight: '700' },
  stateText: { color: '#707070', fontSize: 13, textAlign: 'center' },
  error: { color: '#a33b2d', fontSize: 13, marginTop: 14 },
});
