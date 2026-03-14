-- Phase 1: Lead monetization layer + outreach logging
-- This migration is additive and safe to run multiple times only if your runner
-- guards against duplicates. If applying manually, skip statements that error
-- due to already-existing columns/tables.

-- ─────────────────────────────────────────────────────────────────────────────
-- gigLeads: monetization + outreach state
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE gigLeads
  ADD COLUMN leadMonetizationType ENUM('artist_unlock','venue_outreach','venue_subscription','direct_client_pipeline') NULL,
  ADD COLUMN outreachStatus ENUM('not_sent','queued','sent','replied','interested','not_interested','bounced') NOT NULL DEFAULT 'not_sent',
  ADD COLUMN outreachAttemptCount INT NOT NULL DEFAULT 0,
  ADD COLUMN outreachLastSentAt TIMESTAMP NULL,
  ADD COLUMN outreachNextFollowUpAt TIMESTAMP NULL,
  ADD COLUMN venueClientStatus ENUM('prospect','contacted','qualified','active_client','archived') NULL,
  ADD COLUMN subscriptionVisibility BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN regionTag ENUM('miami','fort_lauderdale','boca','west_palm','south_florida') NULL,
  ADD COLUMN artistUnlockEnabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN premiumOnly BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional indexes for admin filtering (safe to add later if needed)
-- CREATE INDEX gigLeads_leadMonetizationType_idx ON gigLeads (leadMonetizationType);
-- CREATE INDEX gigLeads_outreachStatus_idx ON gigLeads (outreachStatus);
-- CREATE INDEX gigLeads_regionTag_idx ON gigLeads (regionTag);

-- ─────────────────────────────────────────────────────────────────────────────
-- outreachLog: admin-triggered outreach audit trail
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outreachLog (
  id INT AUTO_INCREMENT PRIMARY KEY,
  leadId INT NOT NULL,
  templateId VARCHAR(64) NULL,
  recipientEmail VARCHAR(320) NOT NULL,
  subject VARCHAR(512) NOT NULL,
  bodyPreview TEXT NULL,
  status ENUM('sent','failed','bounced') NOT NULL,
  errorMessage TEXT NULL,
  scheduledFollowUpAt TIMESTAMP NULL,
  sentAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX outreachLog_leadId_idx (leadId),
  INDEX outreachLog_sentAt_idx (sentAt)
);

