-- Public /artists directory visibility (admin-controlled). Direct /artist/:slug links unchanged.
ALTER TABLE `artistProfiles` ADD COLUMN `showInDirectory` tinyint(1) NOT NULL DEFAULT 1;
