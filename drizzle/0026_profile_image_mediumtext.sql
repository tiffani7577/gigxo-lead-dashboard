-- Allow larger profile images (e.g. base64 data URLs when Forge storage is not configured)
ALTER TABLE artistProfiles MODIFY COLUMN profileImageUrl MEDIUMTEXT NULL;
