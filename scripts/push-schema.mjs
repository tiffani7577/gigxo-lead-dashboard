import mysql from "mysql2/promise";

// Hard-coded Railway MySQL connection string as requested
const RAW_URI =
  "mysql://root:yxwwjgZCALQmhDRYZdcZknTlTnfrqZqw@shortline.proxy.rlwy.net:56572/railway";

function parseMysqlUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: u.username,
    password: u.password,
    database: u.pathname.replace(/^\//, "") || "railway",
  };
}

async function main() {
  const cfg = parseMysqlUrl(RAW_URI);

  const connection = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    multipleStatements: true,
  });

  console.log("[push-schema] Connecting to MySQL");
  console.log("  host:", cfg.host);
  console.log("  port:", cfg.port);
  console.log("  database:", cfg.database);

  const statements = [
    // users
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      openId VARCHAR(64) UNIQUE,
      name TEXT,
      email VARCHAR(320) UNIQUE,
      passwordHash VARCHAR(255),
      emailVerified TINYINT(1) NOT NULL DEFAULT 0,
      emailVerificationToken VARCHAR(255),
      emailVerificationExpiry DATETIME,
      googleId VARCHAR(128) UNIQUE,
      avatarUrl VARCHAR(2048),
      loginMethod VARCHAR(64),
      role ENUM('user','admin') NOT NULL DEFAULT 'user',
      hasUsedFreeTrial TINYINT(1) NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      lastSignedIn DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // artistProfiles
    `CREATE TABLE IF NOT EXISTS artistProfiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      djName VARCHAR(128),
      stageName VARCHAR(128),
      slug VARCHAR(128) UNIQUE,
      photoUrl TEXT,
      heroImageUrl TEXT,
      avatarUrl TEXT,
      genres JSON,
      location VARCHAR(255) NOT NULL DEFAULT 'Miami, FL',
      experienceLevel ENUM('beginner','intermediate','professional','expert') NOT NULL DEFAULT 'intermediate',
      minBudget INT NOT NULL DEFAULT 0,
      maxDistance INT NOT NULL DEFAULT 30,
      equipment JSON,
      bio TEXT,
      currentResidencies JSON,
      soundcloudUrl TEXT,
      mixcloudUrl TEXT,
      youtubeUrl TEXT,
      instagramUrl TEXT,
      tiktokUrl TEXT,
      websiteUrl TEXT,
      templateId VARCHAR(64) NOT NULL DEFAULT 'default',
      themePrimary VARCHAR(16),
      themeAccent VARCHAR(16),
      isPublished TINYINT(1) NOT NULL DEFAULT 0,
      isClaimed TINYINT(1) NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY artistProfiles_userId_unique (userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // gigLeads
    `CREATE TABLE IF NOT EXISTS gigLeads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      externalId VARCHAR(255) NOT NULL UNIQUE,
      source ENUM('gigxo','eventbrite','thumbtack','yelp','craigslist','nextdoor','facebook','manual','gigsalad','thebash','weddingwire','theknot','inbound','reddit') NOT NULL,
      leadType ENUM('scraped_signal','client_submitted','venue_intelligence','referral','manual_outreach') NOT NULL DEFAULT 'scraped_signal',
      title VARCHAR(255) NOT NULL,
      description TEXT,
      eventType VARCHAR(100),
      budget INT,
      location VARCHAR(255) NOT NULL,
      latitude DECIMAL(10,8),
      longitude DECIMAL(11,8),
      eventDate DATETIME,
      contactName VARCHAR(255),
      contactEmail VARCHAR(320),
      contactPhone VARCHAR(20),
      venueUrl VARCHAR(2048),
      performerType ENUM('dj','solo_act','small_band','large_band','singer','instrumentalist','immersive_experience','hybrid_electronic','photo_video','photo_booth','makeup_artist','emcee','princess_character','photographer','videographer','audio_engineer','other') DEFAULT 'other',
      leadCategory ENUM('general','wedding','corporate','private_party','club','other') NOT NULL DEFAULT 'general',
      isApproved TINYINT(1) NOT NULL DEFAULT 0,
      isRejected TINYINT(1) NOT NULL DEFAULT 0,
      rejectionReason TEXT,
      isHidden TINYINT(1) NOT NULL DEFAULT 0,
      isReserved TINYINT(1) NOT NULL DEFAULT 0,
      unlockPriceCents INT,
      contentHash VARCHAR(64),
      buyerType ENUM('bride','event_planner','venue_manager','corporate','festival','nightclub','university','private','unknown') DEFAULT 'unknown',
      sourceLabel VARCHAR(255),
      sourceTrust DECIMAL(4,3),
      contactScore INT,
      freshnessScore DECIMAL(4,3),
      intentScore INT,
      finalScore INT,
      winProbability DECIMAL(4,3),
      competitionLevel ENUM('low','medium','high'),
      suggestedRate VARCHAR(128),
      pitchStyle VARCHAR(255),
      leadTemperature ENUM('hot','warm','cold'),
      prestigeScore INT,
      urgencyScore INT,
      budgetConfidence ENUM('low','medium','high'),
      intentEvidence TEXT,
      contactEvidence TEXT,
      eventEvidence TEXT,
      sourceEvidence TEXT,
      eventWindowId INT,
      scrapeKeyword VARCHAR(255),
      venueType VARCHAR(100),
      estimatedGuestCount INT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX gigLeads_source_idx (source),
      INDEX gigLeads_externalId_idx (externalId),
      INDEX gigLeads_isApproved_idx (isApproved)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // leadScores
    `CREATE TABLE IF NOT EXISTS leadScores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      leadId INT NOT NULL,
      artistId INT NOT NULL,
      overallScore INT NOT NULL,
      payScore INT NOT NULL,
      locationScore INT NOT NULL,
      genreScore INT NOT NULL,
      reputationScore INT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX leadScores_leadId_idx (leadId),
      INDEX leadScores_artistId_idx (artistId),
      INDEX leadScores_overallScore_idx (overallScore)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // transactions
    `CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      leadId INT NOT NULL,
      amount INT NOT NULL,
      transactionType ENUM('lead_unlock','subscription') NOT NULL,
      stripePaymentIntentId VARCHAR(255),
      status ENUM('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX transactions_userId_idx (userId),
      INDEX transactions_leadId_idx (leadId),
      INDEX transactions_status_idx (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // subscriptions
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      stripeSubscriptionId VARCHAR(255) UNIQUE,
      tier ENUM('free','premium') NOT NULL DEFAULT 'free',
      status ENUM('active','canceled','past_due') NOT NULL DEFAULT 'active',
      currentPeriodStart DATETIME,
      currentPeriodEnd DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX subscriptions_userId_idx (userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // leadUnlocks
    `CREATE TABLE IF NOT EXISTS leadUnlocks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      leadId INT NOT NULL,
      unlockedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX leadUnlocks_userId_idx (userId),
      INDEX leadUnlocks_leadId_idx (leadId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // referrals
    `CREATE TABLE IF NOT EXISTS referrals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      referrerId INT NOT NULL,
      referredId INT NOT NULL,
      referralCode VARCHAR(64) NOT NULL,
      creditAmount INT NOT NULL DEFAULT 700,
      creditApplied TINYINT(1) NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX referrals_referrerId_idx (referrerId),
      INDEX referrals_referredId_idx (referredId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // leadViews
    `CREATE TABLE IF NOT EXISTS leadViews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      leadId INT NOT NULL,
      userId INT NOT NULL,
      viewedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX leadViews_leadId_idx (leadId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // userCredits
    `CREATE TABLE IF NOT EXISTS userCredits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      amount INT NOT NULL,
      source ENUM('referral','promo','refund') NOT NULL,
      referralId INT,
      isUsed TINYINT(1) NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX userCredits_userId_idx (userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // musicTracks
    `CREATE TABLE IF NOT EXISTS musicTracks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      fileKey VARCHAR(512) NOT NULL,
      fileUrl VARCHAR(2048) NOT NULL,
      durationSeconds INT,
      fileSizeBytes INT,
      mimeType VARCHAR(64) NOT NULL DEFAULT 'audio/mpeg',
      playCount INT NOT NULL DEFAULT 0,
      sortOrder INT NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX musicTracks_userId_idx (userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // bookingInquiries
    `CREATE TABLE IF NOT EXISTS bookingInquiries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      artistUserId INT NOT NULL,
      inquirerName VARCHAR(255) NOT NULL,
      inquirerEmail VARCHAR(320) NOT NULL,
      inquirerPhone VARCHAR(20),
      eventType VARCHAR(100),
      eventDate VARCHAR(64),
      eventLocation VARCHAR(255),
      budget VARCHAR(64),
      message TEXT,
      status ENUM('new','read','replied','booked','declined') NOT NULL DEFAULT 'new',
      artistNotes TEXT,
      bookingStage ENUM('inquiry','confirmed','completed','cancelled') NOT NULL DEFAULT 'inquiry',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX bookingInquiries_artistUserId_idx (artistUserId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // passwordResetTokens
    `CREATE TABLE IF NOT EXISTS passwordResetTokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      expiresAt DATETIME NOT NULL,
      usedAt DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX passwordResetTokens_token_idx (token),
      INDEX passwordResetTokens_userId_idx (userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // notifications
    `CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      type VARCHAR(64) NOT NULL DEFAULT 'info',
      title VARCHAR(255) NOT NULL,
      body TEXT,
      isRead TINYINT(1) NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX notifications_userId_idx (userId),
      INDEX notifications_isRead_idx (isRead)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // ownerChecklist
    `CREATE TABLE IF NOT EXISTS owner_checklist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      item_key VARCHAR(100) NOT NULL UNIQUE,
      label VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(50) NOT NULL DEFAULT 'launch',
      is_completed TINYINT(1) NOT NULL DEFAULT 0,
      completed_at DATETIME,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // growthTasks
    `CREATE TABLE IF NOT EXISTS growth_tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(50) NOT NULL DEFAULT 'daily',
      frequency VARCHAR(50) NOT NULL DEFAULT 'daily',
      estimated_revenue VARCHAR(100),
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      notes TEXT,
      last_done_at DATETIME,
      sort_order INT NOT NULL DEFAULT 0,
      is_automated TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // venues
    `CREATE TABLE IF NOT EXISTS venues (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      contactName VARCHAR(255) NOT NULL,
      contactEmail VARCHAR(320) NOT NULL UNIQUE,
      contactPhone VARCHAR(20),
      venueType VARCHAR(100),
      location VARCHAR(255) NOT NULL DEFAULT 'Miami, FL',
      website VARCHAR(2048),
      stripeCustomerId VARCHAR(255),
      stripeSubscriptionId VARCHAR(255),
      planStatus ENUM('trial','active','canceled') NOT NULL DEFAULT 'trial',
      passwordHash VARCHAR(255),
      sessionToken VARCHAR(255),
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX venues_email_idx (contactEmail)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // venueGigs
    `CREATE TABLE IF NOT EXISTS venueGigs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      venueId INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      eventType VARCHAR(100) NOT NULL,
      eventDate DATETIME,
      budget INT,
      location VARCHAR(255) NOT NULL,
      description TEXT,
      genresNeeded JSON,
      status ENUM('open','filled','cancelled') NOT NULL DEFAULT 'open',
      isApproved TINYINT(1) NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX venueGigs_venueId_idx (venueId),
      INDEX venueGigs_status_idx (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // aiPitchDrafts
    `CREATE TABLE IF NOT EXISTS aiPitchDrafts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      leadId INT NOT NULL,
      pitchText TEXT NOT NULL,
      stripePaymentIntentId VARCHAR(255),
      isPaid TINYINT(1) NOT NULL DEFAULT 0,
      isFree TINYINT(1) NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX aiPitchDrafts_userId_idx (userId),
      INDEX aiPitchDrafts_leadId_idx (leadId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // newsArticles
    `CREATE TABLE IF NOT EXISTS newsArticles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(512) NOT NULL,
      summary TEXT NOT NULL,
      url VARCHAR(2048),
      source VARCHAR(255),
      category VARCHAR(64) NOT NULL DEFAULT 'music',
      imageUrl VARCHAR(2048),
      publishedAt DATETIME,
      digestDate VARCHAR(10) NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX newsArticles_digestDate_idx (digestDate),
      INDEX newsArticles_category_idx (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // dripEmailLog
    `CREATE TABLE IF NOT EXISTS dripEmailLog (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      dripType ENUM('day3','day7','lead_alert','reengagement') NOT NULL,
      sentAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX dripEmailLog_userId_dripType_idx (userId, dripType)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // event_window
    `CREATE TABLE IF NOT EXISTS event_window (
      id INT AUTO_INCREMENT PRIMARY KEY,
      city VARCHAR(128) NOT NULL,
      region VARCHAR(128) NOT NULL,
      market_id VARCHAR(64) NOT NULL,
      event_name VARCHAR(255) NOT NULL,
      filter_label VARCHAR(128) NOT NULL,
      start_date DATETIME NOT NULL,
      end_date DATETIME NOT NULL,
      lead_days INT NOT NULL DEFAULT 90,
      lead_boost_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,
      search_keyword_pack JSON NOT NULL,
      relevant_performer_types JSON NOT NULL,
      active_status TINYINT(1) NOT NULL DEFAULT 1,
      event_year INT NOT NULL,
      notes TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX event_window_market_id_idx (market_id),
      INDEX event_window_start_date_idx (start_date),
      INDEX event_window_active_status_idx (active_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // leadFeedback
    `CREATE TABLE IF NOT EXISTS leadFeedback (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      leadId INT NOT NULL,
      outcome ENUM('booked','no_response','lost','price_too_high','not_relevant') NOT NULL,
      notes TEXT,
      rateCharged INT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX leadFeedback_userId_idx (userId),
      INDEX leadFeedback_leadId_idx (leadId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // scraperSubreddits
    `CREATE TABLE IF NOT EXISTS scraperSubreddits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      subreddit VARCHAR(128) NOT NULL UNIQUE,
      cityHint VARCHAR(255),
      isActive TINYINT(1) NOT NULL DEFAULT 1,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // scraperKeywords
    `CREATE TABLE IF NOT EXISTS scraperKeywords (
      id INT AUTO_INCREMENT PRIMARY KEY,
      keyword VARCHAR(128) NOT NULL UNIQUE,
      type ENUM('seeking','entertainment') NOT NULL,
      isActive TINYINT(1) NOT NULL DEFAULT 1,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // scraperRuns
    `CREATE TABLE IF NOT EXISTS scraperRuns (
      id INT AUTO_INCREMENT PRIMARY KEY,
      collected INT NOT NULL,
      negativeRejected INT NOT NULL,
      intentRejected INT NOT NULL,
      accepted INT NOT NULL,
      inserted INT NOT NULL,
      skipped INT NOT NULL,
      sourceCounts JSON,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX scraperRuns_createdAt_idx (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // savedSearches
    `CREATE TABLE IF NOT EXISTS savedSearches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      name VARCHAR(128) NOT NULL,
      filterJson JSON NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX savedSearches_userId_idx (userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // explorerPhraseSets
    `CREATE TABLE IF NOT EXISTS explorerPhraseSets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      type ENUM('include','exclude') NOT NULL,
      phrases JSON NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // explorerSourceToggles
    `CREATE TABLE IF NOT EXISTS explorerSourceToggles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sourceKey VARCHAR(32) NOT NULL UNIQUE,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  ];

  try {
    let stmtIndex = 0;
    for (const sql of statements) {
      stmtIndex += 1;
      const firstLine = sql.split("\n")[0].trim();
      const label = `[push-schema] RUNNING statement ${stmtIndex}: ${firstLine}`;
      console.log(label);
      try {
        // eslint-disable-next-line no-await-in-loop
        await connection.query(sql);
      } catch (err) {
        console.error(`[push-schema] FAILED statement ${stmtIndex}`);
        console.error("[push-schema] SQL:", sql);
        console.error("[push-schema] Error:", err);
        throw err;
      }
    }

    // ── Idempotent ALTERs for existing databases ─────────────────────────────

    // Helper to check if a column exists
    async function columnExists(table, column) {
      const [rows] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [cfg.database, table, column]
      );
      return Array.isArray(rows) && rows.length > 0;
    }

    // Helper to check if an index exists
    async function indexExists(table, indexName) {
      const [rows] = await connection.query(
        `SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`,
        [indexName]
      );
      return Array.isArray(rows) && rows.length > 0;
    }

    // ArtistProfiles: ensure all new columns exist
    const artistProfileColumns = [
      ["stageName", "VARCHAR(128)"],
      ["heroImageUrl", "TEXT"],
      ["avatarUrl", "TEXT"],
      ["currentResidencies", "JSON"],
      ["youtubeUrl", "TEXT"],
      ["instagramUrl", "TEXT"],
      ["tiktokUrl", "TEXT"],
      ["websiteUrl", "TEXT"],
      ["templateId", "VARCHAR(64) NOT NULL DEFAULT 'default'"],
      ["themePrimary", "VARCHAR(16)"],
      ["themeAccent", "VARCHAR(16)"],
      ["isPublished", "TINYINT(1) NOT NULL DEFAULT 0"],
      ["isClaimed", "TINYINT(1) NOT NULL DEFAULT 0"],
    ];

    console.log("[push-schema] Checking artistProfiles columns...");
    for (const [col, type] of artistProfileColumns) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await columnExists("artistProfiles", col);
      if (!exists) {
        const sql = `ALTER TABLE artistProfiles ADD COLUMN ${col} ${type}`;
        console.log("[push-schema] RUNNING:", sql);
        try {
          // eslint-disable-next-line no-await-in-loop
          await connection.query(sql);
        } catch (err) {
          console.error("[push-schema] FAILED: add artistProfiles column", col);
          console.error("[push-schema] SQL:", sql);
          console.error("[push-schema] Error:", err);
          throw err;
        }
      } else {
        console.log(`[push-schema] Column artistProfiles.${col} already exists`);
      }
    }

    // Ensure one profile per user at DB level
    const hasUserIdUnique = await indexExists("artistProfiles", "artistProfiles_userId_unique");
    if (!hasUserIdUnique) {
      const sql = `ALTER TABLE artistProfiles ADD CONSTRAINT artistProfiles_userId_unique UNIQUE (userId)`;
      console.log("[push-schema] RUNNING:", sql);
      try {
        await connection.query(sql);
      } catch (err) {
        console.error("[push-schema] FAILED: add unique index artistProfiles_userId_unique");
        console.error("[push-schema] SQL:", sql);
        console.error("[push-schema] Error:", err);
        throw err;
      }
    } else {
      console.log("[push-schema] Unique index artistProfiles_userId_unique already exists");
    }

    // gigLeads: ensure leadType and leadCategory exist
    const gigLeadColumns = [
      ["leadType", "ENUM('scraped_signal','client_submitted','venue_intelligence','referral','manual_outreach') NOT NULL DEFAULT 'scraped_signal'"],
      ["leadCategory", "ENUM('general','wedding','corporate','private_party','club','other') NOT NULL DEFAULT 'general'"],
    ];

    console.log("[push-schema] Checking gigLeads columns...");
    for (const [col, type] of gigLeadColumns) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await columnExists("gigLeads", col);
      if (!exists) {
        const sql = `ALTER TABLE gigLeads ADD COLUMN ${col} ${type}`;
        console.log("[push-schema] RUNNING:", sql);
        try {
          // eslint-disable-next-line no-await-in-loop
          await connection.query(sql);
        } catch (err) {
          console.error("[push-schema] FAILED: add gigLeads column", col);
          console.error("[push-schema] SQL:", sql);
          console.error("[push-schema] Error:", err);
          throw err;
        }
      } else {
        console.log(`[push-schema] Column gigLeads.${col} already exists`);
      }
    }

    // Final schema inspection
    const [gigLeadCols] = await connection.query(`SHOW COLUMNS FROM gigLeads`);
    const [artistProfileCols] = await connection.query(`SHOW COLUMNS FROM artistProfiles`);
    console.log("[push-schema] gigLeads columns:");
    console.log(gigLeadCols);
    console.log("[push-schema] artistProfiles columns:");
    console.log(artistProfileCols);

    console.log("MySQL schema successfully pushed to Railway.");
  } catch (err) {
    console.error("Error pushing schema:", err);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

