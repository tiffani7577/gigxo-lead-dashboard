-- Hotfix: Unknown column 'stripeCheckoutSessionId' in field list (checkout / credits)
-- Drizzle schema + server/stripeWebhook.ts require this column on userCredits.
-- Run on MySQL if migration 0029 was never applied.
ALTER TABLE `userCredits`
  ADD COLUMN `stripeCheckoutSessionId` VARCHAR(255) NULL;

CREATE INDEX `userCredits_stripeCheckoutSessionId_idx` ON `userCredits` (`stripeCheckoutSessionId`);
