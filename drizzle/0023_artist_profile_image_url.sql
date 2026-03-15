-- Uploaded profile image URL (S3/storage)
ALTER TABLE artistProfiles ADD COLUMN profileImageUrl TEXT NULL AFTER avatarUrl;
