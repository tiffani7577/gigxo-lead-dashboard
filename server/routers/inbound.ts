import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { gigLeads } from "../../drizzle/schema";
import { randomUUID } from "crypto";
import { sendInboundLeadNotification } from "../email";

/**
 * Inbound lead capture feature
 * Allows public users to submit event requests directly into Gigxo.
 * Inbound leads are auto-approved (highest quality, self-submitted), intentScore=90, leadTemperature=hot,
 * and admin (teryn@gigxo.com) is notified by email.
 */
export const inboundRouter = router({
  /**
   * Public endpoint: Submit an event request
   * Creates a new lead with source="inbound", isApproved=true, intentScore=90, leadTemperature=hot.
   * Sends email notification to admin.
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

      const externalId = `inbound-${randomUUID()}`;
      const performerTypeMap: Record<string, any> = {
        wedding: "dj",
        birthday: "dj",
        corporate: "dj",
        party: "dj",
        other: "other",
      };
      const title = `${input.eventType.charAt(0).toUpperCase() + input.eventType.slice(1)} Event in ${input.city}`;

      try {
        await db.insert(gigLeads).values({
          externalId,
          source: "inbound",
          leadType: "client_submitted",
          title,
          description: input.description || null,
          eventType: input.eventType,
          budget: input.budget || null,
          location: input.city,
          eventDate: new Date(input.eventDate),
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone || null,
          performerType: (performerTypeMap[input.eventType] || "other") as any,
          isApproved: true,
          isRejected: false,
          intentScore: 90,
          finalScore: 90,
          leadTemperature: "hot",
          sourceLabel: input.pageSlug ? `SEO /${input.pageSlug}` : "Inbound Request",
          sourceTrust: "0.95" as any,
          contactScore: 90,
          buyerType: "private",
          contentHash: "",
        } as any);
      } catch (error) {
        console.error("[Inbound] Error submitting event request:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to submit event request. Please try again.",
        });
      }

      try {
        await sendInboundLeadNotification({
          title,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone ?? null,
          eventType: input.eventType,
          eventDate: input.eventDate,
          location: input.city,
          budget: input.budget ?? null,
          description: input.description ?? null,
        });
      } catch (emailErr: any) {
        console.warn("[Inbound] Admin notification failed (lead was still saved):", emailErr?.message ?? emailErr);
      }

      return {
        success: true,
        message: "Your event request has been submitted successfully. Our team will review it shortly.",
        externalId,
      };
    }),
});
