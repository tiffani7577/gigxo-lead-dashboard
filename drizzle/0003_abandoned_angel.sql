CREATE TABLE `aiPitchDrafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`leadId` int NOT NULL,
	`pitchText` text NOT NULL,
	`stripePaymentIntentId` varchar(255),
	`isPaid` boolean NOT NULL DEFAULT false,
	`isFree` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiPitchDrafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookingInquiries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artistUserId` int NOT NULL,
	`inquirerName` varchar(255) NOT NULL,
	`inquirerEmail` varchar(320) NOT NULL,
	`inquirerPhone` varchar(20),
	`eventType` varchar(100),
	`eventDate` varchar(64),
	`eventLocation` varchar(255),
	`budget` varchar(64),
	`message` text,
	`status` enum('new','read','replied','booked','declined') NOT NULL DEFAULT 'new',
	`artistNotes` text,
	`bookingStage` enum('inquiry','confirmed','completed','cancelled') NOT NULL DEFAULT 'inquiry',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bookingInquiries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `growth_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(50) NOT NULL DEFAULT 'daily',
	`frequency` varchar(50) NOT NULL DEFAULT 'daily',
	`estimated_revenue` varchar(100),
	`status` varchar(30) NOT NULL DEFAULT 'pending',
	`notes` text,
	`last_done_at` timestamp,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_automated` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `growth_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leadViews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`userId` int NOT NULL,
	`viewedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leadViews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `musicTracks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(2048) NOT NULL,
	`durationSeconds` int,
	`fileSizeBytes` int,
	`mimeType` varchar(64) NOT NULL DEFAULT 'audio/mpeg',
	`playCount` int NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `musicTracks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `newsArticles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(512) NOT NULL,
	`summary` text NOT NULL,
	`url` varchar(2048),
	`source` varchar(255),
	`category` varchar(64) NOT NULL DEFAULT 'music',
	`imageUrl` varchar(2048),
	`publishedAt` timestamp,
	`digestDate` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `newsArticles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(64) NOT NULL DEFAULT 'info',
	`title` varchar(255) NOT NULL,
	`body` text,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `owner_checklist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`item_key` varchar(100) NOT NULL,
	`label` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(50) NOT NULL DEFAULT 'launch',
	`is_completed` boolean NOT NULL DEFAULT false,
	`completed_at` timestamp,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `owner_checklist_id` PRIMARY KEY(`id`),
	CONSTRAINT `owner_checklist_item_key_unique` UNIQUE(`item_key`)
);
--> statement-breakpoint
CREATE TABLE `passwordResetTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(255) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `passwordResetTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `passwordResetTokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerId` int NOT NULL,
	`referredId` int NOT NULL,
	`referralCode` varchar(64) NOT NULL,
	`creditAmount` int NOT NULL DEFAULT 700,
	`creditApplied` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userCredits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`source` enum('referral','promo','refund') NOT NULL,
	`referralId` int,
	`isUsed` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userCredits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `venueGigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`venueId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`eventDate` timestamp,
	`budget` int,
	`location` varchar(255) NOT NULL,
	`description` text,
	`genresNeeded` json,
	`status` enum('open','filled','cancelled') NOT NULL DEFAULT 'open',
	`isApproved` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `venueGigs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `venues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`contactName` varchar(255) NOT NULL,
	`contactEmail` varchar(320) NOT NULL,
	`contactPhone` varchar(20),
	`venueType` varchar(100),
	`location` varchar(255) NOT NULL DEFAULT 'Miami, FL',
	`website` varchar(2048),
	`stripeCustomerId` varchar(255),
	`stripeSubscriptionId` varchar(255),
	`planStatus` enum('trial','active','canceled') NOT NULL DEFAULT 'trial',
	`passwordHash` varchar(255),
	`sessionToken` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `venues_id` PRIMARY KEY(`id`),
	CONSTRAINT `venues_contactEmail_unique` UNIQUE(`contactEmail`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64);--> statement-breakpoint
ALTER TABLE `artistProfiles` ADD `djName` varchar(128);--> statement-breakpoint
ALTER TABLE `artistProfiles` ADD `slug` varchar(128);--> statement-breakpoint
ALTER TABLE `artistProfiles` ADD `photoUrl` varchar(2048);--> statement-breakpoint
ALTER TABLE `artistProfiles` ADD `soundcloudUrl` varchar(2048);--> statement-breakpoint
ALTER TABLE `artistProfiles` ADD `mixcloudUrl` varchar(2048);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerified` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerificationToken` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerificationExpiry` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `googleId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` varchar(2048);--> statement-breakpoint
ALTER TABLE `users` ADD `hasUsedFreeTrial` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `artistProfiles` ADD CONSTRAINT `artistProfiles_slug_unique` UNIQUE(`slug`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_googleId_unique` UNIQUE(`googleId`);--> statement-breakpoint
CREATE INDEX `aiPitchDrafts_userId_idx` ON `aiPitchDrafts` (`userId`);--> statement-breakpoint
CREATE INDEX `aiPitchDrafts_leadId_idx` ON `aiPitchDrafts` (`leadId`);--> statement-breakpoint
CREATE INDEX `bookingInquiries_artistUserId_idx` ON `bookingInquiries` (`artistUserId`);--> statement-breakpoint
CREATE INDEX `leadViews_leadId_idx` ON `leadViews` (`leadId`);--> statement-breakpoint
CREATE INDEX `musicTracks_userId_idx` ON `musicTracks` (`userId`);--> statement-breakpoint
CREATE INDEX `newsArticles_digestDate_idx` ON `newsArticles` (`digestDate`);--> statement-breakpoint
CREATE INDEX `newsArticles_category_idx` ON `newsArticles` (`category`);--> statement-breakpoint
CREATE INDEX `notifications_userId_idx` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `notifications_isRead_idx` ON `notifications` (`isRead`);--> statement-breakpoint
CREATE INDEX `passwordResetTokens_token_idx` ON `passwordResetTokens` (`token`);--> statement-breakpoint
CREATE INDEX `passwordResetTokens_userId_idx` ON `passwordResetTokens` (`userId`);--> statement-breakpoint
CREATE INDEX `referrals_referrerId_idx` ON `referrals` (`referrerId`);--> statement-breakpoint
CREATE INDEX `referrals_referredId_idx` ON `referrals` (`referredId`);--> statement-breakpoint
CREATE INDEX `userCredits_userId_idx` ON `userCredits` (`userId`);--> statement-breakpoint
CREATE INDEX `venueGigs_venueId_idx` ON `venueGigs` (`venueId`);--> statement-breakpoint
CREATE INDEX `venueGigs_status_idx` ON `venueGigs` (`status`);--> statement-breakpoint
CREATE INDEX `venues_email_idx` ON `venues` (`contactEmail`);