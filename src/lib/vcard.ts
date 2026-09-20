import type { NameCard } from "@/lib/types";

function esc(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

// URL values are URIs, not vCard TEXT: do not backslash-escape their punctuation.
function webUrl(value: string | undefined) {
  if (!value || /[\r\n]/.test(value)) return undefined;
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

// Fold at 75 UTF-8 octets without splitting a Unicode code point.
function fold(line: string) {
  const parts: string[] = [];
  let part = "";
  let bytes = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > 75) {
      parts.push(part);
      part = " ";
      bytes = 1;
    }
    part += character;
    bytes += size;
  }
  parts.push(part);
  return parts.join("\r\n");
}

export function buildVCard(card: NameCard) {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `UID:${esc(card.id)}`,
    `FN:${esc(card.name)}`,
    // We only have a display name; do not guess culturally specific name parts.
    `N:;${esc(card.name)};;;`,
    `ORG:${esc(card.company)}`,
    `TITLE:${esc(card.title)}`,
  ];
  if (Number.isFinite(Date.parse(card.updatedAt)))
    lines.push(`REV:${new Date(card.updatedAt).toISOString()}`);

  if (card.contacts.email)
    lines.push(`EMAIL;TYPE=WORK:${esc(card.contacts.email)}`);
  if (card.contacts.phone)
    lines.push(`TEL;TYPE=CELL:${esc(card.contacts.phone)}`);
  const website = webUrl(card.contacts.website);
  const linkedin = webUrl(card.contacts.linkedin);
  const avatar = webUrl(card.avatarUrl);
  const booking = webUrl(card.meetingUrl);
  const agentUrl =
    card.agent?.isActive === false
      ? undefined
      : webUrl(card.agent?.agentUrl) || webUrl(card.agent?.url);

  if (website) lines.push(`URL:${website}`);
  if (linkedin) lines.push(`X-SOCIALPROFILE;TYPE=linkedin:${linkedin}`);
  if (agentUrl) {
    lines.push(`item1.URL:${agentUrl}`, "item1.X-ABLabel:Aicoo Agent");
  }
  // NOTE is a fallback for contact apps that ignore grouped URL labels.
  if (booking)
    lines.push(`item2.URL:${booking}`, "item2.X-ABLabel:Book a meeting");
  const note = [
    card.bio,
    agentUrl ? `Talk to my Aicoo agent: ${agentUrl}` : "",
    booking ? `Book a meeting: ${booking}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  if (note) lines.push(`NOTE:${esc(note)}`);
  if (avatar) lines.push(`PHOTO;VALUE=URI:${avatar}`);

  lines.push("END:VCARD");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
