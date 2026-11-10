import { StyleSheet, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

// Scanning these decorative codes shows plain text, not a web address.
const QR_TEXT = 'AgriSkills Passport: your farming skills, verified';

/** A link "node" network: dots joined by lines, like credentials shared by link. */
const NODES = [
  [120, 140], [260, 90], [380, 210], [230, 300], [90, 360], [520, 120], [640, 260], [520, 380],
  [880, 110], [1010, 230], [1150, 120], [1290, 260], [1180, 380], [960, 400], [760, 170],
] as const;
const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 4], [1, 5], [5, 6], [6, 7], [2, 7], [5, 14],
  [14, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [9, 13], [6, 14], [7, 13],
] as const;

/** Two interlocking rounded rectangles: a chain "link" icon. */
function ChainLink({ x, y, scale = 1, rotate = -35 }: { x: number; y: number; scale?: number; rotate?: number }) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <Rect x={-46} y={-14} width={56} height={28} rx={14} fill="none" stroke="#e6e6e6" strokeWidth={7} />
      <Rect x={-10} y={-14} width={56} height={28} rx={14} fill="none" stroke="#e6e6e6" strokeWidth={7} />
    </G>
  );
}

/**
 * Login background: black-to-grey sky with a network of linked dots, chain-link icons and
 * QR codes, over rolling farm fields. Drawn in SVG, so it is sharp on any screen.
 */
export function BackgroundArt() {
  const { width, height } = useWindowDimensions();
  const bigQr = Math.max(160, Math.min(width, height) * 0.34);
  const smallQr = bigQr * 0.55;

  return (
    <View style={styles.fill} pointerEvents="none" aria-hidden>
      <Svg width="100%" height="100%" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" />
            <Stop offset="0.6" stopColor="#141414" />
            <Stop offset="1" stopColor="#262626" />
          </LinearGradient>
          <LinearGradient id="field" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#4a4a4a" />
            <Stop offset="1" stopColor="#1c1c1c" />
          </LinearGradient>
        </Defs>

        <Rect x={0} y={0} width={1400} height={900} fill="url(#sky)" />

        {/* Linked network */}
        <G opacity={0.35}>
          {EDGES.map(([a, b]) => (
            <Line
              key={`${a}-${b}`}
              x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]}
              stroke="#d0d0d0" strokeWidth={2} strokeDasharray="6 8"
            />
          ))}
          {NODES.map(([x, y], index) => (
            <Circle key={index} cx={x} cy={y} r={index % 3 === 0 ? 9 : 6} fill="#ffffff" />
          ))}
        </G>

        <G opacity={0.28}>
          <ChainLink x={300} y={460} scale={1.4} />
          <ChainLink x={1080} y={520} scale={1.1} rotate={30} />
          <ChainLink x={700} y={80} scale={0.9} />
        </G>

        {/* Rolling fields with crop rows */}
        <Path d="M0 690 C 260 620, 520 650, 760 700 S 1200 740, 1400 660 L1400 900 L0 900 Z" fill="url(#field)" />
        <Path d="M0 770 C 300 720, 640 760, 900 800 S 1250 820, 1400 780 L1400 900 L0 900 Z" fill="#0d0d0d" />
        <G opacity={0.35} stroke="#bdbdbd" strokeWidth={3} fill="none">
          <Path d="M80 900 C 300 800, 500 760, 700 740" />
          <Path d="M300 900 C 480 820, 640 780, 760 745" />
          <Path d="M560 900 C 660 830, 760 790, 820 752" />
          <Path d="M900 900 C 900 840, 880 790, 860 758" />
          <Path d="M1200 900 C 1100 830, 1000 790, 900 762" />
        </G>
      </Svg>

      {/* Real (decorative) QR codes, tilted and faded */}
      <View style={[styles.qr, { top: height * 0.08, right: width * 0.06, transform: [{ rotate: '8deg' }] }]}>
        <QRCode value={QR_TEXT} size={bigQr} color="#000000" backgroundColor="#ffffff" quietZone={10} />
      </View>
      <View style={[styles.qr, styles.qrSmall, { bottom: height * 0.2, left: width * 0.04, transform: [{ rotate: '-10deg' }] }]}>
        <QRCode value={QR_TEXT} size={smallQr} color="#000000" backgroundColor="#ffffff" quietZone={8} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  qr: { position: 'absolute', opacity: 0.22, borderRadius: 14, overflow: 'hidden' },
  qrSmall: { opacity: 0.16 },
});
