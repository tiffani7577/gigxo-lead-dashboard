import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

function parseMysqlUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, "") || undefined,
  };
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      console.warn("[Database] DATABASE_URL is not set; cannot initialize database connection.");
      return null;
    }

    try {
      const cfg = parseMysqlUrl(url);
      const pool = mysql.createPool({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        waitForConnections: true,
        connectionLimit: 10,
      });

      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }

  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Artist profile queries
export async function getOrCreateArtistProfile(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { artistProfiles, users } = await import("../drizzle/schema");

  // If a profile already exists, return it (enforces one-per-user in practice)
  const existing = await db.select().from(artistProfiles).where(eq(artistProfiles.userId, userId)).limit(1);
  if (existing.length > 0) return existing[0];

  // Load user to derive sensible defaults
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];

  const baseName =
    (user?.name ?? "")
      .trim()
      .replace(/\s+/g, " ") ||
    (user?.email?.split("@")[0] ?? "").trim() ||
    `artist-${userId}`;

  const normalizeSlug = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || `artist-${userId}`;

  let baseSlug = normalizeSlug(baseName);
  let slug = baseSlug;
  let counter = 2;

  // Ensure slug uniqueness
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const slugRows = await db
      .select({ id: artistProfiles.id })
      .from(artistProfiles)
      .where(eq(artistProfiles.slug, slug))
      .limit(1);
    if (slugRows.length === 0) break;
    slug = `${baseSlug}-${counter++}`;
  }

  const stageName = baseName;

  await db.insert(artistProfiles).values({
    userId,
    djName: stageName,
    stageName,
    slug,
    location: "Miami, FL",
    experienceLevel: "intermediate",
    minBudget: 0,
    maxDistance: 30,
    isPublished: false,
    isClaimed: false,
    showInDirectory: true,
    templateId: "default",
  } as any);

  const created = await db.select().from(artistProfiles).where(eq(artistProfiles.userId, userId)).limit(1);
  return created.length > 0 ? created[0] : null;
}

export async function updateArtistProfile(userId: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { artistProfiles } = await import("../drizzle/schema");
  await db.update(artistProfiles).set(data).where(eq(artistProfiles.userId, userId));
}

// Lead queries
export async function getApprovedLeads(limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { gigLeads } = await import("../drizzle/schema");
  return await db.select().from(gigLeads).where(eq(gigLeads.isApproved, true)).limit(limit).offset(offset);
}

export async function getLeadById(leadId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { gigLeads } = await import("../drizzle/schema");
  const result = await db.select().from(gigLeads).where(eq(gigLeads.id, leadId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getLeadScoresForArtist(artistId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { leadScores } = await import("../drizzle/schema");
  return await db.select().from(leadScores)
    .where(eq(leadScores.artistId, artistId))
    .orderBy(desc(leadScores.overallScore))
    .limit(limit);
}

// Transaction queries
export async function createTransaction(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { transactions } = await import("../drizzle/schema");
  const result = await db.insert(transactions).values(data);
  return result;
}

export async function getTransactionsByUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { transactions } = await import("../drizzle/schema");
  return await db.select().from(transactions).where(eq(transactions.userId, userId));
}

// Lead unlock queries
export async function recordLeadUnlock(userId: number, leadId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { leadUnlocks } = await import("../drizzle/schema");
  return await db.insert(leadUnlocks).values({ userId, leadId });
}

export async function hasUnlockedLead(userId: number, leadId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { leadUnlocks } = await import("../drizzle/schema");
  const result = await db.select().from(leadUnlocks)
    .where(and(eq(leadUnlocks.userId, userId), eq(leadUnlocks.leadId, leadId)))
    .limit(1);
  return result.length > 0;
}

// Subscription queries
export async function getSubscription(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { subscriptions } = await import("../drizzle/schema");
  const result = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateSubscription(userId: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { subscriptions } = await import("../drizzle/schema");
  await db.update(subscriptions).set(data).where(eq(subscriptions.userId, userId));
}
