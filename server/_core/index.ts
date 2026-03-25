import "dotenv/config";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { LEAD_SOURCE_KEYS } from "../scraper-collectors/source-config";
if (!Array.isArray(LEAD_SOURCE_KEYS)) {
  (global as any).LEAD_SOURCE_KEYS_OVERRIDE = [
    "reddit",
    "eventbrite",
    "craigslist",
    "dbpr",
    "sunbiz",
    "apify"
  ];
}

import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGoogleAuthRoutes } from "../googleAuth";
import { registerMicrosoftAuthRoutes } from "../microsoftAuthRoutes";
import { registerOutreachRoutes } from "../outreachRoutes";
import { registerSitemapRoute } from "../sitemap";
import { registerStripeWebhook } from "../stripeWebhook";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startDripCron } from "../dripCron";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  app.set("trust proxy", true);
  const server = createServer(app);

  app.use((req, res, next) => {
    const forwarded = req.headers["x-forwarded-host"];
    const host = (Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded || req.headers.host || "")
      .split(",")[0]
      .trim()
      .replace(/:\d+$/, "")
      .toLowerCase()
      .replace(/\.$/, "");

    if (host === "gigxo.com") {
      const raw = req.originalUrl || "/";
      const pathAndQuery = raw.startsWith("/") ? raw : `/${raw}`;
      const location = `https://www.gigxo.com${pathAndQuery}`;
      return res.redirect(301, location);
    }
    next();
  });

  // SEO: register before static SPA fallback so /sitemap.xml is never swallowed by index.html
  registerSitemapRoute(app);

  // Stripe webhook MUST be registered BEFORE express.json() to get raw body
  registerStripeWebhook(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Google OAuth routes
  registerGoogleAuthRoutes(app);
  // Microsoft OAuth (inbox for outreach — teryn@gigxo.com)
  registerMicrosoftAuthRoutes(app);
  // Outreach send (admin only, manual send only)
  registerOutreachRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "3000");

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
    // Start automated drip email cron
    startDripCron().catch(console.error);
  });
}

startServer().catch(console.error);
