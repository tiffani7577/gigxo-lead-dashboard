-- Add nationwide to gigLeads.regionTag for scraped out-of-market demand leads
ALTER TABLE `gigLeads`
  MODIFY COLUMN `regionTag` ENUM(
    'miami',
    'fort_lauderdale',
    'boca',
    'west_palm',
    'south_florida',
    'nationwide'
  ) NULL;
