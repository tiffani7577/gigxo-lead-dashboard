-- Lead segment tier (informational tag: starter_friendly, standard, premium)
ALTER TABLE gigLeads ADD COLUMN leadTier ENUM('starter_friendly','standard','premium') NULL AFTER leadCategory;
