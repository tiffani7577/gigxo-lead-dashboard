ALTER TABLE `artistProfiles` MODIFY COLUMN `genres` json;--> statement-breakpoint
ALTER TABLE `artistProfiles` MODIFY COLUMN `location` varchar(255) NOT NULL DEFAULT 'Miami, FL';--> statement-breakpoint
ALTER TABLE `artistProfiles` MODIFY COLUMN `experienceLevel` enum('beginner','intermediate','professional','expert') NOT NULL DEFAULT 'intermediate';--> statement-breakpoint
ALTER TABLE `artistProfiles` MODIFY COLUMN `equipment` json;