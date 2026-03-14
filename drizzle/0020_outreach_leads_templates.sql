-- Outreach & lead intelligence: leads, templates, outreachMessages, microsoftInboxConnection

CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  leadType ENUM('venue_new', 'venue_existing', 'performer') NOT NULL,
  name VARCHAR(255) NULL,
  businessName VARCHAR(255) NULL,
  email VARCHAR(320) NULL,
  phone VARCHAR(32) NULL,
  instagram VARCHAR(255) NULL,
  city VARCHAR(128) NULL,
  state VARCHAR(64) NULL,
  score INT NOT NULL DEFAULT 0,
  status ENUM('new', 'contacted', 'replied', 'booked') NOT NULL DEFAULT 'new',
  source VARCHAR(128) NULL,
  lastContacted TIMESTAMP NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX leads_status_idx (status),
  INDEX leads_leadType_idx (leadType),
  INDEX leads_score_idx (score)
);

CREATE TABLE IF NOT EXISTS templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  targetType ENUM('venue_new', 'venue_existing', 'performer') NOT NULL,
  subjectTemplate TEXT NOT NULL,
  bodyTemplate TEXT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outreachMessages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  leadId INT NOT NULL,
  subject VARCHAR(512) NOT NULL,
  body TEXT NOT NULL,
  templateId INT NULL,
  senderName VARCHAR(128) NULL,
  senderEmail VARCHAR(320) NOT NULL,
  provider VARCHAR(32) NOT NULL DEFAULT 'microsoft',
  messageId VARCHAR(255) NULL,
  sentAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(32) NOT NULL DEFAULT 'sent',
  INDEX outreachMessages_leadId_idx (leadId),
  INDEX outreachMessages_sentAt_idx (sentAt)
);

CREATE TABLE IF NOT EXISTS microsoftInboxConnection (
  id INT AUTO_INCREMENT PRIMARY KEY,
  accessToken TEXT NOT NULL,
  refreshToken TEXT NULL,
  expiresAt TIMESTAMP NOT NULL,
  connectedEmail VARCHAR(320) NOT NULL,
  provider VARCHAR(32) NOT NULL DEFAULT 'microsoft',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
