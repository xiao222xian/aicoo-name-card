import type { NameCard } from "./types";

export type PublicNameCard = Omit<NameCard, "ownerId" | "aicooUsername">;

// Explicit allowlist: adding a private field to NameCard must not publish it.
export function toPublicCard(card: NameCard): PublicNameCard {
  return {
    id: card.id,
    slug: card.slug,
    name: card.name,
    title: card.title,
    company: card.company,
    bio: card.bio,
    avatarUrl: card.avatarUrl,
    coverUrl: card.coverUrl,
    accent: card.accent,
    contacts: {
      email: card.contacts.email,
      phone: card.contacts.phone,
      linkedin: card.contacts.linkedin,
      website: card.contacts.website,
    },
    meetingUrl: card.meetingUrl,
    updatedAt: card.updatedAt,
    agent: card.agent
      ? {
          id: card.agent.id,
          label: card.agent.label,
          url: card.agent.url,
          agentUrl: card.agent.agentUrl,
          isActive: card.agent.isActive,
          expiresAt: card.agent.expiresAt,
        }
      : undefined,
  };
}
