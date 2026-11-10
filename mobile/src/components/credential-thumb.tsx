import { Image, StyleSheet } from 'react-native';

import { credentialImage } from '@/lib/credential-images';

/**
 * Small topic picture shown beside a credential, chosen from its title. It is decorative (the
 * title sits next to it), so screen readers skip it and read the card by its title.
 */
export function CredentialThumb({ title, size = 64 }: { title: string; size?: number }) {
  const { source } = credentialImage(title);
  return (
    <Image
      source={source}
      style={[styles.thumb, { width: size, height: size }]}
      resizeMode="cover"
      accessible={false}
      aria-hidden
      alt=""
      accessibilityIgnoresInvertColors
    />
  );
}

/** Wide version of the topic picture for the top of a credential's details page. */
export function CredentialBanner({ title }: { title: string }) {
  const { label, source } = credentialImage(title);
  return (
    <Image
      source={source}
      style={styles.banner}
      resizeMode="cover"
      accessibilityLabel={`${label} picture`}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  thumb: { borderRadius: 12, backgroundColor: '#eaeaea' },
  banner: { width: '100%', height: 170, borderRadius: 16, backgroundColor: '#eaeaea', marginBottom: 16 },
});
