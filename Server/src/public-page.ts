// Shared pieces of the public pages an employer opens from a share link or QR code
// (/verify/<token> for one credential, /profile/<token> for a curated profile).

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

/** Badge colours for a verification result: green for verified, red for failures, amber otherwise. */
export function statusPalette(result: string) {
  return result === 'VERIFIED'
    ? { background: '#e5f4e9', color: '#1d7040' }
    : result === 'REVOKED' || result === 'INVALID' || result === 'NOT_FOUND'
      ? { background: '#fbe9e7', color: '#9a352c' }
      : result === 'PENDING'
        ? { background: '#e8eefb', color: '#385a96' }
        : { background: '#fff3df', color: '#9a5c15' };
}

export function formatPageDate(value: string) {
  return new Date(value).toLocaleDateString('en-ZA');
}

export const PAGE_CSS = '*{box-sizing:border-box}body{margin:0;padding:24px;background:#f3f7f3;color:#173424;font-family:Arial,sans-serif}.card{max-width:660px;margin:5vh auto;background:#fff;border:1px solid #e1e9e2;border-radius:20px;padding:30px;box-shadow:0 12px 30px rgba(23,52,36,.07)}.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#34754b}.badge{display:inline-block;margin-top:24px;padding:8px 12px;border-radius:999px;font-size:12px;font-weight:700}h1{font-size:28px;line-height:1.2;margin:14px 0 10px}.message{color:#4c6253;line-height:1.6;margin:0 0 18px}.field{border-top:1px solid #edf1ed;padding:13px 0}.label{display:block;color:#718076;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:5px}.value{color:#243b2c;font-size:15px;line-height:1.5}.skills{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.skill{background:#edf5ef;border-radius:999px;color:#315b3d;padding:7px 10px;font-size:12px}.note{border-top:1px solid #edf1ed;color:#758078;font-size:12px;line-height:1.5;margin-top:20px;padding-top:16px}@media(max-width:520px){body{padding:14px}.card{padding:22px;margin:3vh auto}h1{font-size:24px}}';

export const INTEGRITY_NOTE = "Checked just now against the issuer's records and an HMAC-SHA256 integrity signature. This is a simplified project scheme, not a W3C Verifiable Credential or Open Badge.";

export function badge(label: string, result: string) {
  const palette = statusPalette(result);
  return `<div class="badge" style="background:${palette.background};color:${palette.color}">${escapeHtml(label)}</div>`;
}

export function field(label: string, valueHtml: string) {
  return `<div class="field"><span class="label">${escapeHtml(label)}</span><span class="value">${valueHtml}</span></div>`;
}

export function skillsField(skills: string[]) {
  const chips = skills.map((skill) => `<span class="skill">${escapeHtml(skill)}</span>`).join('');
  return `<div class="field"><span class="label">Skills</span><div class="skills">${chips}</div></div>`;
}

export function renderPublicPage(options: { title: string; extraCss?: string; body: string }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex"><meta name="theme-color" content="#f3f7f3"><title>${escapeHtml(options.title)} · AgriSkills Passport</title><style>${PAGE_CSS}${options.extraCss ?? ''}</style></head><body><main class="card"><div class="brand">AgriSkills Passport</div>${options.body}<p class="note">${escapeHtml(INTEGRITY_NOTE)}</p></main></body></html>`;
}
