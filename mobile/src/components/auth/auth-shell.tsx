import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { BackgroundArt } from './background-art';
import { Brand } from './brand';
import { OfflineBanner } from './offline-banner';
import { ScanIllustration } from './scan-illustration';

const WIDE_BREAKPOINT = 900;

/** Animated picture of a phone scanning a certificate's QR code and showing "Verified", shown under the logo. */
function WelcomePhoto({ width }: { width: number }) {
  return <ScanIllustration width={width} />;
}

/**
 * Shared layout for the login, registration and password-reset screens:
 * drawn background of QR codes, links and fields; on wide screens a welcome panel sits beside the form,
 * on phones the branding and illustration sit above the form in one scrolling column.
 */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const illustrationWidth = Math.min(width - 88, 300);

  return (
    <View style={styles.background}>
      <BackgroundArt />
      <View style={styles.tint}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.scroll, wide && styles.scrollWide]}
            keyboardShouldPersistTaps="handled">
            {wide && (
              <View style={styles.welcome}>
                <Brand inverse />
                <Text style={styles.welcomeTitle}>Grow your skills.{'\n'}Prove them anywhere.</Text>
                <Text style={styles.welcomeText}>
                  A digital passport for agricultural qualifications: keep your certificates in one place and
                  share a verified link or QR code with employers.
                </Text>
                <View style={styles.illustrationFrame}>
                  <WelcomePhoto width={420} />
                </View>
              </View>
            )}

            <View style={[styles.card, wide && styles.cardWide]}>
              {!wide && (
                <View style={styles.compactHeader}>
                  <Brand compact />
                  <View style={styles.compactIllustration}>
                    <WelcomePhoto width={illustrationWidth} />
                  </View>
                </View>
              )}
              <Text style={styles.title} accessibilityRole="header">{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
              <OfflineBanner />
              {children}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  background: { flex: 1, backgroundColor: '#333333' },
  tint: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16, paddingVertical: 32 },
  scrollWide: { flexDirection: 'row', gap: 56, paddingHorizontal: 48 },
  welcome: { flex: 1, maxWidth: 480, gap: 18 },
  welcomeTitle: { color: '#ffffff', fontSize: 40, lineHeight: 46, fontWeight: '800', letterSpacing: -0.5 },
  welcomeText: { color: '#eeeeee', fontSize: 16, lineHeight: 24, maxWidth: 440 },
  illustrationFrame: { marginTop: 8, alignSelf: 'flex-start', borderRadius: 22, overflow: 'hidden' },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 6,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(12px)' } as object) : {}),
  },
  cardWide: { width: 420 },
  compactHeader: { alignItems: 'center', gap: 14, marginBottom: 18 },
  compactIllustration: { borderRadius: 18, overflow: 'hidden' },
  title: { fontSize: 28, fontWeight: '800', color: '#232323', marginBottom: 6 },
  subtitle: { color: '#5b5b5b', fontSize: 14, lineHeight: 20, marginBottom: 18 },
});
