// Draws a QR code as an SVG string, for PDFs made from HTML (react-native-qrcode-svg only draws
// on screen). Uses the same "qrcode" library that react-native-qrcode-svg is built on.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require('qrcode/lib/core/qrcode') as {
  create: (text: string, options: { errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' }) => {
    modules: { size: number; get: (row: number, col: number) => number | boolean };
  };
};

export function qrSvg(text: string, sizePx = 132) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const quiet = 2; // white border, in modules
  const total = modules.size + quiet * 2;
  let path = '';
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (modules.get(row, col)) path += `M${col + quiet} ${row + quiet}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${total}" height="${total}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
