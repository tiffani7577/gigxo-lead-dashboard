/**
 * Lead conversion tracking logs for analytics.
 * No schema changes: logs to stdout as JSON for aggregation elsewhere.
 * Fields: lead_source, intent_score, unlock_rate, booking_result.
 */

export function logLeadDiscovered(payload: { lead_source: string; intent_score: number | null }) {
  console.log(
    JSON.stringify({
      event: "lead_discovered",
      lead_source: payload.lead_source,
      intent_score: payload.intent_score,
      ts: new Date().toISOString(),
    })
  );
}

export function logLeadUnlocked(payload: {
  leadId: number;
  lead_source?: string;
  intent_score?: number | null;
  unlock_rate?: number;
}) {
  console.log(
    JSON.stringify({
      event: "lead_unlocked",
      leadId: payload.leadId,
      lead_source: payload.lead_source,
      intent_score: payload.intent_score,
      unlock_rate: payload.unlock_rate,
      ts: new Date().toISOString(),
    })
  );
}

export function logBookingResult(payload: { leadId: number; outcome: string; booking_result?: string }) {
  console.log(
    JSON.stringify({
      event: "booking_result",
      leadId: payload.leadId,
      outcome: payload.outcome,
      booking_result: payload.booking_result ?? payload.outcome,
      ts: new Date().toISOString(),
    })
  );
}
