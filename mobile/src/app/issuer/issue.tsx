import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, router, useFocusEffect } from 'expo-router';

import { useAuth } from '@/context/auth';
import { IssuerApprovalNotice } from '@/components/issuer-approval-notice';
import { apiFetch } from '@/lib/api';

export default function IssueCredentialScreen() {
  const { token, user, refreshUser } = useAuth();
  const approved = user?.issuerApproved !== false;
  const [learnerEmail, setLearnerEmail] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState('');
  const [skills, setSkills] = useState('');
  const [evidence, setEvidence] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Re-check approval whenever this tab opens, so an issuer approved after logging in can issue right away.
  useFocusEffect(useCallback(() => {
    void refreshUser().catch(() => undefined);
  }, [refreshUser]));

  const handleSubmit = async () => {
    if (!token) {
      router.replace('/');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const { credential } = await apiFetch<{ credential: { title: string } }>('/issuer/credentials', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: {
          learnerEmail: learnerEmail.trim(),
          title,
          category,
          description,
          issueDate,
          expiryDate: expiryDate || null,
          skills: skills.split(',').map((item) => item.trim()).filter(Boolean),
          evidence: evidence || null,
        },
      });
      // Confirm clearly and clear the form, so the same credential isn't sent twice by accident.
      setSuccess(`"${credential.title}" was issued to ${learnerEmail.trim()}.`);
      setLearnerEmail('');
      setTitle('');
      setCategory('');
      setDescription('');
      setExpiryDate('');
      setSkills('');
      setEvidence('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not issue the credential.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading} accessibilityRole="header">Issue credential</Text>
      <IssuerApprovalNotice />
      <TextInput value={learnerEmail} onChangeText={setLearnerEmail} placeholder="Learner email" style={styles.input} />
      <TextInput value={title} onChangeText={setTitle} placeholder="Qualification title" style={styles.input} />
      <TextInput value={category} onChangeText={setCategory} placeholder="Category" style={styles.input} />
      <TextInput value={description} onChangeText={setDescription} placeholder="Description" multiline style={[styles.input, styles.textArea]} />
      <TextInput value={issueDate} onChangeText={setIssueDate} placeholder="Issue date (YYYY-MM-DD)" style={styles.input} />
      <TextInput value={expiryDate} onChangeText={setExpiryDate} placeholder="Expiry date, YYYY-MM-DD (optional)" style={styles.input} />
      <TextInput value={skills} onChangeText={setSkills} placeholder="Skills, separated by commas" multiline style={[styles.input, styles.textArea]} />
      <TextInput value={evidence} onChangeText={setEvidence} placeholder="Evidence note (optional)" multiline style={[styles.input, styles.textArea]} />

      <Pressable
        style={[styles.primaryButton, !approved && { opacity: 0.5 }]}
        onPress={handleSubmit}
        disabled={submitting || !approved}
        accessibilityState={{ disabled: submitting || !approved }}>
        <Text style={styles.primaryButtonText}>{submitting ? 'Issuing...' : 'Issue credential'}</Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
      {success ? (
        <View style={styles.successBox} accessibilityLiveRegion="polite">
          <Text style={styles.successText}>✓ {success}</Text>
          <Link href="/issuer/issued" style={styles.successLink}>View issued credentials →</Link>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20 },
  heading: { fontSize: 28, fontWeight: '700', color: '#232323', marginBottom: 16 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    color: '#232323',
  },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: '#1e1e1e', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  errorText: { color: '#9a352c', fontSize: 13, marginTop: 12 },
  successBox: { backgroundColor: '#f3f3f3', borderRadius: 12, padding: 12, marginTop: 12, borderLeftWidth: 4, borderLeftColor: '#1e1e1e', gap: 6 },
  successText: { color: '#353535', fontSize: 14, fontWeight: '700' },
  successLink: { color: '#1e1e1e', fontSize: 14, fontWeight: '700' },
});
