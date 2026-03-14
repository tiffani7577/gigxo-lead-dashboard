import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { gigLeads } from "../../drizzle/schema";
import { randomUUID } from "crypto";

/**
 * Inbound lead capture feature
 * Allows public users to submit event requests directly into Gigxo
 */
export const inboundRouter = router({
  /**
   * Public endpoint: Submit an event request
   * Creates a new lead with source="inbound" and isApproved=false for admin review
   */
  submitEventRequest: publicProcedure
    .input(
      z.object({
        eventType: z.enum(["wedding", "birthday", "corporate", "party", "other"]),
        eventDate: z.string().datetime(),
        city: z.string().min(1, "City is required"),
        budget: z.number().int().positive().optional(),
        description: z.string().min(10, "Description must be at least 10 characters").max(2000),
        contactName: z.string().min(1, "Name is required"),
        contactEmail: z.string().email("Invalid email"),
        contactPhone: z.string().optional(),
        pageSlug: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      try {
        // Generate unique external ID for this inbound lead
        const externalId = `inbound-${randomUUID()}`;

        // Map event type to performer type
        const performerTypeMap: Record<string, any> = {
          wedding: "dj",
          birthday: "dj",
          corporate: "dj",
          party: "dj",
          other: "other",
        };

        // Insert the lead with type casting for decimal fields
        await db.insert(gigLeads).values({
          externalId,
          source: "inbound",
          leadType: "client_submitted",
          title: `${input.eventType.charAt(0).toUpperCase() + input.eventType.slice(1)} Event in ${input.city}`,
          description: input.description || null,
          eventType: input.eventType,
          budget: input.budget || null,
          location: input.city,
          eventDate: new Date(input.eventDate),
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone || null,
          performerType: (performerTypeMap[input.eventType] || "other") as any,
          isApproved: false,
          isRejected: false,
          intentScore: 85,
          finalScore: 85,
          sourceLabel: input.pageSlug ? `SEO /${input.pageSlug}` : "Inbound Request",
          sourceTrust: "0.95" as any,
          contactScore: 90,
          buyerType: "private",
          contentHash: "",
        } as any);

        return {
          success: true,
          message: "Your event request has been submitted successfully. Our team will review it shortly.",
          externalId,
        };
      } catch (error) {
        console.error("[Inbound] Error submitting event request:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to submit event request. Please try again.",
        });
      }
    }),
});
