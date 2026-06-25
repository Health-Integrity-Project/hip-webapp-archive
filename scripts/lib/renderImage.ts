import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const FONT_REGULAR = fileURLToPath(new URL('../assets/DejaVuSans.ttf', import.meta.url));
const FONT_BOLD = fileURLToPath(new URL('../assets/DejaVuSans-Bold.ttf', import.meta.url));
// Transparent book-icon logo (logo-sm-sq.png has a baked white box).
const LOGO_PATH = fileURLToPath(new URL('../../public/HIP_Logo-s-crop.png', import.meta.url));
const LOGO_ASPECT = 2025 / 1899; // source w/h

const WIDTH = 1080;
const HEIGHT = 1350; // Instagram 4:5 portrait
const CX = WIDTH / 2; // horizontal center — layout is center-aligned

// Brand palette sampled from the current Instagram template.
const BG = '#e8f4fb'; // pale blue background
const NAVY = '#1b3b5f'; // headings, body text, wordmark
const NAVY_SOFT = '#2a4a6b'; // "FOLLOW FOR MORE" / footer accents
const DIVIDER = '#bcd4e6';

// Status badge: fill + text color, keyed by the short label from
// statusBadge() in pickClaim.ts. Colors mirror the site's evidence_status
// convention (claims.astro): Supports=green, Disproves=red, Inconclusive=amber.
const BADGE_STYLE: Record<string, { fill: string; text: string }> = {
  Supported: { fill: '#22c55e', text: '#ffffff' }, // green
  Disproved: { fill: '#f15a2b', text: '#ffffff' }, // orange-red
  Inconclusive: { fill: '#fbd960', text: NAVY }, // amber/yellow
};

const SITE_URL = 'healthintegrityproject.org';

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!),
  );

/** Greedy word-wrap into lines no wider than maxChars (approximate, by char count). */
function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (line.length === 0) {
      line = w;
    } else if ((line + ' ' + w).length <= maxChars) {
      line += ' ' + w;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface Word {
  text: string;
  bold: boolean;
}

/** Parse `**bold**` markup into per-word tokens carrying a bold flag. */
function parseMarkup(text: string): Word[] {
  const words: Word[] = [];
  let bold = false;
  for (const seg of text.split(/(\*\*)/g)) {
    if (seg === '**') {
      bold = !bold;
      continue;
    }
    for (const w of seg.split(/\s+/).filter(Boolean)) {
      words.push({ text: w, bold });
    }
  }
  return words;
}

/** Greedy word-wrap on tokens; line width measured by visible char count. */
function wrapWords(words: Word[], maxChars: number): Word[][] {
  const lines: Word[][] = [];
  let line: Word[] = [];
  let len = 0;
  for (const w of words) {
    const add = (len === 0 ? 0 : 1) + w.text.length;
    if (len > 0 && len + add > maxChars) {
      lines.push(line);
      line = [];
      len = 0;
    }
    line.push(w);
    len += len === 0 ? w.text.length : add;
  }
  if (line.length) lines.push(line);
  return lines;
}

/** Render a wrapped subtitle line into <tspan>s, bold per token. */
function lineTspans(line: Word[]): string {
  return line
    .map((w, i) => {
      const weight = w.bold ? ' font-weight="bold"' : '';
      const lead = i === 0 ? '' : ' ';
      return `<tspan${weight}>${escapeXml(lead + w.text)}</tspan>`;
    })
    .join('');
}

export interface RenderInput {
  title: string;
  statusBadge: string;
  subtitle: string;
}

/** Build the post SVG and rasterize to a PNG buffer. */
export function renderPostImage({ title, statusBadge, subtitle }: RenderInput): Buffer {
  const badge = BADGE_STYLE[statusBadge] ?? { fill: '#6b7280', text: '#ffffff' };

  const logoData = readFileSync(LOGO_PATH).toString('base64');

  // --- Header: centered book icon + stacked wordmark (fixed band at top) ---
  const logoH = 150;
  const logoW = Math.round(logoH * LOGO_ASPECT);
  const logoY = 70;
  const wordmarkTopY = logoY + logoH + 60; // "HEALTH INTEGRITY"
  const wordmarkBotY = wordmarkTopY + 42; // "PROJECT"
  const headerBottom = wordmarkBotY + 30;

  // --- Footer: "FOLLOW FOR MORE" + divider + URL (fixed band at bottom) ---
  const followY = HEIGHT - 230;
  const dividerY = followY + 36;
  const urlY = HEIGHT - 90;
  const footerTop = followY - 60;

  // The middle band (title + badge + subtitle) is centered vertically between
  // header and footer. Auto-shrink the title font so the whole block fits.
  const subtitleLines = wrapWords(parseMarkup(subtitle), 34);
  const subtitleFont = 44;
  const subtitleLineH = 60;
  const subtitleH = subtitleLines.length * subtitleLineH;

  const badgeLabel = statusBadge;
  const badgeFont = 52;
  const badgeWidth = 120 + badgeLabel.length * (badgeFont * 0.62);
  const badgeHeight = 110;

  const gapTitleBadge = 70;
  const gapBadgeSub = 70;
  const bandTop = headerBottom;
  const bandHeight = footerTop - bandTop;

  // Fit the title: try max font, drop size until title+badge+subtitle fit the band.
  let titleFont = 92;
  let titleLines = wrap(title, 14);
  let titleLineH = Math.round(titleFont * 1.12);
  for (; titleFont >= 44; titleFont -= 2) {
    const charsPerLine = Math.max(8, Math.floor(960 / (titleFont * 0.6)));
    titleLines = wrap(title, charsPerLine);
    titleLineH = Math.round(titleFont * 1.12);
    const titleH = titleLines.length * titleLineH;
    const total = titleH + gapTitleBadge + badgeHeight + gapBadgeSub + subtitleH;
    if (total <= bandHeight) break;
  }

  const titleH = titleLines.length * titleLineH;
  const blockH = titleH + gapTitleBadge + badgeHeight + gapBadgeSub + subtitleH;
  const blockTop = bandTop + (bandHeight - blockH) / 2;

  // Title baseline starts one line-height down from the block top.
  const titleBaseTop = blockTop + titleFont * 0.82;
  const titleSvg = titleLines
    .map(
      (ln, i) =>
        `<text x="${CX}" y="${titleBaseTop + i * titleLineH}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="${titleFont}" fill="${NAVY}">${escapeXml(ln)}</text>`,
    )
    .join('\n');

  const badgeY = blockTop + titleH + gapTitleBadge;
  const badgeTextY = badgeY + badgeHeight / 2 + badgeFont * 0.36;

  const subtitleStartY = badgeY + badgeHeight + gapBadgeSub + subtitleFont * 0.82;
  const subtitleSvg = subtitleLines
    .map(
      (ln, i) =>
        `<text x="${CX}" y="${subtitleStartY + i * subtitleLineH}" text-anchor="middle" font-family="DejaVu Sans" font-size="${subtitleFont}" fill="${NAVY}">${lineTspans(ln)}</text>`,
    )
    .join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>

  <!-- Header: book icon + stacked wordmark, centered -->
  <image x="${CX - logoW / 2}" y="${logoY}" width="${logoW}" height="${logoH}" href="data:image/png;base64,${logoData}"/>
  <text x="${CX}" y="${wordmarkTopY}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="40" letter-spacing="1" fill="${NAVY}">HEALTH INTEGRITY</text>
  <text x="${CX}" y="${wordmarkBotY}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="26" letter-spacing="4" fill="#e8951e">PROJECT</text>

  <!-- Title -->
  ${titleSvg}

  <!-- Status badge -->
  <rect x="${CX - badgeWidth / 2}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}" rx="${badgeHeight / 2}" fill="${badge.fill}"/>
  <text x="${CX}" y="${badgeTextY}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="${badgeFont}" fill="${badge.text}">${escapeXml(badgeLabel)}</text>

  <!-- Subtitle -->
  ${subtitleSvg}

  <!-- Footer -->
  <text x="${CX}" y="${followY}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="24" letter-spacing="1" fill="${NAVY_SOFT}">VISIT THE APP TO LEARN ABOUT THESE STUDIES</text>
  <line x1="${CX - 90}" y1="${dividerY}" x2="${CX + 90}" y2="${dividerY}" stroke="${DIVIDER}" stroke-width="3" stroke-linecap="round"/>
  <text x="${CX}" y="${urlY}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="46" fill="${NAVY}">${SITE_URL}</text>
</svg>`;

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
    font: {
      fontFiles: [FONT_REGULAR, FONT_BOLD],
      loadSystemFonts: false,
      defaultFontFamily: 'DejaVu Sans',
    },
  });
  return resvg.render().asPng();
}
