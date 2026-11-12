import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { LearnerCredential } from '@/hooks/use-learner-credentials';
import { qrSvg } from '@/lib/qr-svg';

// PDFs are built as HTML on the device, so the passport PDF also works offline.
// - Phone: saved as a PDF file, then the share sheet opens (save to Files, WhatsApp, email…).
// - Web:   the browser's print window opens; choose "Save as PDF" as the printer.

/** A verification link printed as a QR code. Missing when the PDF was made offline. */
export type PdfVerification = { url: string; expiresAt: string | null } | null;

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Valid',
  EXPIRED: 'Expired',
  REVOKED: 'Revoked',
  PENDING: 'Pending',
};

const BRAND_MARK = `<svg width="40" height="40" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#1e1e1e"/><circle cx="24" cy="24" r="18.5" fill="none" stroke="#e2e2e2" stroke-width="1.5" stroke-dasharray="2.5 2.5"/><path d="M24 35V21" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M24 25c0-6 4.5-9.5 10-9.5 0 6-4.5 9.5-10 9.5Z" fill="#d8d8d8"/><path d="M24 29c0-5-3.8-8-8.5-8 0 5 3.8 8 8.5 8Z" fill="#bfbfbf"/><path d="M17 35h14" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`;

const BASE_CSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e1e1e; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand b { font-size: 17px; letter-spacing: -0.2px; }
  .brand span { display: block; font-size: 10px; color: #5b5b5b; font-weight: 600; }
  .muted { color: #5b5b5b; }
  .small { font-size: 10px; line-height: 1.45; }
  .verify { display: flex; gap: 16px; align-items: center; border: 1px solid #d6d6d6; border-radius: 12px; padding: 12px 14px; }
  .verify h3 { margin: 0 0 4px; font-size: 13px; }
  .verify p { margin: 0 0 4px; }
  .link { font-size: 9px; word-break: break-all; color: #3a3a3a; }
`;

function verificationBlock(verification: PdfVerification, what: string) {
  if (!verification) {
    return `<div class="verify"><div><h3>How to check ${what}</h3><p class="small muted">This PDF was made without an internet connection, so it has no QR code. Ask the learner to share a verification link from the AgriSkills Passport app.</p></div></div>`;
  }
  return `<div class="verify">${qrSvg(verification.url, 116)}<div><h3>Scan to verify ${what}</h3><p class="small muted">The QR code opens a live check of the issuer's digital signature and the current status. No account is needed.</p><p class="link">${escape(verification.url)}</p>${verification.expiresAt ? `<p class="small muted">Link valid until ${formatDate(verification.expiresAt)}.</p>` : ''}</div></div>`;
}

export function certificateHtml(learnerName: string, credential: LearnerCredential, verification: PdfVerification) {
  const skills = credential.skills.length
    ? `<p class="skills">${credential.skills.map((skill) => `<span>${escape(skill)}</span>`).join('')}</p>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(credential.title)} certificate</title><style>${BASE_CSS}
    .sheet { border: 3px solid #1e1e1e; border-radius: 6px; padding: 10px; min-height: 262mm; }
    .inner { border: 1px solid #bdbdbd; border-radius: 3px; padding: 28px 34px; min-height: 254mm; display: flex; flex-direction: column; }
    .kicker { margin: 46px 0 0; text-align: center; letter-spacing: 4px; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #5b5b5b; }
    h1 { text-align: center; font-size: 34px; margin: 8px 0 30px; letter-spacing: -0.5px; }
    .lead { text-align: center; margin: 0; font-size: 13px; color: #5b5b5b; }
    .name { text-align: center; font-size: 30px; font-weight: 800; margin: 8px auto 6px; padding-bottom: 8px; border-bottom: 1.5px solid #1e1e1e; max-width: 80%; }
    .title { text-align: center; font-size: 22px; font-weight: 700; margin: 8px 0 4px; }
    .category { text-align: center; margin: 0; font-size: 12px; color: #5b5b5b; }
    .skills { text-align: center; margin: 18px 0 0; }
    .skills span { display: inline-block; border: 1px solid #bdbdbd; border-radius: 999px; padding: 3px 10px; margin: 3px; font-size: 11px; }
    .facts { display: flex; justify-content: center; gap: 34px; margin: 34px 0 0; }
    .facts div { text-align: center; }
    .facts dt { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #5b5b5b; }
    .facts dd { margin: 4px 0 0; font-size: 13px; font-weight: 700; }
    .spacer { flex: 1; min-height: 30px; }
  </style></head><body><div class="sheet"><div class="inner">
    <div class="brand">${BRAND_MARK}<div><b>AgriSkills Passport</b><span>Your farming skills, verified</span></div></div>
    <p class="kicker">${escape(credential.category || 'Credential')}</p>
    <h1>Certificate of Achievement</h1>
    <p class="lead">This certifies that</p>
    <p class="name">${escape(learnerName)}</p>
    <p class="lead">has successfully been awarded</p>
    <p class="title">${escape(credential.title)}</p>
    ${skills}
    <dl class="facts">
      <div><dt>Issued by</dt><dd>${escape(credential.issuer?.name ?? 'Issuer')}</dd></div>
      <div><dt>Issue date</dt><dd>${formatDate(credential.issueDate)}</dd></div>
      <div><dt>Valid until</dt><dd>${credential.expiryDate ? formatDate(credential.expiryDate) : 'No expiry'}</dd></div>
    </dl>
    <div class="spacer"></div>
    ${verificationBlock(verification, 'this certificate')}
    <p class="small muted" style="margin:12px 0 0">Reference ${escape(credential.publicId)} · Downloaded ${formatDate(new Date().toISOString())} · A printed copy is only a summary: the QR check shows whether the credential is still valid.</p>
  </div></div></body></html>`;
}

export function passportHtml(
  learnerName: string,
  credentials: LearnerCredential[],
  verification: PdfVerification,
  offlineSavedAt: string | null,
) {
  const valid = credentials.filter((credential) => credential.status === 'ACTIVE');
  const skills = [...new Set(valid.flatMap((credential) => credential.skills))].sort((a, b) => a.localeCompare(b));
  const rows = credentials
    .map((credential) => `<tr>
      <td><b>${escape(credential.title)}</b><div class="muted">${escape(credential.category || '')}</div></td>
      <td>${escape(credential.issuer?.name ?? 'Issuer')}</td>
      <td>${formatDate(credential.issueDate)}</td>
      <td>${credential.expiryDate ? formatDate(credential.expiryDate) : 'No expiry'}</td>
      <td><span class="status status-${escape(credential.status)}">${escape(STATUS_LABELS[credential.status] ?? credential.status)}</span></td>
    </tr>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(learnerName)} – Skills Passport</title><style>${BASE_CSS}
    header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1e1e1e; padding-bottom: 12px; }
    h1 { font-size: 26px; margin: 18px 0 2px; }
    .stats { display: flex; gap: 10px; margin: 14px 0 18px; }
    .stats div { flex: 1; background: #1e1e1e; color: #fff; border-radius: 10px; padding: 10px 12px; }
    .stats b { display: block; font-size: 20px; }
    .stats span { font-size: 10px; color: #cfcfcf; }
    h2 { font-size: 14px; margin: 18px 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; color: #5b5b5b; border-bottom: 1px solid #bdbdbd; padding: 6px 6px; }
    td { border-bottom: 1px solid #e4e4e4; padding: 7px 6px; vertical-align: top; }
    td .muted { font-size: 10px; margin-top: 2px; }
    .status { font-weight: 700; font-size: 10px; }
    .status-ACTIVE::before { content: '✓ '; }
    .status-REVOKED, .status-EXPIRED { color: #9a352c; }
    .chips span { display: inline-block; border: 1px solid #bdbdbd; border-radius: 999px; padding: 2px 9px; margin: 0 4px 5px 0; font-size: 10px; }
    .note { background: #fff4d6; border-radius: 8px; padding: 8px 10px; margin-top: 12px; }
  </style></head><body>
    <header>
      <div class="brand">${BRAND_MARK}<div><b>AgriSkills Passport</b><span>Your farming skills, verified</span></div></div>
      <p class="small muted" style="margin:0">Made ${formatDate(new Date().toISOString())}</p>
    </header>
    <h1>${escape(learnerName)}</h1>
    <p class="muted" style="margin:0;font-size:12px">Skills passport · qualifications, short courses and skills</p>
    <div class="stats">
      <div><b>${credentials.length}</b><span>Credentials</span></div>
      <div><b>${valid.length}</b><span>Valid now</span></div>
      <div><b>${skills.length}</b><span>Skills</span></div>
    </div>
    <h2>Credentials</h2>
    ${credentials.length ? `<table><thead><tr><th>Credential</th><th>Issued by</th><th>Issued</th><th>Expires</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="muted">No credentials yet.</p>'}
    ${skills.length ? `<h2>Skills</h2><p class="chips">${skills.map((skill) => `<span>${escape(skill)}</span>`).join('')}</p>` : ''}
    <h2>Verification</h2>
    ${verificationBlock(verification, valid.length > 1 ? 'these credentials' : 'this credential')}
    ${offlineSavedAt ? `<p class="small note">Made offline from the copy saved ${formatDate(offlineSavedAt)}. Statuses may have changed since then.</p>` : ''}
  </body></html>`;
}

/** Saves and shares the PDF on a phone; opens the print window ("Save as PDF") on the web. */
export async function outputPdf(html: string, dialogTitle: string) {
  if (Platform.OS === 'web') {
    printHtmlOnWeb(html);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
  } else {
    await Print.printAsync({ uri });
  }
}

// expo-print on the web prints the whole app page, so print the document from a hidden frame instead.
function printHtmlOnWeb(html: string) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const frameWindow = frame.contentWindow!;
  frameWindow.document.open();
  frameWindow.document.write(html);
  frameWindow.document.close();
  const print = () => {
    frameWindow.focus();
    frameWindow.print();
    // Remove the frame after the print window closes.
    setTimeout(() => frame.remove(), 1000);
  };
  if (frameWindow.document.readyState === 'complete') setTimeout(print, 50);
  else frameWindow.addEventListener('load', print, { once: true });
}
