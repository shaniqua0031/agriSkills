import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router } from 'expo-router';

import { useAuth } from '@/context/auth';
import { apiFetch } from '@/lib/api';
import { ReviewerPicker } from '@/components/reviewer-picker';
import { loadReviewers, uploadEvidencePhoto, type Evidence, type Reviewer } from '@/lib/evidence';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type Photo = { previewUri: string; dataUri: string; contentType: string };
type Stamp = { latitude: number; longitude: number; capturedAt: string };

function toPhoto(asset: ImagePicker.ImagePickerAsset): Photo | string {
  const fromDataUri = /^data:([^;]+);base64,/.exec(asset.uri)?.[1];
  const contentType = (asset.mimeType ?? fromDataUri ?? 'image/jpeg').toLowerCase();
  if (!ALLOWED_TYPES.includes(contentType)) return 'Please choose a JPEG, PNG or WebP photo.';
  const dataUri = asset.base64 ? `data:${contentType};base64,${asset.base64}` : asset.uri.startsWith('data:') ? asset.uri : null;
  if (!dataUri) return 'Could not read that photo. Please try another one.';
  return { previewUri: asset.uri, dataUri, contentType };
}

export default function NewEvidenceScreen() {
  const { token } = useAuth();
  const [skill, setSkill] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [addLocation, setAddLocation] = useState(false);
  const [stamp, setStamp] = useState<Stamp | null>(null);
  const [locating, setLocating] = useState(false);
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorContact, setSupervisorContact] = useState('');
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [reviewersLoading, setReviewersLoading] = useState(true);
  const [reviewerId, setReviewerId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    loadReviewers(token)
      .then(setReviewers)
      .catch(() => setReviewers([]))
      .finally(() => setReviewersLoading(false));
  }, [token]);

  const pickPhoto = async (source: 'camera' | 'library') => {
    setError('');
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(source === 'camera'
        ? 'Camera access was not allowed. You can allow it in your phone settings, or choose a photo instead.'
        : 'Photo access was not allowed. You can allow it in your phone settings.');
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: true };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;
    const picked = toPhoto(result.assets[0]);
    if (typeof picked === 'string') setError(picked);
    else setPhoto(picked);
  };

  // Location is only requested after the learner switches it on; nothing is collected otherwise.
  const toggleLocation = async (on: boolean) => {
    setAddLocation(on);
    setStamp(null);
    if (!on) return;
    setError('');
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setAddLocation(false);
        setError('Location access was not allowed, so no location will be added.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setStamp({
        latitude: Number(position.coords.latitude.toFixed(5)),
        longitude: Number(position.coords.longitude.toFixed(5)),
        capturedAt: new Date(position.timestamp).toISOString(),
      });
    } catch {
      setAddLocation(false);
      setError('Could not get your location. Check that location is turned on and try again.');
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    if (!token) {
      router.replace('/');
      return;
    }
    if (!skill.trim() || !note.trim()) {
      setError('Enter the skill and a short note describing your evidence.');
      return;
    }
    if (supervisorContact.trim() && !supervisorName.trim()) {
      setError("Add the supervisor's name as well as their contact details.");
      return;
    }
    if (addLocation && !stamp) {
      setError('Wait for the location to be found, or switch the location stamp off.');
      return;
    }

    setError('');
    try {
      let photoKey: string | null = null;
      if (photo) {
        setSaving('Uploading photo...');
        photoKey = await uploadEvidencePhoto(token, photo.dataUri, photo.contentType);
      }
      setSaving('Saving evidence...');
      const { evidence } = await apiFetch<{ evidence: Evidence }>('/learner/evidence', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: {
          skill: skill.trim(),
          note: note.trim(),
          photoKey,
          locationConsent: Boolean(stamp),
          location: stamp,
          supervisorName: supervisorName.trim() || null,
          supervisorContact: supervisorContact.trim() || null,
          reviewerId,
        },
      });
      router.replace(`/learner/evidence/${evidence.id}` as never);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save your evidence.');
    } finally {
      setSaving('');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backLink}>
        <Text style={styles.backText}>‹ Back</Text>
      </Pressable>
      <Text style={styles.heading} accessibilityRole="header">Add evidence</Text>

      <Text style={styles.label}>Skill *</Text>
      <TextInput value={skill} onChangeText={setSkill} placeholder="e.g. Drip irrigation installation" maxLength={120} style={styles.input} />

      <Text style={styles.label}>What did you do? *</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Describe the work, where and when, and what the result was."
        multiline
        maxLength={2000}
        style={[styles.input, styles.textArea]}
      />

      <Text style={styles.label}>Photo (optional)</Text>
      {photo ? (
        <View style={styles.photoBox}>
          <Image source={{ uri: photo.previewUri }} style={styles.photo} accessibilityLabel="Selected evidence photo" />
          <Pressable onPress={() => setPhoto(null)} accessibilityRole="button">
            <Text style={styles.linkText}>Remove photo</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.row}>
          {Platform.OS !== 'web' && (
            <Pressable style={styles.secondaryButton} onPress={() => pickPhoto('camera')} accessibilityRole="button">
              <Text style={styles.secondaryButtonText}>Take photo</Text>
            </Pressable>
          )}
          <Pressable style={styles.secondaryButton} onPress={() => pickPhoto('library')} accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>{Platform.OS === 'web' ? 'Choose photo' : 'From gallery'}</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.switchLabel}>Add a location stamp</Text>
          <Text style={styles.help}>Optional. Shows where the work was done. Only saved if you switch this on.</Text>
        </View>
        <Switch
          value={addLocation}
          onValueChange={toggleLocation}
          disabled={locating}
          trackColor={{ true: '#1e1e1e' }}
          accessibilityLabel="Add a location stamp"
        />
      </View>
      {locating ? <Text style={styles.help}>Finding your location...</Text> : null}
      {stamp ? (
        <Text style={styles.help}>Location added: {stamp.latitude}, {stamp.longitude}</Text>
      ) : null}

      <Text style={styles.sectionTitle} accessibilityRole="header">Supervisor (optional)</Text>
      <Text style={styles.help}>Someone who saw you do the work. The training provider reviewing your evidence may contact them.</Text>
      <TextInput value={supervisorName} onChangeText={setSupervisorName} placeholder="Supervisor's name" maxLength={120} style={styles.input} />
      <TextInput
        value={supervisorContact}
        onChangeText={setSupervisorContact}
        placeholder="Phone or email"
        maxLength={120}
        autoCapitalize="none"
        style={styles.input}
      />

      <Text style={styles.sectionTitle} accessibilityRole="header">Who should review it?</Text>
      <Text style={styles.help}>
        An approved training provider checks your evidence and approves it. Only the provider you choose can see it.
      </Text>
      <ReviewerPicker reviewers={reviewers} selectedId={reviewerId} onSelect={setReviewerId} loading={reviewersLoading} />

      {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}

      <Pressable style={[styles.primaryButton, saving ? styles.disabled : null]} onPress={handleSave} disabled={Boolean(saving)} accessibilityRole="button">
        <Text style={styles.primaryButtonText}>{saving || 'Save evidence'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, paddingBottom: 48 },
  backLink: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8 },
  backText: { color: '#1e1e1e', fontWeight: '700', fontSize: 15 },
  heading: { fontSize: 26, fontWeight: '700', color: '#232323', marginBottom: 12 },
  label: { color: '#4f4f4f', fontWeight: '700', fontSize: 13, marginTop: 8, marginBottom: 6 },
  sectionTitle: { color: '#232323', fontWeight: '700', fontSize: 16, marginTop: 20 },
  help: { color: '#666666', fontSize: 12, lineHeight: 17, marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  textArea: { minHeight: 110, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#fff' },
  secondaryButtonText: { color: '#1e1e1e', fontWeight: '700' },
  photoBox: { backgroundColor: '#fff', borderRadius: 14, padding: 10, marginBottom: 10, alignItems: 'center', gap: 8 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 10, backgroundColor: '#e5e5e5' },
  linkText: { color: '#9a352c', fontWeight: '700', paddingVertical: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, marginBottom: 4 },
  switchText: { flex: 1 },
  switchLabel: { color: '#232323', fontWeight: '700', fontSize: 15, marginBottom: 2 },
  errorText: { color: '#9a352c', fontSize: 14, marginTop: 8 },
  primaryButton: { backgroundColor: '#1e1e1e', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.6 },
});
