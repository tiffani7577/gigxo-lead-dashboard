-- Base64 / data URL profile images exceed VARCHAR(2048) and can exceed TEXT (65KB) for large uploads
ALTER TABLE artistProfiles MODIFY COLUMN photoUrl MEDIUMTEXT NULL;
ALTER TABLE artistProfiles MODIFY COLUMN avatarUrl MEDIUMTEXT NULL;
