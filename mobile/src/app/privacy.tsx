import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Brand } from '@/components/auth/brand';

// Plain-language privacy notice (POPIA basics). It describes what this app actually stores.
// This is a student prototype: it is not a formal legal compliance statement.
const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: 'What we collect and why',
    items: [
      'Account details: your name, email address, role (learner or issuer) and a scrambled (hashed) version of your password, so you can log in. We never store your actual password.',
      'Dates: when you signed up and accepted this notice, so we can show that you agreed.',
      'Credentials: the qualifications issued to you (title, skills, dates, issuer), which are the purpose of the passport.',
      'Skills evidence you choose to add: notes, photos, supervisor name and contact. A location stamp is only saved if you switch it on for that piece of evidence.',
      'Share links: when you share a credential, we keep a record that the link exists and when it was checked (date, time and result), so you can see and turn off your links.',
    ],
  },
  {
    title: 'Who can see it',
    items: [
      'You can see all of your own information.',
      'An issuer sees the credentials they issued, including your name and email address.',
      'Someone you send a share link to sees only that one credential: your name, the title, issuer, dates and skills. They never see your email, other credentials or evidence photos.',
      'Evidence photos are private and are only shown to you, through links that expire after 10 minutes.',
    ],
  },
  {
    title: 'Where it is stored',
    items: [
      'Your information is stored with service providers: the database (Neon, with servers in the United States), photo storage (Cloudinary) and email delivery for password-reset links (Gmail or Resend). Information may therefore be processed outside South Africa.',
      'Your login is saved on this device only if you tick “Remember me”. On a phone it is kept in the device’s secure storage.',
    ],
  },
  {
    title: 'Your choices and rights',
    items: [
      'You can delete your skills evidence at any time from the Evidence screen, and turn off any share link from the Share screen.',
      'You may ask to see, correct or delete your personal information, or object to how it is used. Self-service account deletion is not available yet, so please ask the AgriSkills Passport team.',
      'You can complain to South Africa’s Information Regulator if you believe your information has been misused.',
    ],
  },
];

export default function PrivacyScreen() {
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.page}>
        <Pressable onPress={goBack} accessibilityRole="button" style={styles.back} hitSlop={6}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Brand compact />
        <Text style={styles.title} accessibilityRole="header">Privacy notice</Text>
        <Text style={styles.intro}>
          AgriSkills Passport keeps a digital record of your agricultural skills that you control. This notice explains,
          in plain language, what information the app keeps, why, and what you can do about it.
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.heading} accessibilityRole="header">{section.title}</Text>
            {section.items.map((item) => (
              <View key={item} style={styles.item}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.footnote}>
          AgriSkills Passport is a student project prototype. This notice describes how the prototype works; it is not a
          formal legal compliance statement. Contact details for the responsible party will be added before public release.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 48, alignItems: 'center' },
  page: { width: '100%', maxWidth: 720, gap: 14 },
  back: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: '#1e1e1e', fontWeight: '700', fontSize: 15 },
  title: { fontSize: 28, fontWeight: '800', color: '#232323', marginTop: 4 },
  intro: { color: '#5b5b5b', fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, gap: 8 },
  heading: { fontSize: 17, fontWeight: '800', color: '#353535', marginBottom: 2 },
  item: { flexDirection: 'row', gap: 8 },
  bullet: { color: '#1e1e1e', fontSize: 15, lineHeight: 22, fontWeight: '800' },
  itemText: { flex: 1, color: '#252525', fontSize: 14, lineHeight: 21 },
  footnote: { color: '#666666', fontSize: 12, lineHeight: 18, marginTop: 4 },
});
