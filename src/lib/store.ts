import { promises as fs } from "fs";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import path from "path";
import type { NameCard, StoredSession } from "@/lib/types";
import { AppError } from "./errors";

type Database = {
  cards: NameCard[];
  sessions: StoredSession[];
};

const dataDir = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDir, "db.json");
let sqlClient: NeonQueryFunction<false, false> | null = null;

function getSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    if (process.env.VERCEL || process.env.NODE_ENV === "production")
      throw new AppError("Database is not configured.", 503);
    return null;
  }
  if (!sqlClient) sqlClient = neon(url);
  return sqlClient;
}

export async function query(sql: string, params: unknown[] = []) {
  const client = getSql();
  if (!client)
    throw new AppError(
      "Set up the development database to exchange cards.",
      503,
    );
  return client.query(sql, params);
}

async function readDb(): Promise<Database> {
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    return JSON.parse(raw) as Database;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { cards: [], sessions: [] };
    throw error;
  }
}

async function writeDb(db: Database) {
  await fs.mkdir(dataDir, { recursive: true });
  const temporary = `${dataFile}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(db, null, 2), { mode: 0o600 });
  await fs.rename(temporary, dataFile);
}

let localWrite: Promise<unknown> = Promise.resolve();
async function mutate<T>(action: (db: Database) => T | Promise<T>) {
  const operation = localWrite.then(async () => {
    const db = await readDb();
    const result = await action(db);
    await writeDb(db);
    return result;
  });
  localWrite = operation.catch(() => undefined);
  return operation;
}

export async function getCardByOwner(ownerId: string) {
  const sql = getSql();
  if (sql) {
    const rows =
      await sql`SELECT data FROM name_cards WHERE owner_id = ${ownerId} LIMIT 1`;
    return (rows[0]?.data as NameCard | undefined) || null;
  }

  const db = await readDb();
  return db.cards.find((card) => card.ownerId === ownerId) || null;
}

export async function getCardBySlug(slug: string) {
  const sql = getSql();
  if (sql) {
    const rows =
      await sql`SELECT data FROM name_cards WHERE slug = ${slug} LIMIT 1`;
    return publicCard((rows[0]?.data as NameCard | undefined) || null);
  }

  const db = await readDb();
  return publicCard(db.cards.find((card) => card.slug === slug) || null);
}

function publicCard(card: NameCard | null) {
  if (card?.agent?.expiresAt && Date.parse(card.agent.expiresAt) <= Date.now())
    return { ...card, agent: { ...card.agent, isActive: false } };
  return card;
}

export async function saveCard(card: NameCard) {
  const sql = getSql();
  if (sql) {
    const nextCard = { ...card, updatedAt: new Date().toISOString() };
    try {
      await sql`
      INSERT INTO name_cards (id, owner_id, slug, data, updated_at)
      VALUES (${nextCard.id}, ${nextCard.ownerId}, ${nextCard.slug}, ${JSON.stringify(nextCard)}::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET
        owner_id = EXCLUDED.owner_id,
        slug = EXCLUDED.slug,
        data = EXCLUDED.data,
        updated_at = now()
    `;
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        throw new AppError(
          "That card address or account already exists. Reload or choose another address.",
          409,
        );
      throw error;
    }
    return nextCard;
  }

  return mutate((db) => {
    if (
      db.cards.some(
        (item) =>
          item.id !== card.id &&
          (item.slug === card.slug || item.ownerId === card.ownerId),
      )
    )
      throw new AppError(
        "That card address or account already exists. Reload or choose another address.",
        409,
      );
    const nextCard = { ...card, updatedAt: new Date().toISOString() };
    const existing = db.cards.findIndex((item) => item.id === card.id);

    if (existing >= 0) {
      db.cards[existing] = nextCard;
    } else {
      db.cards.push(nextCard);
    }

    return nextCard;
  });
}

export async function saveSession(session: StoredSession) {
  const sql = getSql();
  if (sql) {
    await sql`
      INSERT INTO card_sessions (id, data, created_at)
      VALUES (${session.id}, ${JSON.stringify(session)}::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data
    `;
    return session;
  }

  return mutate((db) => {
    const existing = db.sessions.findIndex((item) => item.id === session.id);

    if (existing >= 0) {
      db.sessions[existing] = session;
    } else {
      db.sessions.push(session);
    }

    return session;
  });
}

export async function getSession(id: string | undefined) {
  if (!id) return null;
  const sql = getSql();
  if (sql) {
    const rows =
      await sql`SELECT data FROM card_sessions WHERE id = ${id} LIMIT 1`;
    return (rows[0]?.data as StoredSession | undefined) || null;
  }

  const db = await readDb();
  return db.sessions.find((session) => session.id === id) || null;
}

export async function deleteSession(id: string | undefined) {
  if (!id) return;
  const sql = getSql();
  if (sql) {
    await sql`DELETE FROM card_sessions WHERE id = ${id}`;
    return;
  }

  await mutate((db) => {
    db.sessions = db.sessions.filter((session) => session.id !== id);
  });
}

// A cross-instance lease prevents rotating a refresh token twice. Never recreate
// a session deleted by logout while a refresh request was in flight.
export async function claimRefresh(id: string, lease: string) {
  const until = Date.now() + 60000;
  if (getSql()) {
    const rows = await query(
      `UPDATE card_sessions SET data = data || jsonb_build_object('refreshLease',$2::text,'refreshUntil',$3::bigint)
      WHERE id=$1 AND COALESCE((data->>'refreshUntil')::bigint,0) < $4 RETURNING id`,
      [id, lease, until, Date.now()],
    );
    return rows.length > 0;
  }
  return mutate((db) => {
    const s = db.sessions.find((s) => s.id === id);
    if (!s || (s.refreshUntil || 0) >= Date.now()) return false;
    s.refreshLease = lease;
    s.refreshUntil = until;
    return true;
  });
}
export async function extendRefresh(id: string, lease: string) {
  const now = Date.now();
  const until = now + 60000;
  if (getSql()) {
    const rows = await query(
      `UPDATE card_sessions SET data=jsonb_set(data,'{refreshUntil}',$3::jsonb)
      WHERE id=$1 AND data->>'refreshLease'=$2 AND (data->>'refreshUntil')::bigint>$4 RETURNING id`,
      [id, lease, JSON.stringify(until), now],
    );
    return rows.length > 0;
  }
  return mutate((db) => {
    const session = db.sessions.find(
      (s) =>
        s.id === id && s.refreshLease === lease && (s.refreshUntil || 0) > now,
    );
    if (!session) return false;
    session.refreshUntil = until;
    return true;
  });
}
export async function finishRefresh(
  id: string,
  lease: string,
  session: StoredSession,
) {
  const next = { ...session, refreshLease: undefined, refreshUntil: undefined };
  if (getSql()) {
    const rows = await query(
      `UPDATE card_sessions SET data=$3::jsonb WHERE id=$1 AND data->>'refreshLease'=$2 AND (data->>'refreshUntil')::bigint>$4 RETURNING id`,
      [id, lease, JSON.stringify(next), Date.now()],
    );
    return rows.length > 0;
  }
  return mutate((db) => {
    const index = db.sessions.findIndex(
      (s) =>
        s.id === id &&
        s.refreshLease === lease &&
        (s.refreshUntil || 0) > Date.now(),
    );
    if (index < 0) return false;
    db.sessions[index] = next;
    return true;
  });
}
