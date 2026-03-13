ALTER TABLE `gigLeads` ADD `isHidden` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `isReserved` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `unlockPriceCents` int;