/**
 * One-off: 5-slide Instagram carousel "3 words in health headlines",
 * rendered in the same visual style as the weekly post (renderImage.ts):
 * pale-blue bg, navy text, amber accent, logo+wordmark header, URL footer.
 *
 * Run: npx tsx scripts/render-definitions-carousel.ts <outDir>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const FONT_REGULAR = fileURLToPath(new URL('./assets/DejaVuSans.ttf', import.meta.url));
const FONT_BOLD = fileURLToPath(new URL('./assets/DejaVuSans-Bold.ttf', import.meta.url));
const LOGO_PATH = fileURLToPath(new URL('../public/HIP_Logo-s-crop.png', import.meta.url));
const LOGO_ASPECT = 2025 / 1899;

const WIDTH = 1080;
// 1350 = Instagram 4:5 post (default); SLIDE_H=1920 renders 9:16 reel frames.
const HEIGHT = Number(process.env.SLIDE_H ?? 1350);
const CX = WIDTH / 2;

const BG = '#e8f4fb';
const NAVY = '#1b3b5f';
const NAVY_SOFT = '#2a4a6b';
const DIVIDER = '#bcd4e6';
const AMBER = '#e8951e';

const SITE_URL = 'healthintegrityproject.org';

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!),
  );

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (line.length === 0) line = w;
    else if ((line + ' ' + w).length <= maxChars) line += ' ' + w;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface Token {
  text: string;
  hl: boolean;
}

/** Parse `**highlighted**` markup into per-word tokens (bold + amber). */
function parseMarkup(text: string): Token[] {
  const tokens: Token[] = [];
  let hl = false;
  for (const seg of text.split(/(\*\*)/g)) {
    if (seg === '**') {
      hl = !hl;
      continue;
    }
    for (const w of seg.split(/\s+/).filter(Boolean)) {
      tokens.push({ text: w, hl });
    }
  }
  return tokens;
}

/** Greedy word-wrap on tokens; line width measured by visible char count. */
function wrapTokens(tokens: Token[], maxChars: number): Token[][] {
  const lines: Token[][] = [];
  let line: Token[] = [];
  let len = 0;
  for (const t of tokens) {
    const add = (len === 0 ? 0 : 1) + t.text.length;
    if (len > 0 && len + add > maxChars) {
      lines.push(line);
      line = [];
      len = 0;
    }
    line.push(t);
    len += len === 0 ? t.text.length : add;
  }
  if (line.length) lines.push(line);
  return lines;
}

function lineTspans(line: Token[]): string {
  return line
    .map((t, i) => {
      const attrs = t.hl ? ` font-weight="bold" fill="${AMBER}"` : '';
      const lead = i === 0 ? '' : ' ';
      return `<tspan${attrs}>${escapeXml(lead + t.text)}</tspan>`;
    })
    .join('');
}

// --- Block-based slide layout: each slide is a vertical stack of blocks,
// centered in the band between the fixed header and footer. ---

type Block =
  | { kind: 'kicker'; text: string } // small amber all-caps label
  | { kind: 'title'; text: string; size?: number } // big bold navy
  | { kind: 'body'; text: string; size?: number; bold?: boolean; color?: string }
  | { kind: 'ask'; text: string } // the question: divider + amber ASK label + bold navy text
  | { kind: 'numbered'; n: number; text: string } // closing-card list row
  | { kind: 'gap'; h: number };

interface Laid {
  h: number;
  render: (y: number) => string; // y = top of block
}

function layoutBlock(b: Block): Laid {
  switch (b.kind) {
    case 'gap':
      return { h: b.h, render: () => '' };
    case 'kicker': {
      const size = 30;
      return {
        h: size,
        render: (y) =>
          `<text x="${CX}" y="${y + size * 0.82}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="${size}" letter-spacing="4" fill="${AMBER}">${escapeXml(b.text)}</text>`,
      };
    }
    case 'title': {
      const size = b.size ?? 76;
      const lineH = Math.round(size * 1.15);
      const charsPerLine = Math.max(8, Math.floor(960 / (size * 0.6)));
      const lines = wrap(b.text, charsPerLine);
      return {
        h: lines.length * lineH,
        render: (y) =>
          lines
            .map(
              (ln, i) =>
                `<text x="${CX}" y="${y + size * 0.82 + i * lineH}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="${size}" fill="${NAVY}">${escapeXml(ln)}</text>`,
            )
            .join('\n'),
      };
    }
    case 'body': {
      const size = b.size ?? 40;
      const lineH = Math.round(size * 1.4);
      const charsPerLine = Math.max(8, Math.floor(920 / (size * 0.55)));
      const lines = wrapTokens(parseMarkup(b.text), charsPerLine);
      const weight = b.bold ? ' font-weight="bold"' : '';
      const fill = b.color ?? NAVY;
      return {
        h: lines.length * lineH,
        render: (y) =>
          lines
            .map(
              (ln, i) =>
                `<text x="${CX}" y="${y + size * 0.82 + i * lineH}" text-anchor="middle" font-family="DejaVu Sans"${weight} font-size="${size}" fill="${fill}">${lineTspans(ln)}</text>`,
            )
            .join('\n'),
      };
    }
    case 'ask': {
      const size = 46;
      const lineH = Math.round(size * 1.25);
      const lines = wrap(b.text, 34);
      const labelSize = 28;
      const gapDividerLabel = 30;
      const gapLabelText = 24;
      const h =
        3 + gapDividerLabel + labelSize + gapLabelText + lines.length * lineH + gapDividerLabel + 3;
      return {
        h,
        render: (y) => {
          const labelY = y + 3 + gapDividerLabel + labelSize * 0.82;
          const textTop = y + 3 + gapDividerLabel + labelSize + gapLabelText;
          const bottomLineY = y + h - 3;
          return (
            `<line x1="${CX - 90}" y1="${y + 1.5}" x2="${CX + 90}" y2="${y + 1.5}" stroke="${DIVIDER}" stroke-width="3" stroke-linecap="round"/>\n` +
            `<text x="${CX}" y="${labelY}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="${labelSize}" letter-spacing="5" fill="${AMBER}">ASK</text>\n` +
            lines
              .map(
                (ln, i) =>
                  `<text x="${CX}" y="${textTop + size * 0.82 + i * lineH}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="${size}" fill="${NAVY}">${escapeXml(ln)}</text>`,
              )
              .join('\n') +
            `\n<line x1="${CX - 90}" y1="${bottomLineY}" x2="${CX + 90}" y2="${bottomLineY}" stroke="${DIVIDER}" stroke-width="3" stroke-linecap="round"/>`
          );
        },
      };
    }
    case 'numbered': {
      const size = 40;
      const lineH = Math.round(size * 1.35);
      const r = 34;
      const textX = CX - 380 + r * 2 + 30;
      const maxChars = 34;
      const lines = wrap(b.text, maxChars);
      const h = Math.max(r * 2, lines.length * lineH);
      return {
        h,
        render: (y) =>
          `<circle cx="${CX - 380 + r}" cy="${y + r}" r="${r}" fill="${AMBER}"/>\n` +
          `<text x="${CX - 380 + r}" y="${y + r + 13}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="38" fill="#ffffff">${b.n}</text>\n` +
          lines
            .map(
              (ln, i) =>
                `<text x="${textX}" y="${y + size * 0.82 + i * lineH}" font-family="DejaVu Sans" font-weight="bold" font-size="${size}" fill="${NAVY}">${escapeXml(ln)}</text>`,
            )
            .join('\n'),
      };
    }
  }
}

function renderSlide(blocks: Block[], footerText: string): Buffer {
  const logoData = readFileSync(LOGO_PATH).toString('base64');

  // Header (weekly-post style, tightened to give the content band more room).
  const logoH = 130;
  const logoW = Math.round(logoH * LOGO_ASPECT);
  const logoY = 36;
  const wordmarkTopY = logoY + logoH + 46;
  const wordmarkBotY = wordmarkTopY + 40;
  const headerBottom = wordmarkBotY + 16;

  // Footer (same geometry as the weekly post).
  const followY = HEIGHT - 200;
  const dividerY = followY + 34;
  const urlY = HEIGHT - 76;
  const footerTop = followY - 50;

  let laid = blocks.map(layoutBlock);
  let blockH = laid.reduce((s, l) => s + l.h, 0);
  const bandTop = headerBottom;
  const bandHeight = footerTop - bandTop;
  // Start near the header (capped top gap) rather than dead-center: slides
  // with less text otherwise leave a large empty band under the wordmark.
  let topGap = Math.min(48, Math.max(0, (bandHeight - blockH) / 2));
  // Tall (reel) canvas: stretch the gap blocks so the content spans the full
  // frame instead of leaving big empty bands above and below.
  if (HEIGHT > 1350) {
    const gapTotal = blocks.reduce((s, b) => s + (b.kind === 'gap' ? b.h : 0), 0);
    const extra = bandHeight - blockH - 96; // keep ~48px at top and bottom
    if (extra > 0 && gapTotal > 0) {
      const factor = Math.min(3, 1 + extra / gapTotal);
      laid = blocks.map((b) =>
        b.kind === 'gap' ? layoutBlock({ ...b, h: Math.round(b.h * factor) }) : layoutBlock(b),
      );
      blockH = laid.reduce((s, l) => s + l.h, 0);
      topGap = Math.max(48, (bandHeight - blockH) / 2);
    }
  }
  let y = bandTop + topGap;

  const middle = laid
    .map((l) => {
      const svg = l.render(y);
      y += l.h;
      return svg;
    })
    .join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>

  <image x="${CX - logoW / 2}" y="${logoY}" width="${logoW}" height="${logoH}" href="data:image/png;base64,${logoData}"/>
  <text x="${CX}" y="${wordmarkTopY}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="36" letter-spacing="1" fill="${NAVY}">HEALTH INTEGRITY</text>
  <text x="${CX}" y="${wordmarkBotY}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="24" letter-spacing="4" fill="${AMBER}">PROJECT</text>

  ${middle}

  <text x="${CX}" y="${followY}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="24" letter-spacing="1" fill="${NAVY_SOFT}">${escapeXml(footerText)}</text>
  <line x1="${CX - 90}" y1="${dividerY}" x2="${CX + 90}" y2="${dividerY}" stroke="${DIVIDER}" stroke-width="3" stroke-linecap="round"/>
  <text x="${CX}" y="${urlY}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="42" fill="${NAVY}">${SITE_URL}</text>
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

// --- Slide content ---

const slides: { name: string; footer: string; blocks: Block[] }[] = [
  {
    name: 'slide-1-cover',
    footer: 'FOLLOW FOR MORE',
    blocks: [
      { kind: 'kicker', text: 'HEALTH LITERACY' },
      { kind: 'gap', h: 50 },
      { kind: 'title', text: '3 words in health headlines', size: 86 },
      { kind: 'gap', h: 36 },
      { kind: 'title', text: 'and what they actually mean', size: 56 },
      { kind: 'gap', h: 80 },
      { kind: 'body', text: '**Linked,** **risk,** and **causes** all promise less than they sound like. Each one has a question that tells you how seriously to take it.', size: 44 },
    ],
  },
  {
    name: 'slide-2-linked',
    footer: 'FOLLOW FOR MORE',
    blocks: [
      { kind: 'kicker', text: 'WORD 1 OF 3' },
      { kind: 'gap', h: 32 },
      { kind: 'title', text: '"LINKED TO / ASSOCIATED WITH"', size: 58 },
      { kind: 'gap', h: 36 },
      { kind: 'body', text: 'Plain meaning: these two things show up together.', size: 38 },
      { kind: 'gap', h: 44 },
      { kind: 'ask', text: 'Do they just happen together, or does one cause the other?' },
      { kind: 'gap', h: 44 },
      { kind: 'body', text: "Ice cream sales and drownings both rise in summer. They are linked, but the real cause is the heat, not the ice cream.", size: 34 },
    ],
  },
  {
    name: 'slide-3-risk',
    footer: 'FOLLOW FOR MORE',
    blocks: [
      { kind: 'kicker', text: 'WORD 2 OF 3' },
      { kind: 'gap', h: 32 },
      { kind: 'title', text: '"RAISES / DOUBLES YOUR RISK"', size: 58 },
      { kind: 'gap', h: 36 },
      { kind: 'body', text: 'Plain meaning: it happens a bit more often.', size: 38 },
      { kind: 'gap', h: 44 },
      { kind: 'ask', text: 'From what, to what?' },
      { kind: 'gap', h: 44 },
      { kind: 'body', text: '"Doubles your risk" can mean going from 1 in 10,000 to 2 in 10,000. The relative number sounds scary; the absolute number tells you the real change. Ask for both.', size: 34 },
    ],
  },
  {
    name: 'slide-4-causes',
    footer: 'FOLLOW FOR MORE',
    blocks: [
      { kind: 'kicker', text: 'WORD 3 OF 3' },
      { kind: 'gap', h: 32 },
      { kind: 'title', text: '"CAUSES / PREVENTS"', size: 58 },
      { kind: 'gap', h: 36 },
      { kind: 'body', text: 'Plain meaning: change this, and the outcome changes too.', size: 38 },
      { kind: 'gap', h: 44 },
      { kind: 'ask', text: 'One study, or many?' },
      { kind: 'gap', h: 44 },
      { kind: 'body', text: 'This is the strongest claim. It needs proof that the cause came first and that coincidences were ruled out. One study is rarely enough.', size: 34 },
    ],
  },
  {
    name: 'slide-5-closing',
    footer: 'SAVE THIS FOR THE NEXT HEADLINE',
    blocks: [
      { kind: 'title', text: 'Before you share a health headline, ask 3 things:', size: 64 },
      { kind: 'gap', h: 90 },
      { kind: 'numbered', n: 1, text: 'Compared to what?' },
      { kind: 'gap', h: 64 },
      { kind: 'numbered', n: 2, text: 'How many, out of how many, over how long?' },
      { kind: 'gap', h: 64 },
      { kind: 'numbered', n: 3, text: 'Says who, and did anyone else find the same?' },
    ],
  },
];

const outDir = process.argv[2];
if (!outDir) {
  console.error('Usage: npx tsx scripts/render-definitions-carousel.ts <outDir>');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
for (const s of slides) {
  const png = renderSlide(s.blocks, s.footer);
  const p = join(outDir, `${s.name}.png`);
  writeFileSync(p, png);
  console.log(`Wrote ${p}`);
}
