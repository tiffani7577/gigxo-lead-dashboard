import { router, adminProcedure } from "../_core/trpc";
import { scraperSubreddits, scraperKeywords } from "../../drizzle/schema";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Inbound lead capture feature
export const scraperConfigRouter = router({
  // ── Subreddits ────────────────────────────────────────────────────────────
  listSubreddits: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    return db.select().from(scraperSubreddits).orderBy(scraperSubreddits.subreddit);
  }),

  addSubreddit: adminProcedure
    .input(
      z.object({
        subreddit: z.string().min(1).max(128),
        cityHint: z.string().max(255).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(scraperSubreddits).values({
        subreddit: input.subreddit,
        cityHint: input.cityHint || null,
        isActive: true,
      });
      return { success: true };
    }),

  updateSubreddit: adminProcedure
    .input(
      z.object({
        id: z.number(),
        subreddit: z.string().min(1).max(128).optional(),
        cityHint: z.string().max(255).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const updates: any = {};
      if (input.subreddit) updates.subreddit = input.subreddit;
      if (input.cityHint !== undefined) updates.cityHint = input.cityHint || null;
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      await db.update(scraperSubreddits).set(updates).where(eq(scraperSubreddits.id, input.id));
      return { success: true };
    }),

  deleteSubreddit: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(scraperSubreddits).where(eq(scraperSubreddits.id, input.id));
      return { success: true };
    }),

  // ── Keywords ──────────────────────────────────────────────────────────────
  listKeywords: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    return db.select().from(scraperKeywords).orderBy(scraperKeywords.keyword);
  }),

  addKeyword: adminProcedure
    .input(
      z.object({
        keyword: z.string().min(1).max(128),
        type: z.enum(["seeking", "entertainment"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(scraperKeywords).values({
        keyword: input.keyword,
        type: input.type,
        isActive: true,
      });
      return { success: true };
    }),

  updateKeyword: adminProcedure
    .input(
      z.object({
        id: z.number(),
        keyword: z.string().min(1).max(128).optional(),
        type: z.enum(["seeking", "entertainment"]).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const updates: any = {};
      if (input.keyword) updates.keyword = input.keyword;
      if (input.type) updates.type = input.type;
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      await db.update(scraperKeywords).set(updates).where(eq(scraperKeywords.id, input.id));
      return { success: true };
    }),

  deleteKeyword: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(scraperKeywords).where(eq(scraperKeywords.id, input.id));
      return { success: true };
    }),
});
