-- Cost tracking for scraper runs (Apify)
ALTER TABLE scraperRuns ADD COLUMN apifyCostUsd DECIMAL(8,4) NULL AFTER sourceCounts;
ALTER TABLE scraperRuns ADD COLUMN leadsInserted INT NULL AFTER apifyCostUsd;
ALTER TABLE scraperRuns ADD COLUMN costPerLead DECIMAL(8,4) NULL AFTER leadsInserted;
