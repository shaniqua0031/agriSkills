import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * Animated welcome picture: the hand moves the phone over the certificate's QR code, a scan line
 * sweeps the phone screen, then a green tick and a "Verified" badge appear. Loops.
 *
 * Built from two layers cut from the original 1200x690 artwork (welcome-qr-verify.webp):
 * the certificate background and the hand-with-phone. All positions below are in that
 * 1200x690 pixel space and are scaled to the rendered width.
 * When the device asks for reduced motion, the finished (verified) picture is shown without movement.
 */

const ART_W = 1200;
const ART_H = 690;

// How far the hand travels so the phone's viewfinder sits over the certificate's QR code.
const MOVE_X = -218;
const MOVE_Y = 22;

// Phone viewfinder (inside the hand layer, before moving).
const VIEW_LEFT = 766;
const VIEW_TOP = 362;
const VIEW_SIZE = 122;
const VIEW_CENTER_X = VIEW_LEFT + VIEW_SIZE / 2;
const VIEW_CENTER_Y = VIEW_TOP + VIEW_SIZE / 2;
const TICK_SIZE = 116;

// "Verified" badge, placed on the background to the right of the phone's final position.
const BADGE_LEFT = 885;
const BADGE_TOP = 292;

const useNativeDriver = Platform.OS !== 'web';

function Check({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12.5l4.2 4.2L19 7" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export function ScanIllustration({ width }: { width: number }) {
  const s = width / ART_W;
  const height = Math.round(ART_H * s);

  const [reduceMotion, setReduceMotion] = useState(false);
  const move = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;
  const scanOpacity = useRef(new Animated.Value(0)).current;
  const verified = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => mounted && setReduceMotion(value))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      move.setValue(1);
      scanOpacity.setValue(0);
      verified.setValue(1);
      return;
    }

    const t = (value: Animated.Value, toValue: number, duration: number, easing = Easing.inOut(Easing.cubic)) =>
      Animated.timing(value, { toValue, duration, easing, useNativeDriver });

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        // Bring the phone over the QR code.
        t(move, 1, 1100),
        // Scan: the line sweeps down and up twice.
        t(scanOpacity, 1, 150),
        t(scan, 1, 650, Easing.inOut(Easing.quad)),
        t(scan, 0, 650, Easing.inOut(Easing.quad)),
        t(scan, 1, 650, Easing.inOut(Easing.quad)),
        t(scanOpacity, 0, 150),
        // Approved: tick on the phone and the "Verified" badge.
        Animated.spring(verified, { toValue: 1, friction: 5, tension: 120, useNativeDriver }),
        Animated.delay(1700),
        // Reset and move back.
        Animated.parallel([t(verified, 0, 300), t(move, 0, 1000)]),
        t(scan, 0, 1),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, move, scan, scanOpacity, verified]);

  const handStyle = {
    transform: [
      { translateX: move.interpolate({ inputRange: [0, 1], outputRange: [0, MOVE_X * s] }) },
      { translateY: move.interpolate({ inputRange: [0, 1], outputRange: [0, MOVE_Y * s] }) },
    ],
  };
  const scanLineStyle = {
    opacity: scanOpacity,
    transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [0, (VIEW_SIZE - 4) * s] }) }],
  };
  const popStyle = {
    opacity: verified.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
    transform: [{ scale: verified.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
  };

  return (
    <View
      style={{ width, height }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="A phone scanning the QR code on a certificate, which shows as verified">
      <Image
        source={require('@/assets/images/welcome-scan-bg.png')}
        style={[StyleSheet.absoluteFill, { width, height }]}
        resizeMode="cover"
      />

      <Animated.View style={[StyleSheet.absoluteFill, handStyle]} pointerEvents="none">
        <Image source={require('@/assets/images/welcome-scan-hand.png')} style={{ width, height }} resizeMode="cover" />

        {/* Red scan line sweeping the viewfinder. */}
        <Animated.View
          style={[
            styles.scanLine,
            { left: (VIEW_LEFT - 6) * s, top: VIEW_TOP * s, width: (VIEW_SIZE + 12) * s, height: Math.max(2, 4 * s) },
            scanLineStyle,
          ]}
        />

        {/* Green tick on the phone screen once approved. */}
        <Animated.View
          style={[
            styles.tick,
            {
              left: (VIEW_CENTER_X - TICK_SIZE / 2) * s,
              top: (VIEW_CENTER_Y - TICK_SIZE / 2) * s,
              width: TICK_SIZE * s,
              height: TICK_SIZE * s,
              borderRadius: (TICK_SIZE / 2) * s,
              borderWidth: Math.max(2, 8 * s),
            },
            popStyle,
          ]}>
          <Check size={TICK_SIZE * 0.62 * s} color="#ffffff" />
        </Animated.View>
      </Animated.View>

      {/* "Verified" badge beside the phone. */}
      <Animated.View
        style={[
          styles.badge,
          {
            left: BADGE_LEFT * s,
            top: BADGE_TOP * s,
            paddingVertical: 12 * s,
            paddingHorizontal: 18 * s,
            borderRadius: 10 * s,
            gap: 12 * s,
          },
          popStyle,
        ]}>
        <View style={[styles.badgeDot, { width: 36 * s, height: 36 * s, borderRadius: 18 * s }]}>
          <Check size={26 * s} color="#ffffff" />
        </View>
        <Text style={[styles.badgeText, { fontSize: 34 * s, lineHeight: 40 * s }]}>Verified</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scanLine: {
    position: 'absolute',
    backgroundColor: '#e53935',
    borderRadius: 2,
    shadowColor: '#e53935',
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  tick: {
    position: 'absolute',
    backgroundColor: '#22a447',
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  badge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  badgeDot: { backgroundColor: '#22a447', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#1b1b1b', fontWeight: '500' },
});
