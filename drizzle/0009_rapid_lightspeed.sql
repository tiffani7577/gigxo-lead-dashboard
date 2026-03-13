CREATE TABLE `dripEmailLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dripType` enum('day3','day7','lead_alert','reengagement') NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dripEmailLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `gigLeads` MODIFY COLUMN `source` enum('gigxo','eventbrite','thumbtack','yelp','craigslist','nextdoor','facebook','manual','gigsalad','thebash') NOT NULL;--> statement-breakpoint
CREATE INDEX `dripEmailLog_userId_dripType_idx` ON `dripEmailLog` (`userId`,`dripType`);