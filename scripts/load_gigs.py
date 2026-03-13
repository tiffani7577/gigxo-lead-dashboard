#!/usr/bin/env python3
"""
Load 100 realistic gigs into the database for Miami/Fort Lauderdale area.
Uses the Manus LLM to generate realistic gig data.
"""

import json
import os
import sys
from datetime import datetime, timedelta
import random

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def generate_gigs():
    """Generate 100 realistic gigs using the Manus LLM."""
    
    prompt = """Generate exactly 100 realistic gig opportunities for musicians/DJs in the Miami and Fort Lauderdale area.
    
Return ONLY a valid JSON array with this exact structure for each gig:
{
  "title": "Wedding Reception DJ Needed - Miami Beach",
  "description": "Looking for experienced DJ for 150-person wedding reception. High energy, good equipment required.",
  "eventType": "Wedding",
  "budget": 1500,
  "location": "Miami Beach, FL",
  "latitude": 25.7907,
  "longitude": -80.1300,
  "eventDate": "2026-04-15T19:00:00Z",
  "contactName": "Sarah Johnson",
  "contactEmail": "sarah.johnson@example.com",
  "contactPhone": "305-555-0123"
}

Requirements:
- Mix of event types: Wedding (30%), Corporate Event (20%), Club Gig (20%), Private Party (15%), Festival (10%), Other (5%)
- Budget range: $300-$5000 (in whole dollars, not cents)
- Locations: Miami, Miami Beach, Fort Lauderdale, Coral Gables, Boca Raton, Aventura, Deerfield Beach, Pompano Beach
- Realistic names and emails (use @example.com domain)
- Phone numbers in 305, 754, or 561 area codes
- Event dates: spread across March-June 2026
- Descriptions should be 1-2 sentences, specific and realistic
- Latitude/Longitude: realistic coordinates for South Florida (25-26°N, -80 to -81°W)

Return ONLY the JSON array, no markdown, no explanation, no extra text."""

    try:
        from manus_mcp_cli import invoke_llm
        
        response = invoke_llm({
            "messages": [
                {
                    "role": "system",
                    "content": "You are a data generator for a gig marketplace. Generate realistic, diverse gig data. Return ONLY valid JSON."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        })
        
        # Parse the response
        content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        
        # Try to extract JSON from the response
        try:
            gigs = json.loads(content)
        except json.JSONDecodeError:
            # Try to find JSON in the content
            import re
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if json_match:
                gigs = json.loads(json_match.group())
            else:
                print(f"Error: Could not parse JSON from response: {content[:200]}")
                return None
        
        if not isinstance(gigs, list):
            print(f"Error: Expected list, got {type(gigs)}")
            return None
            
        print(f"✓ Generated {len(gigs)} gigs")
        if gigs:
            print(f"  Sample: {gigs[0]['title']}")
        
        return gigs
        
    except Exception as e:
        print(f"Error generating gigs: {e}")
        import traceback
        traceback.print_exc()
        return None


def load_gigs_to_db(gigs):
    """Load gigs into the database."""
    if not gigs:
        print("No gigs to load")
        return 0
    
    try:
        import mysql.connector
        from mysql.connector import Error
        
        # Get database connection from environment
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            print("Error: DATABASE_URL not set")
            return 0
        
        # Parse connection string
        # Format: mysql://user:password@host:port/database
        import urllib.parse
        parsed = urllib.parse.urlparse(db_url)
        
        connection = mysql.connector.connect(
            host=parsed.hostname,
            user=parsed.username,
            password=parsed.password,
            database=parsed.path.lstrip('/'),
            port=parsed.port or 3306
        )
        
        cursor = connection.cursor()
        
        inserted = 0
        for gig in gigs:
            try:
                # Convert budget to cents
                budget_cents = int(gig.get("budget", 0) * 100)
                
                # Generate unique external ID
                external_id = f"manual-{datetime.now().timestamp()}-{random.randint(1000, 9999)}"
                
                sql = """
                INSERT INTO gigLeads 
                (externalId, source, title, description, eventType, budget, location, latitude, longitude, 
                 eventDate, contactName, contactEmail, contactPhone, isApproved)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                
                values = (
                    external_id,
                    "manual",
                    gig.get("title", ""),
                    gig.get("description", ""),
                    gig.get("eventType", ""),
                    budget_cents,
                    gig.get("location", ""),
                    gig.get("latitude"),
                    gig.get("longitude"),
                    gig.get("eventDate"),
                    gig.get("contactName", ""),
                    gig.get("contactEmail", ""),
                    gig.get("contactPhone", ""),
                    True  # Auto-approve manual gigs
                )
                
                cursor.execute(sql, values)
                inserted += 1
                
                if inserted % 10 == 0:
                    print(f"  Inserted {inserted} gigs...")
                    
            except Error as e:
                print(f"  Warning: Failed to insert gig '{gig.get('title', 'Unknown')}': {e}")
                continue
        
        connection.commit()
        cursor.close()
        connection.close()
        
        print(f"✓ Inserted {inserted}/{len(gigs)} gigs into database")
        return inserted
        
    except Exception as e:
        print(f"Error loading gigs to database: {e}")
        import traceback
        traceback.print_exc()
        return 0


if __name__ == "__main__":
    print("Loading 100 gigs into Gigxo database...")
    print()
    
    print("Step 1: Generating gigs with LLM...")
    gigs = generate_gigs()
    
    if gigs:
        print()
        print("Step 2: Loading gigs into database...")
        loaded = load_gigs_to_db(gigs)
        
        if loaded > 0:
            print()
            print(f"✓ SUCCESS: {loaded} gigs loaded and ready to sell!")
        else:
            print()
            print("✗ FAILED: Could not load gigs to database")
            sys.exit(1)
    else:
        print()
        print("✗ FAILED: Could not generate gigs")
        sys.exit(1)
