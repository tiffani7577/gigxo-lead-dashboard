-- Allow pro_monthly as source for Pro subscription unlock credits
ALTER TABLE userCredits MODIFY COLUMN source ENUM('referral','promo','refund','pro_monthly') NOT NULL;
