CREATE TABLE IF NOT EXISTS djOutreachProfiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  instagramHandle VARCHAR(255) NULL,
  email VARCHAR(320) NULL,
  status ENUM('not_contacted', 'messaged', 'responded', 'skipped') NOT NULL DEFAULT 'not_contacted',
  notes TEXT NULL,
  lastMessagedAt TIMESTAMP NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX djOutreachProfiles_status_idx (status),
  INDEX djOutreachProfiles_created_idx (createdAt)
);
