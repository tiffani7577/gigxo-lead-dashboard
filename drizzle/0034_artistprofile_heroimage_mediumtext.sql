-- Hero banner can be large URLs or data URLs; align with other profile image columns
ALTER TABLE artistProfiles MODIFY COLUMN heroImageUrl MEDIUMTEXT NULL;
