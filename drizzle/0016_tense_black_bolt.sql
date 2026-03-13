CREATE TABLE `scraperKeywords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`keyword` varchar(128) NOT NULL,
	`type` enum('seeking','entertainment') NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scraperKeywords_id` PRIMARY KEY(`id`),
	CONSTRAINT `scraperKeywords_keyword_unique` UNIQUE(`keyword`)
);
--> statement-breakpoint
CREATE TABLE `scraperSubreddits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subreddit` varchar(128) NOT NULL,
	`cityHint` varchar(255),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scraperSubreddits_id` PRIMARY KEY(`id`),
	CONSTRAINT `scraperSubreddits_subreddit_unique` UNIQUE(`subreddit`)
);
