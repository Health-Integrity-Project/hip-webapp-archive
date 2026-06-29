import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import type { ClaimEvidence } from './pickClaim';

const EXAMPLES_PATH = fileURLToPath(new URL('./caption-examples.json', import.meta.url));

interface Example {
  claim_title: string;
  status_badge: string;
  count: number;
  comments: string[];
  caption: string;
  subtitle: string;
  tags: string[];
}

export interface CaptionResult {
  /** Caption body for the Instagram post: a few sentences about the study. */
  caption: string;
  /** Short evidence-summary subtitle for the image, ≤80 chars. */
  subtitle: string;
  /** Three Instagram hashtags (no leading #). "healthintegrity" is always one. */
  tags: string[];
}

/** Hashtag included on every post. */
const REQUIRED_TAG = 'healthintegrity';

const SYSTEM_PROMPT = `You write Instagram captions for the Health Integrity Project, which reviews health claims against peer-reviewed evidence. Expert reviewers score each study and leave comments; you turn that into a short, honest caption.

You receive: the claim, the verdict (Supported / Disproved / Inconclusive), how many studies were reviewed, the stance tally, and the expert reviewer comments.

How to write the "why":
- Read the reviewer comments and find the single point that best explains the VERDICT, then write the caption around it:
  - Supported  -> the finding that backs the claim (effect, magnitude, consistency).
  - Disproved  -> the finding that contradicts the claim, or why the effect fails.
  - Inconclusive -> the limitation that prevents a conclusion (small/short studies, mixed results, weak effect, poor quality).
- Ground the caption in what the comments actually say. Do not invent numbers, study names, or findings not present in the comments.
- Be honest about the evidence base. If only one study was reviewed, say "one study" rather than implying more.

Voice and rules:
- Plain, neutral, factual tone. No hype. No emojis. No hashtags.
- Mirror this brand voice: "The studies reviewed are not focused on tissue healing and the effect is weak."
- caption: the Instagram post body, 2-4 sentences. Open by naming the claim and the verdict, then explain what the reviewed studies actually show — the scope, strength, and key limitations drawn from the comments. Bold exactly one key phrase using markdown **like this**. This is the longer text; it can say more about the study than the subtitle.
- subtitle: at most 80 characters, no markdown. A short summary of the evidence (e.g. the strength or scope of what was reviewed) — not a restatement of the caption. Write it as a complete, grammatical sentence with normal connector words ("is", "are", "the"). Do not use headline/telegraphic style or drop small words to save space — shorten by saying less, not by omitting grammar.
- tags: exactly three Instagram hashtag words, no leading "#", lowercase, no spaces. The first must always be "${REQUIRED_TAG}". The other two should be topical to the claim (e.g. the condition, treatment, or field).
- Never overstate certainty. "Supported" = evidence backs it; "Disproved" = evidence contradicts it; "Inconclusive" = evidence is mixed or insufficient.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    caption: { type: 'string', description: 'Post body, 2-4 sentences, one **bold** phrase.' },
    subtitle: { type: 'string', description: 'Short evidence-summary subtitle, <=80 chars, no markdown.' },
    tags: {
      type: 'array',
      items: { type: 'string' },
      // Anthropic structured output rejects array minItems/maxItems other than
      // 0 or 1. Count is enforced by the prompt + normalizeTags() instead.
      description: 'Exactly three hashtag words, no leading #, lowercase. First is "healthintegrity".',
    },
  },
  required: ['caption', 'subtitle', 'tags'],
  additionalProperties: false,
} as const;

function evidenceBlock(ev: ClaimEvidence): string {
  const tally =
    ev.supporting + ev.contradicting > 0
      ? `Stance tally: ${ev.supporting} supporting, ${ev.contradicting} contradicting.`
      : 'Stance breakdown not available.';
  const studyLine =
    ev.count === 1 ? '1 study reviewed.' : `${ev.count} studies reviewed.`;
  const comments = ev.comments.length
    ? ev.comments.map((c, i) => `[${i + 1}] ${c}`).join('\n')
    : '(no reviewer comments available)';
  return `${studyLine}\n${tally}\n\nReviewer comments:\n${comments}`;
}

function buildFewShot(examples: Example[]): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];
  for (const ex of examples) {
    messages.push({
      role: 'user',
      content: `Claim: ${ex.claim_title}\nVerdict: ${ex.status_badge}\n\n${evidenceBlock({
        count: ex.count,
        supporting: 0,
        contradicting: 0,
        titles: [],
        comments: ex.comments,
      })}`,
    });
    messages.push({
      role: 'assistant',
      content: JSON.stringify({ caption: ex.caption, subtitle: ex.subtitle, tags: ex.tags }),
    });
  }
  return messages;
}

/**
 * Draft a caption + subtitle for a claim via the Anthropic API, grounded in the
 * claim's reviewed evidence. Requires ANTHROPIC_API_KEY in the environment.
 */
export async function draftCaption(
  claimTitle: string,
  statusBadge: string,
  evidence: ClaimEvidence,
): Promise<CaptionResult> {
  const examples = JSON.parse(readFileSync(EXAMPLES_PATH, 'utf8')) as Example[];
  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
    messages: [
      ...buildFewShot(examples),
      {
        role: 'user',
        content: `Claim: ${claimTitle}\nVerdict: ${statusBadge}\n\n${evidenceBlock(evidence)}`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Anthropic refused to draft a caption for this claim.');
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Anthropic returned no text content for caption.');
  }

  const parsed = JSON.parse(textBlock.text) as CaptionResult;
  return {
    caption: parsed.caption.trim(),
    subtitle: parsed.subtitle.trim(),
    tags: normalizeTags(parsed.tags),
  };
}

/**
 * Clean the model's tags: strip leading '#', lowercase, drop spaces/empties and
 * duplicates, and guarantee `healthintegrity` is present (first) and exactly
 * three tags are returned.
 */
function normalizeTags(raw: string[]): string[] {
  const clean = (Array.isArray(raw) ? raw : [])
    .map((t) => String(t).trim().replace(/^#/, '').replace(/\s+/g, '').toLowerCase())
    .filter(Boolean);

  const seen = new Set<string>();
  const tags = [REQUIRED_TAG];
  seen.add(REQUIRED_TAG);
  for (const t of clean) {
    if (tags.length >= 3) break;
    if (!seen.has(t)) {
      seen.add(t);
      tags.push(t);
    }
  }
  return tags.slice(0, 3);
}
