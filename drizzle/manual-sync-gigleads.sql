-- Manual schema sync for gigLeads (Railway MySQL).
-- Run this if db:push fails or to add missing columns/enum values without dropping data.
-- Execute in order. If a statement errors (e.g. column already exists), skip that step.

-- 1) Add status column if missing (ignore error if column already exists)
ALTER TABLE gigLeads ADD COLUMN status VARCHAR(50) NULL DEFAULT NULL AFTER leadCategory;

-- 2) Extend source enum to include dbpr and sunbiz (must list all values; no data loss)
ALTER TABLE gigLeads MODIFY COLUMN source ENUM(
  'gigxo',
  'eventbrite',
  'thumbtack',
  'yelp',
  'craigslist',
  'nextdoor',
  'facebook',
  'manual',
  'gigsalad',
  'thebash',
  'weddingwire',
  'theknot',
  'inbound',
  'reddit',
  'dbpr',
  'sunbiz'
) NOT NULL;

-- 3) Venue Intelligence CRM columns (run after schema update; skip if columns exist)
ALTER TABLE gigLeads ADD COLUMN venueStatus ENUM('NEW','CONTACTED','FOLLOW_UP','MEETING','CLIENT','IGNORED') DEFAULT 'NEW' AFTER contactedAt;
ALTER TABLE gigLeads ADD COLUMN lastContactedAt DATETIME NULL DEFAULT NULL AFTER venueStatus;
ALTER TABLE gigLeads ADD COLUMN contactOwner VARCHAR(255) NULL DEFAULT NULL AFTER lastContactedAt;
ALTER TABLE gigLeads ADD COLUMN website VARCHAR(2048) NULL DEFAULT NULL AFTER contactOwner;
ALTER TABLE gigLeads ADD COLUMN instagram VARCHAR(255) NULL DEFAULT NULL AFTER website;
ALTER TABLE gigLeads ADD COLUMN venuePhone VARCHAR(32) NULL DEFAULT NULL AFTER instagram;
ALTER TABLE gigLeads ADD COLUMN venueEmail VARCHAR(320) NULL DEFAULT NULL AFTER venuePhone;
