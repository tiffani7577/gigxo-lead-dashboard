-- Admin: optional sort priority for /artists (lower = earlier). NULL = not featured.
ALTER TABLE `artistProfiles` ADD COLUMN `directoryFeaturedRank` INT NULL;
