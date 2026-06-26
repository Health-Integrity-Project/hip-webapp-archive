export interface SlackProposal {
  claimTitle: string;
  statusBadge: string;
  caption: string;
  subtitle: string;
  /** Hashtag words (no leading #). Rendered as a #tag line under the caption. */
  tags: string[];
  claimUrl: string;
  /** Rendered post image (PNG) — uploaded to Slack so it's visible immediately. */
  image: Buffer;
}

const SLACK_API = 'https://slack.com/api';

function botToken(): string {
  const t = process.env.SLACK_BOT_TOKEN;
  if (!t) throw new Error('Missing SLACK_BOT_TOKEN');
  return t;
}

function channelId(): string {
  const c = process.env.SLACK_CHANNEL_ID;
  if (!c) throw new Error('Missing SLACK_CHANNEL_ID');
  return c;
}

async function slackGet(method: string, params: Record<string, string>): Promise<any> {
  const url = `${SLACK_API}/${method}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${botToken()}` } });
  const json = await res.json();
  if (!json.ok) throw new Error(`Slack ${method} failed: ${json.error}`);
  return json;
}

async function slackPostForm(method: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${botToken()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Slack ${method} failed: ${json.error}`);
  return json;
}

/**
 * Post a weekly proposal to Slack: upload the rendered PNG with the caption as
 * the message body. Uses the files.uploadV2 flow (bot token, files:write).
 */
export async function postProposal(p: SlackProposal): Promise<void> {
  const filename = 'instagram-proposal.png';

  // 1. Reserve an upload URL.
  const { upload_url, file_id } = await slackGet('files.getUploadURLExternal', {
    filename,
    length: String(p.image.length),
  });

  // 2. PUT the raw bytes to the upload URL.
  const putRes = await fetch(upload_url, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: new Uint8Array(p.image),
  });
  if (!putRes.ok) {
    throw new Error(`Slack file upload PUT failed: ${putRes.status} ${await putRes.text()}`);
  }

  // 3. Complete the upload into the channel, with the proposal text as the
  //    message body (initial_comment).
  const comment = [
    `*📸 Weekly IG proposal — ${p.statusBadge}*`,
    `*${p.claimTitle}*`,
    p.subtitle,
    '',
    `*Caption:*`,
    p.caption,
    p.tags.map((t) => `#${t}`).join(' '),
    '',
    `<${p.claimUrl}|View evidence on the site>`,
  ].join('\n');

  await slackPostForm('files.completeUploadExternal', {
    files: JSON.stringify([{ id: file_id, title: p.claimTitle }]),
    channel_id: channelId(),
    initial_comment: comment,
  });
}

/** Post a plain info message to the channel (e.g. "no candidates this week"). */
export async function postInfo(text: string): Promise<void> {
  await slackPostForm('chat.postMessage', {
    channel: channelId(),
    text,
  });
}
