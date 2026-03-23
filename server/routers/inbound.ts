import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { avWorkers, gigLeads } from "../../drizzle/schema";
import { randomUUID } from "crypto";
import { sendAVRequestNotification, sendAVWorkerNotification, sendInboundLeadNotification } from "../email";

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
          contactPhone: input.contactPhone ?? null,
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

  createAVRequestCheckout: publicProcedure
    .input(
      z.object({
        companyName: z.string().min(1),
        contactEmail: z.string().email(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const StripeSdk = (await import("stripe")).default;
      const key = process.env.STRIPE_SECRET_KEY?.trim();
      if (!key) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe secret key is not configured",
        });
      }

      const stripeClient = new StripeSdk(key, { apiVersion: "2026-02-25.clover" });
      const origin = ctx.req.headers.origin ?? "https://www.gigxo.com";
      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: input.contactEmail,
        metadata: {
          flow: "av_staffing_request",
          company_name: input.companyName,
        },
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: 1500,
              product_data: {
                name: "AV Crew Request",
                description: "Manual AV crew matching by Gigxo team",
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/av-staffing?paid=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/av-staffing?cancelled=1`,
      });

      if (!session.url) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to start checkout session",
        });
      }
      return { url: session.url };
    }),

  submitAVRequest: publicProcedure
    .input(
      z.object({
        stripeCheckoutSessionId: z.string().min(1),
        companyName: z.string().min(1),
        contactName: z.string().min(1),
        contactEmail: z.string().email(),
        contactPhone: z.string().min(1),
        eventDate: z.string().min(1),
        callTime: z.string().min(1),
        endTime: z.string().min(1),
        location: z.string().min(1),
        rolesNeeded: z.array(z.string().min(1)).min(1),
        numberOfCrew: z.number().int().positive(),
        payRate: z.enum(["$150-200/day", "$200-300/day", "$300-400/day", "$400+/day", "To be discussed"]),
        urgency: z.enum(["Same day", "Within 24 hours", "2-3 days", "Planning ahead"]),
        readyToBook: z.enum(["yes", "no"]),
        additionalNotes: z.string().optional(),
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

      const externalId = `av-request-${randomUUID()}`;
      const title = `${input.rolesNeeded.join(", ")} needed — ${input.location} on ${input.eventDate}`;
      const description = [
        `Company/Event Name: ${input.companyName}`,
        `Contact Name: ${input.contactName}`,
        `Contact Email: ${input.contactEmail}`,
        `Contact Phone: ${input.contactPhone}`,
        `Event Date: ${input.eventDate}`,
        `Call Time: ${input.callTime}`,
        `End Time: ${input.endTime}`,
        `Location/Venue: ${input.location}`,
        `Roles Needed: ${input.rolesNeeded.join(", ")}`,
        `Number of Crew: ${input.numberOfCrew}`,
        `Pay Rate per Person: ${input.payRate}`,
        `Urgency: ${input.urgency}`,
        `Ready to book immediately: ${input.readyToBook}`,
        `Stripe Checkout Session: ${input.stripeCheckoutSessionId}`,
        input.additionalNotes ? `Additional notes: ${input.additionalNotes}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      await db.insert(gigLeads).values({
        externalId,
        source: "av_staffing",
        leadType: "av_request",
        title,
        description,
        eventType: "av_staffing_request",
        location: input.location,
        eventDate: new Date(input.eventDate),
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        notes: `urgency=${input.urgency}; readyToBook=${input.readyToBook}; notes=${input.additionalNotes ?? ""}`,
        artistUnlockEnabled: false,
        isApproved: true,
        isRejected: false,
        intentScore: 95,
        finalScore: 95,
        leadTemperature: "hot",
        performerType: "audio_engineer",
        sourceLabel: "AV Staffing Intake",
        sourceTrust: "0.98" as any,
        contactScore: 95,
        buyerType: "corporate",
        contentHash: "",
      } as any);

      try {
        await sendAVRequestNotification({
          companyName: input.companyName,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          eventDate: input.eventDate,
          callTime: input.callTime,
          endTime: input.endTime,
          location: input.location,
          rolesNeeded: input.rolesNeeded,
          numberOfCrew: input.numberOfCrew,
          payRate: input.payRate,
          urgency: input.urgency,
          readyToBook: input.readyToBook,
          additionalNotes: input.additionalNotes,
        });
      } catch (emailErr: any) {
        console.warn("[Inbound] AV request notification failed:", emailErr?.message ?? emailErr);
      }

      return { success: true, externalId };
    }),

  submitAVWorker: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().email(),
        city: z.string().min(1),
        skills: z.array(z.string().min(1)).min(1),
        yearsExperience: z.enum(["Less than 1 year", "1-3 years", "3-5 years", "5+ years"]).optional(),
        minDayRate: z.enum(["$150/day", "$200/day", "$250/day", "$300/day", "$400+/day"]).optional(),
        availableSameDay: z.boolean().default(false),
        notes: z.string().optional(),
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

      await db.insert(avWorkers).values({
        name: input.name,
        phone: input.phone,
        email: input.email,
        city: input.city,
        skills: JSON.stringify(input.skills),
        yearsExperience: input.yearsExperience ?? null,
        minDayRate: input.minDayRate ?? null,
        availableSameDay: input.availableSameDay,
        notes: input.notes ?? null,
      });

      try {
        await sendAVWorkerNotification({
          name: input.name,
          phone: input.phone,
          email: input.email,
          city: input.city,
          skills: input.skills,
          yearsExperience: input.yearsExperience,
          minDayRate: input.minDayRate,
          availableSameDay: input.availableSameDay,
          notes: input.notes,
        });
      } catch (emailErr: any) {
        console.warn("[Inbound] AV worker notification failed:", emailErr?.message ?? emailErr);
      }

      return { success: true };
    }),
});
