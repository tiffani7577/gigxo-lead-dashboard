CREATE TABLE `leadFeedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`leadId` int NOT NULL,
	`outcome` enum('booked','no_response','lost','price_too_high','not_relevant') NOT NULL,
	`notes` text,
	`rateCharged` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leadFeedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `buyerType` enum('bride','event_planner','venue_manager','corporate','festival','nightclub','university','private','unknown') DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `sourceLabel` varchar(255);--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `sourceTrust` decimal(4,3);--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `contactScore` int;--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `freshnessScore` decimal(4,3);--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `intentScore` int;--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `finalScore` int;--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `winProbability` decimal(4,3);--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `competitionLevel` enum('low','medium','high');--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `suggestedRate` varchar(128);--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `pitchStyle` varchar(255);--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `leadTemperature` enum('hot','warm','cold');--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `prestigeScore` int;--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `urgencyScore` int;--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `budgetConfidence` enum('low','medium','high');--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `intentEvidence` text;--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `contactEvidence` text;--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `eventEvidence` text;--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `sourceEvidence` text;--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `eventWindowId` int;--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `scrapeKeyword` varchar(255);--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `venueType` varchar(100);--> statement-breakpoint
ALTER TABLE `gigLeads` ADD `estimatedGuestCount` int;--> statement-breakpoint
CREATE INDEX `leadFeedback_userId_idx` ON `leadFeedback` (`userId`);--> statement-breakpoint
CREATE INDEX `leadFeedback_leadId_idx` ON `leadFeedback` (`leadId`);