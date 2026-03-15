-- Add google_maps to gigLeads.source enum (venue intelligence from Apify Google Maps)
ALTER TABLE gigLeads MODIFY COLUMN source ENUM('gigxo','eventbrite','thumbtack','yelp','craigslist','nextdoor','facebook','manual','gigsalad','thebash','weddingwire','theknot','inbound','reddit','dbpr','sunbiz','google_maps') NOT NULL;
