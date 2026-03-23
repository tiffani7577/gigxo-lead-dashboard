CREATE TABLE `avWorkers` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(32) NOT NULL,
  `email` varchar(320) NOT NULL,
  `city` varchar(128) NOT NULL,
  `skills` text NOT NULL,
  `yearsExperience` varchar(32),
  `minDayRate` varchar(32),
  `availableSameDay` boolean NOT NULL DEFAULT false,
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `avWorkers_id` PRIMARY KEY(`id`)
);

ALTER TABLE `gigLeads`
  MODIFY COLUMN `source` enum(
    'gigxo','eventbrite','thumbtack','yelp','craigslist','nextdoor','facebook','manual','gigsalad','thebash','weddingwire','theknot','inbound','reddit','dbpr','sunbiz','google_maps','av_staffing'
  ) NOT NULL;

ALTER TABLE `gigLeads`
  MODIFY COLUMN `leadType` enum(
    'scraped_signal','client_submitted','venue_intelligence','referral','manual_outreach','event_demand','artist_signup','outreach','trash','other','av_request'
  ) DEFAULT 'scraped_signal';
