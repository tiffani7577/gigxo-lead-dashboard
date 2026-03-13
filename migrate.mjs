import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const statements = [
  `CREATE TABLE IF NOT EXISTS \`artistProfiles\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`genres\` json,
    \`location\` varchar(255) NOT NULL DEFAULT 'Miami, FL',
    \`experienceLevel\` enum('beginner','intermediate','professional','expert') NOT NULL DEFAULT 'intermediate',
    \`minBudget\` int NOT NULL DEFAULT 0,
    \`maxDistance\` int NOT NULL DEFAULT 30,
    \`equipment\` json,
    \`bio\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`artistProfiles_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE INDEX IF NOT EXISTS \`artistProfiles_userId_idx\` ON \`artistProfiles\` (\`userId\`)`,
  `CREATE TABLE IF NOT EXISTS \`gigLeads\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`externalId\` varchar(255) NOT NULL,
    \`source\` enum('gigsalad','thebash','facebook','eventbrite','manual') NOT NULL,
    \`title\` varchar(255) NOT NULL,
    \`description\` text,
    \`eventType\` varchar(100),
    \`budget\` int,
    \`location\` varchar(255) NOT NULL,
    \`latitude\` decimal(10,8),
    \`longitude\` decimal(11,8),
    \`eventDate\` timestamp NULL,
    \`contactName\` varchar(255),
    \`contactEmail\` varchar(320),
    \`contactPhone\` varchar(20),
    \`venueUrl\` varchar(2048),
    \`isApproved\` boolean NOT NULL DEFAULT false,
    \`isRejected\` boolean NOT NULL DEFAULT false,
    \`rejectionReason\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`gigLeads_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`gigLeads_externalId_unique\` UNIQUE(\`externalId\`)
  )`,
  `CREATE INDEX IF NOT EXISTS \`gigLeads_source_idx\` ON \`gigLeads\` (\`source\`)`,
  `CREATE INDEX IF NOT EXISTS \`gigLeads_externalId_idx\` ON \`gigLeads\` (\`externalId\`)`,
  `CREATE INDEX IF NOT EXISTS \`gigLeads_isApproved_idx\` ON \`gigLeads\` (\`isApproved\`)`,
  `CREATE TABLE IF NOT EXISTS \`leadScores\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`leadId\` int NOT NULL,
    \`artistId\` int NOT NULL,
    \`overallScore\` int NOT NULL,
    \`payScore\` int NOT NULL,
    \`locationScore\` int NOT NULL,
    \`genreScore\` int NOT NULL,
    \`reputationScore\` int NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`leadScores_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE INDEX IF NOT EXISTS \`leadScores_leadId_idx\` ON \`leadScores\` (\`leadId\`)`,
  `CREATE INDEX IF NOT EXISTS \`leadScores_artistId_idx\` ON \`leadScores\` (\`artistId\`)`,
  `CREATE INDEX IF NOT EXISTS \`leadScores_overallScore_idx\` ON \`leadScores\` (\`overallScore\`)`,
  `CREATE TABLE IF NOT EXISTS \`transactions\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`leadId\` int NOT NULL,
    \`amount\` int NOT NULL,
    \`transactionType\` enum('lead_unlock','subscription') NOT NULL,
    \`stripePaymentIntentId\` varchar(255),
    \`status\` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`transactions_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE INDEX IF NOT EXISTS \`transactions_userId_idx\` ON \`transactions\` (\`userId\`)`,
  `CREATE INDEX IF NOT EXISTS \`transactions_leadId_idx\` ON \`transactions\` (\`leadId\`)`,
  `CREATE INDEX IF NOT EXISTS \`transactions_status_idx\` ON \`transactions\` (\`status\`)`,
  `CREATE TABLE IF NOT EXISTS \`subscriptions\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`stripeSubscriptionId\` varchar(255),
    \`tier\` enum('free','premium') NOT NULL DEFAULT 'free',
    \`status\` enum('active','canceled','past_due') NOT NULL DEFAULT 'active',
    \`currentPeriodStart\` timestamp NULL,
    \`currentPeriodEnd\` timestamp NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`subscriptions_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`subscriptions_stripeSubscriptionId_unique\` UNIQUE(\`stripeSubscriptionId\`)
  )`,
  `CREATE INDEX IF NOT EXISTS \`subscriptions_userId_idx\` ON \`subscriptions\` (\`userId\`)`,
  `CREATE TABLE IF NOT EXISTS \`leadUnlocks\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`leadId\` int NOT NULL,
    \`unlockedAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`leadUnlocks_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE INDEX IF NOT EXISTS \`leadUnlocks_userId_idx\` ON \`leadUnlocks\` (\`userId\`)`,
  `CREATE INDEX IF NOT EXISTS \`leadUnlocks_leadId_idx\` ON \`leadUnlocks\` (\`leadId\`)`,
];

for (const sql of statements) {
  try {
    await conn.query(sql);
    const name = sql.match(/TABLE|INDEX.*?`(\w+)`/)?.[1] || sql.slice(0, 40);
    console.log('✓', name);
  } catch (err) {
    console.error('✗', err.message, '\n  SQL:', sql.slice(0, 80));
  }
}

await conn.end();
console.log('\nMigration complete.');
