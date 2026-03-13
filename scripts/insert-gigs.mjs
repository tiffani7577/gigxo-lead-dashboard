import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function insertGigs() {
  try {
    // Load gigs from JSON
    const gigsPath = path.join(__dirname, 'seed-gigs-data.json');
    const gigsData = fs.readFileSync(gigsPath, 'utf8');
    const gigs = JSON.parse(gigsData);

    console.log(`Loaded ${gigs.length} gigs from JSON`);

    // Parse DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable not set');
    }

    const url = new URL(dbUrl);
    const connection = await mysql.createConnection({
      host: url.hostname,
      user: url.username,
      password: url.password,
      database: url.pathname.substring(1),
      port: url.port || 3306,
      ssl: {},
    });

    console.log('Connected to database');

    let inserted = 0;
    for (const gig of gigs) {
      try {
        const budgetCents = Math.round(gig.budget * 100);
        const externalId = `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const query = `
          INSERT INTO \`gigLeads\` 
          (externalId, source, title, description, eventType, budget, location, latitude, longitude, 
           eventDate, contactName, contactEmail, contactPhone, isApproved)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
          externalId,
          'manual',
          gig.title,
          gig.description,
          gig.eventType,
          budgetCents,
          gig.location,
          gig.latitude,
          gig.longitude,
          gig.eventDate,
          gig.contactName,
          gig.contactEmail,
          gig.contactPhone,
          true,
        ];

        await connection.execute(query, values);
        inserted++;

        if (inserted % 10 === 0) {
          console.log(`  Inserted ${inserted} gigs...`);
        }
      } catch (err) {
        console.warn(`  Warning: Failed to insert "${gig.title}": ${err.message}`);
      }
    }

    await connection.end();

    console.log(`\n✓ Successfully inserted ${inserted}/${gigs.length} gigs into database`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

insertGigs();
