CREATE TABLE `majorEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`filterLabel` varchar(128) NOT NULL,
	`marketId` varchar(64) NOT NULL,
	`city` varchar(128) NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`leadDays` int NOT NULL DEFAULT 90,
	`searchKeywords` json NOT NULL,
	`relevantPerformerTypes` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`eventYear` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `majorEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `majorEvents_marketId_idx` ON `majorEvents` (`marketId`);--> statement-breakpoint
CREATE INDEX `majorEvents_startDate_idx` ON `majorEvents` (`startDate`);