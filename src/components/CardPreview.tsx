"use client";

import Image from "next/image";
import QRCode from "qrcode";
import {
  Bot,
  Calendar,
  Download,
  Link2,
  Mail,
  Phone,
  Send,
  Share2,
  UserPlus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PublicNameCard } from "@/lib/public-card";

type Props = {
  card: PublicNameCard;
  publicUrl: string;
  exportMode?: boolean;
  hideQr?: boolean;
};

export function CardPreview({
  card,
  publicUrl,
  exportMode = false,
  hideQr = false,
}: Props) {
  const [qr, setQr] = useState("");
  const agentUrl =
    card.agent?.isActive === false
      ? ""
      : card.agent?.agentUrl || card.agent?.url || "";
  const initials = useMemo(
    () =>
      card.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "AI",
    [card.name],
  );

  const bookUrl = useMemo(() => {
    if (card.meetingUrl) return card.meetingUrl;
    if (agentUrl) {
      const msg = `${card.name}什么时候有空`;
      const separator = agentUrl.includes("?") ? "&" : "?";
      return `${agentUrl}${separator}prompt=${encodeURIComponent(msg)}&message=${encodeURIComponent(msg)}`;
    }
    return `mailto:${card.contacts.email}`;
  }, [agentUrl, card.meetingUrl, card.name, card.contacts.email]);

  useEffect(() => {
    QRCode.toDataURL(publicUrl, {
      margin: 1,
      width: 180,
      color: { dark: "#15110f", light: "#ffffff" },
    }).then(setQr);
  }, [publicUrl]);

  return (
    <article
      id="card-preview"
      className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_24px_80px_rgba(21,17,15,0.16)]"
    >
      <div
        className="relative h-36 bg-[#ff5d4f]"
        style={{ backgroundColor: card.accent }}
      >
        {card.coverUrl ? (
          <Image
            unoptimized
            src={card.coverUrl}
            alt=""
            fill
            sizes="390px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.36),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.2),rgba(0,0,0,0.18))]" />
        )}
      </div>

      <div className="relative px-6 pb-6">
        <div className="-mt-12 flex items-end justify-between gap-4">
          <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#f4f0e8] text-2xl font-black text-[#15110f]">
            {card.avatarUrl ? (
              <Image
                unoptimized
                src={card.avatarUrl}
                alt={card.name}
                fill
                sizes="96px"
                className="object-cover"
              />
            ) : (
              initials
            )}
          </div>
          {qr && !hideQr ? (
            <div className="rounded-2xl border border-black/10 bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code" className="h-20 w-20" />
            </div>
          ) : null}
        </div>

        <div className="mt-5">
          <h1 className="text-4xl font-black leading-none text-[#15110f]">
            {card.name}
          </h1>
          <p className="mt-3 text-lg font-semibold leading-6 text-black/48">
            {card.title}
            {card.title && card.company ? <br /> : null}
            {card.company}
          </p>
          <p className="mt-5 text-[15px] leading-6 text-black/64">{card.bio}</p>
        </div>

        <div className="mt-6 space-y-3">
          {card.contacts.email ? (
            <Contact
              icon={<Mail />}
              label={card.contacts.email}
              href={`mailto:${card.contacts.email}`}
            />
          ) : null}
          {card.contacts.phone ? (
            <Contact
              icon={<Phone />}
              label={card.contacts.phone}
              href={`tel:${card.contacts.phone}`}
            />
          ) : null}
          {card.contacts.linkedin ? (
            <Contact
              icon={<Link2 />}
              label="LinkedIn"
              href={card.contacts.linkedin}
            />
          ) : null}
          {card.contacts.website ? (
            <Contact
              icon={<Link2 />}
              label={card.contacts.website}
              href={card.contacts.website}
            />
          ) : null}
        </div>

        {exportMode ? (
          <div className="mt-6 rounded-2xl bg-[#f5f1e8] p-4 text-center text-sm font-bold text-[#15110f]">
            Preview — save your card before sharing
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-3 gap-2">
            <Action
              href={`/api/cards/${card.slug}/vcard`}
              icon={<UserPlus />}
              label="Save"
            />
            <Action href={publicUrl} icon={<Share2 />} label="Share" />
            <Action href={bookUrl} icon={<Calendar />} label="Book" />
          </div>
        )}

        <a
          href={agentUrl || undefined}
          target={agentUrl ? "_blank" : undefined}
          rel="noreferrer"
          aria-disabled={!agentUrl}
          className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#15110f] px-5 text-base font-black text-white transition hover:scale-[1.01]"
        >
          <Bot className="h-5 w-5" />
          Talk to my agent
        </a>

        {!exportMode && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a
              className="flex h-11 items-center justify-center gap-2 rounded-full border border-black/10 text-sm font-bold"
              href={`/api/qr?text=${encodeURIComponent(publicUrl)}&name=${card.slug}-card`}
            >
              <Download className="h-4 w-4" />
              Card QR
            </a>
            <a
              className="flex h-11 items-center justify-center gap-2 rounded-full border border-black/10 text-sm font-bold"
              href={`/api/qr?text=${encodeURIComponent(agentUrl || publicUrl)}&name=${card.slug}-agent`}
            >
              <Send className="h-4 w-4" />
              Agent QR
            </a>
          </div>
        )}
      </div>
    </article>
  );
}

function Contact({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      className="flex min-h-11 items-center gap-3 text-[15px] font-bold text-[#15110f]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ff5d4f] text-white [&_svg]:h-4 [&_svg]:w-4">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </a>
  );
}

function Action({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-[#f5f1e8] text-xs font-black text-[#15110f] [&_svg]:h-4 [&_svg]:w-4"
    >
      {icon}
      {label}
    </a>
  );
}
