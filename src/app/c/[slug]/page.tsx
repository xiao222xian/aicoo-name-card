import { notFound } from "next/navigation";
import { CardPreview } from "@/components/CardPreview";
import { getBaseUrl, getCurrentSession } from "@/lib/auth";
import { ExchangePanel } from "@/components/ExchangePanel";
import { getCardBySlug } from "@/lib/store";
import { toPublicCard } from "@/lib/public-card";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function PublicCardPage({ params }: Props) {
  const { slug } = await params;
  const card = await getCardBySlug(slug);
  if (!card) notFound();
  const session = await getCurrentSession();

  return (
    <main className="min-h-screen bg-[#f6f1e8] px-4 py-6 text-[#15110f]">
      <CardPreview
        card={toPublicCard(card)}
        publicUrl={`${getBaseUrl()}/c/${card.slug}`}
        hideQr={true}
      />
      <ExchangePanel
        slug={slug}
        signedIn={!!session}
        isOwner={session?.user.id === card.ownerId}
      />
    </main>
  );
}
