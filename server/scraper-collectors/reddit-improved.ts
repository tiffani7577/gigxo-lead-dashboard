import { fetchWithBrowser, extractLinksWithBrowser } from "./browser-collector";

/**
 * Inbound lead capture feature
 * Improved Reddit collector: stores raw candidates first, no early filtering
 * Uses headless browser to bypass anti-bot detection
 */

interface RedditPost {
  title: string;
  selftext: string;
  url: string;
  subreddit: string;
  created_utc: number;
  author: string;
}

// High-value subreddits for event/entertainment hiring
const SUBREDDITS = [
  "weddingplanning",
  "bachelorette",
  "eventplanning",
  "forhire",
  "gigs",
  "weddingphotography",
  "photography",
  "HireAMusician",
  "Entrepreneur",
  "smallbusiness",
];

// Search queries to expand coverage (not just "dj")
const SEARCH_QUERIES = [
  "looking for dj",
  "need a dj",
  "hire dj",
  "booking dj",
  "dj for wedding",
  "dj for event",
  "looking for band",
  "hire band",
  "need entertainment",
  "looking for photographer",
  "hire photographer",
  "need videographer",
  "looking for musician",
];

/**
 * Fetch Reddit posts from subreddit using browser
 * Stores ALL posts found, no early filtering
 * @param subreddit Subreddit name
 * @param query Optional search query
 * @returns Array of raw Reddit posts
 */
async function fetchRedditPostsFromSubreddit(
  subreddit: string,
  query?: string
): Promise<RedditPost[]> {
  try {
    const searchParam = query ? `?q=${encodeURIComponent(query)}` : "";
    const url = `https://www.reddit.com/r/${subreddit}/new.json${searchParam}`;

    console.log(`[Reddit] Fetching ${subreddit}${query ? ` (query: ${query})` : ""}`);

    // Use browser to fetch (looks like real user)
    const html = await fetchWithBrowser(url);

    // Parse JSON from HTML (Reddit JSON API returns JSON directly)
    const jsonMatch = html.match(/<pre>([\s\S]*?)<\/pre>/);
    if (!jsonMatch) {
      console.log(`[Reddit] No JSON found in response for ${subreddit}`);
      return [];
    }

    const data = JSON.parse(jsonMatch[1]);
    const posts: RedditPost[] = [];

    if (data.data?.children) {
      for (const child of data.data.children) {
        const post = child.data;
        // Store ALL posts, no filtering at ingest
        posts.push({
          title: post.title || "",
          selftext: post.selftext || "",
          url: post.url || "",
          subreddit: post.subreddit || "",
          created_utc: post.created_utc || 0,
          author: post.author || "",
        });
      }
    }

    console.log(
      `[Reddit] Collected ${posts.length} raw posts from r/${subreddit}`
    );
    return posts;
  } catch (error) {
    console.error(`[Reddit] Error fetching r/${subreddit}:`, error);
    return [];
  }
}

/**
 * Fetch multiple pages of Reddit posts (pagination)
 * @param subreddit Subreddit name
 * @param pages Number of pages to fetch
 * @returns Array of raw Reddit posts
 */
async function fetchRedditPostsPaginated(
  subreddit: string,
  pages: number = 3
): Promise<RedditPost[]> {
  const allPosts: RedditPost[] = [];

  for (let page = 0; page < pages; page++) {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=100`;
      console.log(`[Reddit] Fetching page ${page + 1} of r/${subreddit}`);

      const html = await fetchWithBrowser(url);
      const jsonMatch = html.match(/<pre>([\s\S]*?)<\/pre>/);
      if (!jsonMatch) continue;

      const data = JSON.parse(jsonMatch[1]);
      if (data.data?.children) {
        for (const child of data.data.children) {
          const post = child.data;
          allPosts.push({
            title: post.title || "",
            selftext: post.selftext || "",
            url: post.url || "",
            subreddit: post.subreddit || "",
            created_utc: post.created_utc || 0,
            author: post.author || "",
          });
        }
      }

      // Small delay between pages to avoid rate limiting
      await new Promise((r) => setTimeout(r, 1000));
    } catch (error) {
      console.error(`[Reddit] Error fetching page ${page + 1}:`, error);
      continue;
    }
  }

  return allPosts;
}

/**
 * Main collector: fetch from multiple subreddits and queries
 * Returns raw candidates with NO filtering
 */
export async function collectRedditPosts(): Promise<
  Array<{
    title: string;
    description: string;
    source: string;
    url: string;
    rawData: RedditPost;
  }>
> {
  const candidates: Array<{
    title: string;
    description: string;
    source: string;
    url: string;
    rawData: RedditPost;
  }> = [];

  // Fetch from each subreddit
  for (const subreddit of SUBREDDITS) {
    const posts = await fetchRedditPostsPaginated(subreddit, 2);

    for (const post of posts) {
      // Store raw post with minimal processing
      candidates.push({
        title: post.title,
        description: post.selftext || post.title,
        source: "reddit",
        url: `https://reddit.com${post.url}`,
        rawData: post,
      });
    }

    // Delay between subreddits
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Also try search queries on key subreddits
  for (const query of SEARCH_QUERIES.slice(0, 5)) {
    // Limit to avoid too many requests
    const posts = await fetchRedditPostsFromSubreddit(
      "weddingplanning",
      query
    );

    for (const post of posts) {
      candidates.push({
        title: post.title,
        description: post.selftext || post.title,
        source: "reddit",
        url: `https://reddit.com${post.url}`,
        rawData: post,
      });
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`[Reddit] Collected ${candidates.length} raw candidates total`);
  return candidates;
}
