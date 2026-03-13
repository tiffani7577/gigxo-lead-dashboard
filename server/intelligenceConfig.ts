/**
 * Gigxo Intelligence Engine — Feature Weights Configuration
 * ----------------------------------------------------------
 * Tune these weights without redeploying code.
 * All weights should sum to ~1.0 for the composite score calculation.
 *
 * Score formula:
 *   baseScore = intentScore × intentWeight
 *             + contactScore × contactWeight
 *             + freshnessScore × freshnessWeight
 *             + sourceTrust × sourceTrustWeight
 *             + buyerTypeBonus × buyerTypeWeight
 *             + eventWindowBonus × eventWindowWeight
 *             + venuePrestigeBonus × venueTypeWeight
 *
 *   finalScore = baseScore × eventBoostMultiplier
 */

export const INTELLIGENCE_WEIGHTS = {
  intentWeight: 0.35,        // Increased: How strongly AI intent score drives the final score
  contactWeight: 0.20,       // Reduced: Contact quality matters less for aggressive capture
  freshnessWeight: 0.15,     // Recent posts score higher
  sourceTrustWeight: 0.10,   // Reduced: Source reliability matters less for high volume
  buyerTypeWeight: 0.10,     // Increased: Buyer type bonus (corporate/bride score higher)
  eventWindowWeight: 0.06,   // Active event window bonus
  venueTypeWeight: 0.04,     // Venue prestige bonus
};

/**
 * Source trust scores by domain/source type.
 * Scale: 0.0 (junk) → 1.0 (highly reliable)
 */
export const SOURCE_TRUST_SCORES: Record<string, number> = {
  // Reddit — varies by subreddit quality
  "reddit.com/r/weddingplanning":     0.88,
  "reddit.com/r/eventplanning":       0.82,
  "reddit.com/r/HireAMusician":       0.85,
  "reddit.com/r/forhire":             0.65,
  "reddit.com/r/DJs":                 0.78,
  "reddit.com/r/weddingvideography":  0.80,
  "reddit.com/r/photography":         0.72,
  "reddit.com/r/weddingphotography":  0.83,
  "reddit.com/r/malelivingspace":     0.40,
  "reddit.com/r/AskNYC":             0.70,
  "reddit.com/r/Miami":               0.68,
  "reddit.com/r/LosAngeles":          0.68,
  "reddit.com/r/chicago":             0.68,
  "reddit.com/r/Austin":              0.68,
  "reddit.com/r/Atlanta":             0.65,
  "reddit.com/r/nashville":           0.65,
  "reddit.com/r/LasVegas":            0.65,
  "reddit.com/r/houston":             0.65,
  "reddit.com/r/Dallas":              0.65,
  "reddit.com/r/orlando":             0.65,
  "reddit.com/r/phoenix":             0.65,
  "reddit.com/r/washingtondc":        0.68,
  "reddit":                           0.65,  // fallback for any reddit source

  // Craigslist — lower trust, higher noise, but real local intent
  "craigslist.org":                   0.52,
  "craigslist":                       0.52,

  // Wedding/event platforms — high intent, verified buyers
  "theknot.com":                      0.90,
  "weddingwire.com":                  0.88,
  "gigsalad.com":                     0.87,
  "thebash.com":                      0.85,
  "thumbtack.com":                    0.80,
  "bark.com":                         0.75,
  "eventbrite.com":                   0.78,
  "meetup.com":                       0.68,

  // Social / community (updated for aggressive expansion)
  "facebook.com":                     0.60,
  "instagram.com":                    0.52,
  "twitter.com":                      0.48,
  "x.com":                            0.48,
  "nextdoor.com":                     0.72,

  // News / blogs
  "yelp.com":                         0.65,
  "google.com":                       0.60,
  "bing.com":                         0.55,
  "quora.com":                        0.58,

  // Generic fallback
  "default":                          0.35,
};

/**
 * Contact quality scoring.
 * Points are additive — a lead with email + phone + planner name scores 95.
 */
export const CONTACT_QUALITY_SCORES = {
  directEmail: 40,
  directPhone: 35,
  plannerName: 20,
  venueManagerName: 18,
  instagramProfile: 12,
  contactFormUrl: 8,
  linkedInProfile: 10,
  websiteInquiryPage: 6,
  redditUsername: 5,        // Can DM on Reddit
  genericInboxOnly: 2,
};

/**
 * Lead freshness decay multipliers.
 * Applied to the final score based on age of the post.
 */
export const FRESHNESS_DECAY = [
  { maxHours: 24,   multiplier: 1.00 },  // < 1 day: full score
  { maxHours: 72,   multiplier: 0.92 },  // 1–3 days: slight decay
  { maxHours: 168,  multiplier: 0.75 },  // 3–7 days: moderate decay
  { maxHours: 336,  multiplier: 0.55 },  // 7–14 days: significant decay
  { maxHours: 720,  multiplier: 0.35 },  // 14–30 days: low priority
  { maxHours: Infinity, multiplier: 0.15 }, // 30+ days: nearly expired
];

/**
 * Buyer type bonuses (added to composite score).
 * Corporate and event planners have higher budgets and reliability.
 */
export const BUYER_TYPE_BONUSES: Record<string, number> = {
  corporate:      20,   // High budget, professional, reliable
  event_planner:  18,   // Repeat buyer, professional
  venue_manager:  16,   // Recurring relationship potential
  festival:       15,   // High prestige, large audience
  bride:          12,   // High intent, clear timeline
  university:     10,   // Reliable but lower budget
  nightclub:      8,    // Variable budget, high volume
  private:        6,    // One-off, lower budget
  unknown:        0,
};

/**
 * Buyer type classification keywords.
 * Used to detect buyer type from post text.
 */
export const BUYER_TYPE_PATTERNS: Array<{ type: string; patterns: RegExp[] }> = [
  {
    type: "bride",
    patterns: [
      /\b(wedding|bride|bridal|groom|reception|ceremony|nuptial|matrimon)/i,
      /\b(getting married|our wedding|my wedding|wedding day|wedding night)/i,
    ],
  },
  {
    type: "event_planner",
    patterns: [
      /\b(event planner|event coordinator|event company|planning company|event management)/i,
      /\b(we plan|we coordinate|our clients|on behalf of|representing)/i,
    ],
  },
  {
    type: "corporate",
    patterns: [
      /\b(corporate|company|business|office|firm|enterprise|brand|startup|conference|summit|gala|product launch)/i,
      /\b(team building|company event|corporate event|annual meeting|board|executive)/i,
    ],
  },
  {
    type: "venue_manager",
    patterns: [
      /\b(venue|hotel|resort|ballroom|club|lounge|rooftop|bar|restaurant|estate|manor)/i,
      /\b(we host|our venue|venue manager|property manager|general manager)/i,
    ],
  },
  {
    type: "festival",
    patterns: [
      /\b(festival|fest|fair|expo|convention|conference|summit|showcase)/i,
    ],
  },
  {
    type: "nightclub",
    patterns: [
      /\b(nightclub|club night|residency|weekly|friday night|saturday night|after hours|afterparty|after-party)/i,
    ],
  },
  {
    type: "university",
    patterns: [
      /\b(university|college|campus|fraternity|sorority|greek|homecoming|prom|graduation|alumni)/i,
    ],
  },
  {
    type: "private",
    patterns: [
      /\b(birthday|bachelorette|bachelor|anniversary|retirement|graduation party|house party|private party|private event)/i,
    ],
  },
];

/**
 * Venue type detection patterns.
 */
export const VENUE_TYPE_PATTERNS: Array<{ type: string; prestige: number; patterns: RegExp[] }> = [
  { type: "luxury_hotel",       prestige: 90, patterns: [/\b(ritz|four seasons|waldorf|st regis|mandarin oriental|peninsula|rosewood|aman|bulgari|edition hotel|w hotel|1 hotel)/i] },
  { type: "hotel_ballroom",     prestige: 75, patterns: [/\b(hotel|resort|ballroom|grand ballroom|marriott|hilton|hyatt|sheraton|westin|intercontinental|omni|loews)/i] },
  { type: "rooftop",            prestige: 72, patterns: [/\b(rooftop|roof top|roof deck|sky lounge|sky bar|penthouse|terrace|sky terrace)/i] },
  { type: "yacht",              prestige: 85, patterns: [/\b(yacht|boat|vessel|marina|cruise|sailing|charter)/i] },
  { type: "private_estate",     prestige: 80, patterns: [/\b(estate|mansion|villa|private home|private residence|private property)/i] },
  { type: "nightclub",          prestige: 65, patterns: [/\b(nightclub|club|lounge|bar|venue|supper club)/i] },
  { type: "outdoor_festival",   prestige: 60, patterns: [/\b(outdoor|park|garden|lawn|amphitheater|amphitheatre|festival grounds)/i] },
  { type: "corporate_office",   prestige: 55, patterns: [/\b(office|headquarters|conference room|boardroom|corporate campus)/i] },
  { type: "private_residence",  prestige: 45, patterns: [/\b(house|home|backyard|back yard|apartment|condo|loft)/i] },
  { type: "restaurant",         prestige: 50, patterns: [/\b(restaurant|dining room|private dining|banquet hall)/i] },
  { type: "art_gallery",        prestige: 68, patterns: [/\b(gallery|art space|museum|cultural center)/i] },
  { type: "wedding_venue",      prestige: 70, patterns: [/\b(wedding venue|chapel|church|cathedral|barn|vineyard|winery)/i] },
  { type: "university",         prestige: 55, patterns: [/\b(university|college|campus|auditorium|student union)/i] },
];

/**
 * Pitch style mapping by event type + buyer type.
 */
export const PITCH_STYLE_MAP: Record<string, string> = {
  "wedding_bride":              "romantic, elegant, first dance focused — emphasize creating emotional atmosphere",
  "wedding_event_planner":      "professional, reliable, portfolio-forward — show experience with weddings",
  "corporate_corporate":        "polished, background-aware, seamless — emphasize professionalism and adaptability",
  "corporate_event_planner":    "portfolio-driven, references available — emphasize corporate event experience",
  "nightclub_nightclub":        "high energy, crowd control, club experience — show residency history",
  "nightclub_venue_manager":    "residency potential, consistent energy, crowd-building — show local following",
  "festival_festival":          "stage presence, large crowd experience, technical rider — show festival credits",
  "private_bride":              "fun, personal, guest-focused — emphasize reading the room",
  "private_private":            "flexible, fun, personalized — emphasize customization",
  "university_university":      "energetic, crowd-engaging, clean set — show campus event experience",
  "default":                    "professional, versatile, experienced — lead with your strongest event type",
};

/**
 * Suggested rate ranges by city tier + event type + buyer type.
 * Format: "$low–$high"
 */
export const RATE_RANGES: Record<string, Record<string, string>> = {
  // Tier 1 cities (NYC, LA, Miami, Vegas, SF)
  tier1: {
    "wedding_dj":               "$1,500–$3,500",
    "wedding_band":             "$3,000–$8,000",
    "wedding_photographer":     "$2,500–$5,000",
    "wedding_videographer":     "$2,000–$4,500",
    "wedding_makeup":           "$400–$900",
    "corporate_dj":             "$1,200–$2,800",
    "corporate_band":           "$2,500–$6,000",
    "nightclub_dj":             "$500–$2,000",
    "festival_dj":              "$800–$3,000",
    "private_dj":               "$800–$1,800",
    "private_photographer":     "$1,200–$2,500",
    "default":                  "$800–$2,000",
  },
  // Tier 2 cities (Chicago, Houston, Dallas, Atlanta, DC, Nashville)
  tier2: {
    "wedding_dj":               "$1,000–$2,500",
    "wedding_band":             "$2,000–$5,000",
    "wedding_photographer":     "$1,800–$3,500",
    "wedding_videographer":     "$1,500–$3,000",
    "wedding_makeup":           "$300–$700",
    "corporate_dj":             "$900–$2,000",
    "corporate_band":           "$1,800–$4,000",
    "nightclub_dj":             "$400–$1,500",
    "festival_dj":              "$600–$2,000",
    "private_dj":               "$600–$1,400",
    "private_photographer":     "$900–$2,000",
    "default":                  "$600–$1,500",
  },
  // Tier 3 cities (Orlando, Phoenix, smaller markets)
  tier3: {
    "wedding_dj":               "$700–$1,800",
    "wedding_band":             "$1,500–$3,500",
    "wedding_photographer":     "$1,200–$2,500",
    "wedding_videographer":     "$1,000–$2,200",
    "wedding_makeup":           "$200–$500",
    "corporate_dj":             "$600–$1,500",
    "corporate_band":           "$1,200–$3,000",
    "nightclub_dj":             "$300–$1,000",
    "festival_dj":              "$400–$1,500",
    "private_dj":               "$400–$1,000",
    "private_photographer":     "$700–$1,500",
    "default":                  "$400–$1,000",
  },
};

export const CITY_TIER_MAP: Record<string, "tier1" | "tier2" | "tier3"> = {
  miami: "tier1",
  la: "tier1",
  nyc: "tier1",
  las_vegas: "tier1",
  chicago: "tier2",
  houston: "tier2",
  dallas: "tier2",
  atlanta: "tier2",
  dc: "tier2",
  nashville: "tier2",
  orlando: "tier3",
  phoenix: "tier3",
};
