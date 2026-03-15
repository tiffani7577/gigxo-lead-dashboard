-- One-time onboarding: performer (dashboard), client (book), venue (venue-dashboard)
ALTER TABLE users ADD COLUMN userType VARCHAR(32) NULL;
