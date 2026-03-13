import { invokeLLM } from "../server/_core/llm.js";
import { getDb } from "../server/db.ts";
import { gigLeads } from "../drizzle/schema.ts";

/**
 * Seed 100 high-quality gigs into the database
 * Uses LLM to generate realistic gig data for Miami/Fort Lauderdale area
 */

async function generateGigs() {
  console.log("Generating 100 realistic gigs for Miami/Fort Lauderdale area...");

  const prompt = `Generate 100 realistic gig opportunities for musicians/DJs in the Miami and Fort Lauderdale area. 
  
  Return as JSON array with this structure:
  [
    {
      "title": "Wedding Reception DJ Needed",
      "description": "Looking for experienced DJ for 150-person wedding reception",
      "eventType": "Wedding",
      "budget": 1500,
      "location": "Miami, FL",
      "latitude": 25.7617,
      "longitude": -80.1918,
      "eventDate": "2026-04-15T19:00:00Z",
      "contactName": "Sarah Johnson",
      "contactEmail": "sarah@example.com",
      "contactPhone": "305-555-1234",
      "source": "manual"
    }
  ]
  
  Requirements:
  - Mix of wedding, corporate, club, festival, and private event gigs
  - Budgets range from $300 to $5000
  - Locations in Miami, Fort Lauderdale, Coral Gables, Boca Raton, and surrounding areas
  - Realistic contact names and emails
  - Dates spread across March-June 2026
  - Include various event types (DJ gigs, live bands, electronic acts, etc.)
  - Make it realistic and diverse
  - All dates must be ISO 8601 format
  
  Return ONLY the JSON array, no other text.`;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a data generator for a gig marketplace. Generate realistic gig data.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.choices[0].message.content;
    console.log("Generated content:", content.substring(0, 200));
    
    // Parse the JSON from the response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Could not find JSON array in response");
    }
    
    const gigs = JSON.parse(jsonMatch[0]);

    console.log(`✓ Generated ${gigs.length} gigs`);
    console.log("Sample gig:", gigs[0]);

    // Insert into database
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    let inserted = 0;
    for (const gig of gigs) {
      try {
        await db.insert(gigLeads).values({
          externalId: `manual-${Date.now()}-${Math.random()}`,
          source: "manual",
          title: gig.title,
          description: gig.description,
          eventType: gig.eventType,
          budget: Math.round(gig.budget * 100), // Convert to cents
          location: gig.location,
          latitude: gig.latitude,
          longitude: gig.longitude,
          eventDate: new Date(gig.eventDate),
          contactName: gig.contactName,
          contactEmail: gig.contactEmail,
          contactPhone: gig.contactPhone,
          isApproved: true, // Auto-approve manual gigs
        });
        inserted++;
      } catch (err) {
        console.warn(`Failed to insert gig: ${gig.title}`, err.message);
      }
    }

    console.log(`✓ Inserted ${inserted}/${gigs.length} gigs into database`);
    process.exit(0);
  } catch (error) {
    console.error("Error generating gigs:", error);
    process.exit(1);
  }
}

generateGigs();
