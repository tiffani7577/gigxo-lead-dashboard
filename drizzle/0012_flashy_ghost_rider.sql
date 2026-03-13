CREATE TABLE `event_window` (
	`id` int AUTO_INCREMENT NOT NULL,
	`city` varchar(128) NOT NULL,
	`region` varchar(128) NOT NULL,
	`market_id` varchar(64) NOT NULL,
	`event_name` varchar(255) NOT NULL,
	`filter_label` varchar(128) NOT NULL,
	`start_date` timestamp NOT NULL,
	`end_date` timestamp NOT NULL,
	`lead_days` int NOT NULL DEFAULT 90,
	`lead_boost_multiplier` decimal(4,2) NOT NULL DEFAULT '1.00',
	`search_keyword_pack` json NOT NULL,
	`relevant_performer_types` json NOT NULL,
	`active_status` boolean NOT NULL DEFAULT true,
	`event_year` int NOT NULL,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_window_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `majorEvents`;--> statement-breakpoint
CREATE INDEX `event_window_market_id_idx` ON `event_window` (`market_id`);--> statement-breakpoint
CREATE INDEX `event_window_start_date_idx` ON `event_window` (`start_date`);--> statement-breakpoint
CREATE INDEX `event_window_active_status_idx` ON `event_window` (`active_status`);