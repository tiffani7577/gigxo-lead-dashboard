-- Artist outreach table (admin artist acquisition tracking)
-- Run this migration manually on Railway MySQL if not using db:push.

CREATE TABLE IF NOT EXISTS artistOutreach (
  id INT AUTO_INCREMENT PRIMARY KEY,
  artistName VARCHAR(255) NOT NULL,
  instagramHandle VARCHAR(255) NULL,
  city VARCHAR(255) NULL,
  genre VARCHAR(128) NULL,
  contactMethod VARCHAR(64) NULL,
  source VARCHAR(128) NULL,
  followerRange VARCHAR(64) NULL,
  notes TEXT NULL,
  contactedAt TIMESTAMP NULL,
  joinedAt TIMESTAMP NULL,
  lastContactedAt TIMESTAMP NULL,
  status ENUM('new', 'contacted', 'replied', 'joined', 'active_buyer', 'inactive') NOT NULL DEFAULT 'new',
  userId INT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX artistOutreach_status_idx (status),
  INDEX artistOutreach_userId_idx (userId)
);
