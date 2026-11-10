import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ReviewerPicker } from '@/components/reviewer-picker';
import { useAuth } from '@/context/auth';
import { apiFetch } from '@/lib/api';
import {
  REVIEW_LABELS,
  absolutePhotoUrl,
  formatDate,
  loadReviewers,
  type Evidence,
  type Reviewer,
} from '@/lib/evidence';

export default function EvidenceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoFailed, setPhotoFailed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Choosing a reviewer
  const [reviewers, setReviewers] = useState<Reviewer[] | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [savingReviewer, setSavingReviewer] = useState(false);

  const auth = token ? { Authorization: `Bearer ${token}` } : undefined;

  useEffect(() => {
    if (!token || !id) return;
    apiFetch<{ evidence: Evidence }>(`/learner/evidence/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((data) => setEvidence(data.evidence))
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : 'Could not load this evidence.');
      })
      .finally(() => setLoading(false));
  }, [id, token]);

  const openReviewerChoice = async () => {
    setChoosing(true);
    if (reviewers || !token) return;
    try {
      setReviewers(await loadReviewers(token));
    } catch (requestError) {
      setReviewers([]);
      setError(requestError instanceof Error ? requestError.message : 'Could not load training providers.');
    }
  };

  const chooseReviewer = async (reviewerId: string) => {
    if (!evidence || !auth) return;
    setSavingReviewer(true);
    setError('');
    try {
      const data = await apiFetch<{ evidence: Evidence }>(`/learner/evidence/${encodeURIComponent(evidence.id)}/reviewer`, {
        method: 'PATCH',
        headers: auth,
        body: { reviewerId },
      });
      setEvidence(data.evidence);
      setChoosing(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save the reviewer.');
    } finally {
      setSavingReviewer(false);
    }
  };

  const handleDelete = async () => {
    // Two taps: Alert-based confirmation dialogs don't show on the web.
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (!token || !evidence) return;
    setDeleting(true);
    setError('');
    try {
      await apiFetch(`/learner/evidence/${encodeURIComponent(evidence.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      router.replace('/learner/evidence' as never);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not delete this evidence.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const goBack = () => router.replace('/learner/evidence' as never);
  const photoUri = absolutePhotoUrl(evidence?.photoUrl);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={goBack} accessibilityRole="button" style={styles.backLink}>
        <Text style={styles.backText}>‹ All evidence</Text>
      </Pressable>

      {loading ? (
        <Text style={styles.muted}>Loading evidence...</Text>
      ) : !evidence ? (
        <Text accessibilityRole="alert" style={styles.errorText}>{error || 'Evidence not found.'}</Text>
      ) : (
        <>
          <Text style={styles.kicker}>Skills evidence</Text>
          <Text style={styles.title}>{evidence.skill}</Text>
          <Text
            style={[
              styles.badge,
              evidence.reviewStatus === 'APPROVED' && styles.badgeApproved,
              evidence.reviewStatus === 'REJECTED' && styles.badgeRejected,
            ]}>
            {REVIEW_LABELS[evidence.reviewStatus]}
          </Text>

          {evidence.hasPhoto ? (
            photoUri && !photoFailed ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.photo}
                resizeMode="cover"
                onError={() => setPhotoFailed(true)}
                accessibilityLabel={`Evidence photo for ${evidence.skill}`}
              />
            ) : (
              <Text style={styles.muted}>The photo can’t be shown right now. Open this page again to reload it.</Text>
            )
          ) : null}

          <View style={styles.card}>
            <Text style={styles.label}>What was done</Text>
            <Text style={styles.value}>{evidence.note}</Text>

            <Text style={styles.label}>Recorded</Text>
            <Text style={styles.value}>{new Date(evidence.createdAt).toLocaleString()}</Text>

            <Text style={styles.label}>Location stamp</Text>
            <Text style={styles.value}>
              {evidence.locationConsent && evidence.locationLatitude !== null
                ? `${evidence.locationLatitude}, ${evidence.locationLongitude}`
                  + (evidence.locationCapturedAt ? ` (${new Date(evidence.locationCapturedAt).toLocaleString()})` : '')
                : 'Not added'}
            </Text>

            <Text style={styles.label}>Supervisor</Text>
            <Text style={styles.value}>
              {evidence.supervisorName
                ? `${evidence.supervisorName}${evidence.supervisorContact ? ` · ${evidence.supervisorContact}` : ''}`
                : 'Not named'}
            </Text>
          </View>

          {/* Review by a training provider */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Review</Text>
            {evidence.reviewer ? (
              <>
                <Text style={styles.label}>Reviewer</Text>
                <Text style={styles.value}>{evidence.reviewer.name}</Text>
              </>
            ) : (
              <Text style={styles.help}>No reviewer chosen yet. Choose an approved training provider to check this evidence.</Text>
            )}

            {evidence.reviewStatus !== 'SUBMITTED' ? (
              <>
                <Text style={styles.label}>Decision</Text>
                <Text style={styles.value}>
                  {REVIEW_LABELS[evidence.reviewStatus]}
                  {evidence.reviewedAt ? ` on ${formatDate(evidence.reviewedAt)}` : ''}
                </Text>
                {evidence.reviewNote ? (
                  <>
                    <Text style={styles.label}>Reviewer's note</Text>
                    <Text style={styles.value}>{evidence.reviewNote}</Text>
                  </>
                ) : null}
              </>
            ) : choosing ? (
              <View style={styles.section}>
                <ReviewerPicker
                  reviewers={reviewers ?? []}
                  loading={!reviewers}
                  selectedId={evidence.reviewer?.id ?? null}
                  onSelect={chooseReviewer}
                />
                {savingReviewer ? <Text style={styles.help}>Saving...</Text> : null}
                <Pressable onPress={() => setChoosing(false)} accessibilityRole="button" style={styles.cancel}>
                  <Text style={styles.backText}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.secondaryButton} onPress={openReviewerChoice} accessibilityRole="button">
                <Text style={styles.secondaryButtonText}>{evidence.reviewer ? 'Change reviewer' : 'Choose a reviewer'}</Text>
              </Pressable>
            )}
          </View>

          {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={[styles.deleteButton, confirmDelete && styles.deleteConfirm]}
            onPress={handleDelete}
            disabled={deleting}
            accessibilityRole="button">
            <Text style={[styles.deleteText, confirmDelete && styles.deleteConfirmText]}>
              {deleting ? 'Deleting...' : confirmDelete ? 'Tap again to delete permanently' : 'Delete evidence'}
            </Text>
          </Pressable>
          {confirmDelete && !deleting ? (
            <Pressable onPress={() => setConfirmDelete(false)} accessibilityRole="button" style={styles.cancel}>
              <Text style={styles.backText}>Cancel</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, paddingBottom: 48 },
  backLink: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8 },
  backText: { color: '#1e1e1e', fontWeight: '700', fontSize: 15 },
  kicker: { color: '#1e1e1e', fontWeight: '700', letterSpacing: 1, fontSize: 12, textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: '700', color: '#232323', marginTop: 8 },
  badge: { marginTop: 8, color: '#1e1e1e', fontWeight: '700', textTransform: 'uppercase', fontSize: 11 },
  badgeApproved: { color: '#14532d' },
  badgeRejected: { color: '#9a352c' },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16, marginTop: 16, backgroundColor: '#e5e5e5' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginTop: 16 },
  cardTitle: { color: '#232323', fontSize: 17, fontWeight: '700', marginBottom: 6 },
  section: { marginTop: 10 },
  label: { color: '#666666', fontSize: 12, marginTop: 10, marginBottom: 4, fontWeight: '600' },
  value: { color: '#252525', fontSize: 15, lineHeight: 22 },
  help: { color: '#666666', fontSize: 13, lineHeight: 19, marginBottom: 8 },
  secondaryButton: { borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#fff', marginTop: 10 },
  secondaryButtonText: { color: '#1e1e1e', fontWeight: '700' },
  muted: { color: '#5b5b5b', marginTop: 12 },
  errorText: { color: '#9a352c', fontSize: 14, marginTop: 12 },
  deleteButton: { borderWidth: 1, borderColor: '#9a352c', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 20 },
  deleteConfirm: { backgroundColor: '#9a352c' },
  deleteText: { color: '#9a352c', fontWeight: '700' },
  deleteConfirmText: { color: '#fff' },
  cancel: { alignSelf: 'center', paddingVertical: 10 },
});
