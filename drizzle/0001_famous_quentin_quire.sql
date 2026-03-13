CREATE TABLE `artistProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`genres` json NOT NULL DEFAULT ('[]'),
	`location` varchar(255) NOT NULL,
	`experienceLevel` enum('beginner','intermediate','professional','expert') NOT NULL,
	`minBudget` int NOT NULL DEFAULT 0,
	`maxDistance` int NOT NULL DEFAULT 30,
	`equipment` json NOT NULL DEFAULT ('[]'),
	`bio` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `artistProfiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gigLeads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(255) NOT NULL,
	`source` enum('gigsalad','thebash','facebook','eventbrite','manual') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`eventType` varchar(100),
	`budget` int,
	`location` varchar(255) NOT NULL,
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
	`eventDate` timestamp,
	`contactName` varchar(255),
	`contactEmail` varchar(320),
	`contactPhone` varchar(20),
	`venueUrl` varchar(2048),
	`isApproved` boolean NOT NULL DEFAULT false,
	`isRejected` boolean NOT NULL DEFAULT false,
	`rejectionReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gigLeads_id` PRIMARY KEY(`id`),
	CONSTRAINT `gigLeads_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `leadScores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`artistId` int NOT NULL,
	`overallScore` int NOT NULL,
	`payScore` int NOT NULL,
	`locationScore` int NOT NULL,
	`genreScore` int NOT NULL,
	`reputationScore` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leadScores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leadUnlocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`leadId` int NOT NULL,
	`unlockedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leadUnlocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripeSubscriptionId` varchar(255),
	`tier` enum('free','premium') NOT NULL DEFAULT 'free',
	`status` enum('active','canceled','past_due') NOT NULL DEFAULT 'active',
	`currentPeriodStart` timestamp,
	`currentPeriodEnd` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_stripeSubscriptionId_unique` UNIQUE(`stripeSubscriptionId`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`leadId` int NOT NULL,
	`amount` int NOT NULL,
	`transactionType` enum('lead_unlock','subscription') NOT NULL,
	`stripePaymentIntentId` varchar(255),
	`status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `artistProfiles_userId_idx` ON `artistProfiles` (`userId`);--> statement-breakpoint
CREATE INDEX `gigLeads_source_idx` ON `gigLeads` (`source`);--> statement-breakpoint
CREATE INDEX `gigLeads_externalId_idx` ON `gigLeads` (`externalId`);--> statement-breakpoint
CREATE INDEX `gigLeads_isApproved_idx` ON `gigLeads` (`isApproved`);--> statement-breakpoint
CREATE INDEX `leadScores_leadId_idx` ON `leadScores` (`leadId`);--> statement-breakpoint
CREATE INDEX `leadScores_artistId_idx` ON `leadScores` (`artistId`);--> statement-breakpoint
CREATE INDEX `leadScores_overallScore_idx` ON `leadScores` (`overallScore`);--> statement-breakpoint
CREATE INDEX `leadUnlocks_userId_idx` ON `leadUnlocks` (`userId`);--> statement-breakpoint
CREATE INDEX `leadUnlocks_leadId_idx` ON `leadUnlocks` (`leadId`);--> statement-breakpoint
CREATE INDEX `subscriptions_userId_idx` ON `subscriptions` (`userId`);--> statement-breakpoint
CREATE INDEX `transactions_userId_idx` ON `transactions` (`userId`);--> statement-breakpoint
CREATE INDEX `transactions_leadId_idx` ON `transactions` (`leadId`);--> statement-breakpoint
CREATE INDEX `transactions_status_idx` ON `transactions` (`status`);