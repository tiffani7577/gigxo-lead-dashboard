import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';

const gigs = JSON.parse(readFileSync('./scripts/seed-gigs-comprehensive.json', 'utf-8'));

async function loadGigs() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost',
    user: process.env.DATABASE_URL?.split('://')[1]?.split(':')[0] || 'root',
    password: process.env.DATABASE_URL?.split(':')[2]?.split('@')[0] || '',
    database: process.env.DATABASE_URL?.split('/').pop() || 'gigxo',
    ssl: {
      rejectUnauthorized: false,
    },
  });

  for (const gig of gigs) {
    try {
      await connection.execute(
        `INSERT INTO gigLeads (title, description, eventType, budget, location, contactName, contactEmail, contactPhone, eventDate, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
        [gig.title, gig.description, gig.eventType, gig.budget, gig.location, gig.contactName, gig.contactEmail, gig.contactPhone, gig.eventDate]
      );
      console.log(`✓ Loaded: ${gig.title}`);
    } catch (error) {
      console.error(`✗ Failed to load ${gig.title}:`, error.message);
    }
  }

  await connection.end();
  console.log('Done loading gigs!');
}

loadGigs().catch(console.error);
