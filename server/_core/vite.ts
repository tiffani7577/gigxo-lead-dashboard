import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { generateAllPageConfigs, type PageConfig } from "@shared/seo/seoConfig";

const SEO_LANDING_PAGES = new Map<string, PageConfig>(Object.entries(generateAllPageConfigs()));

function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function seoSlugFromPath(pathname: string): string {
  let s = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  while (s.endsWith("/") && s.length > 1) {
    s = s.slice(0, -1);
  }
  return s;
}

function injectSeoIntoIndexHtml(html: string, config: PageConfig, reqPath: string): string {
  const title = escapeHtmlAttr(config.seoTitle);
  const desc = escapeHtmlAttr(config.seoDescription);
  const h1Text = escapeHtmlAttr((config.seoH1?.trim() || config.heading).trim());
  const canonicalPath = reqPath.startsWith("/") ? reqPath : `/${reqPath}`;

  let out = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  out = out.replace(
    /<meta\s+[^>]*name="description"[^>]*content="[^"]*"[^>]*>/i,
    `<meta name="description" content="${desc}" />`
  );

  const headInject = `    <link rel="canonical" href="https://www.gigxo.com${canonicalPath}" />\n    <meta name="robots" content="index, follow" />`;
  out = out.replace(/(\s*)<\/head>/i, `$1${headInject}\n$1</head>`);

  const h1Block = `  <h1 style="position:absolute;width:1px;height:1px;overflow:hidden">${h1Text}</h1>`;
  out = out.replace(/(\s*)<\/body>/i, `$1${h1Block}\n$1</body>`);

  return out;
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  let distPath: string;
  if (process.env.NODE_ENV === "development") {
    distPath = path.resolve(import.meta.dirname, "../..", "dist", "public");
  } else {
    const possiblePaths = [
      path.resolve(import.meta.dirname, "public"),
      path.resolve(process.cwd(), "dist/public"),
      path.resolve(process.cwd(), "client/dist"),
      path.resolve(import.meta.dirname, "../client/dist"),
    ];
    distPath =
      possiblePaths.find((p) => fs.existsSync(path.join(p, "index.html"))) ?? possiblePaths[0];
  }
  console.log("[server] distPath:", distPath);
  console.log("[server] index.html found:", fs.existsSync(path.join(distPath, "index.html")));
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  const indexPath = path.join(distPath, "index.html");
  let cachedIndexHtml: string;
  try {
    cachedIndexHtml = fs.readFileSync(indexPath, "utf-8");
  } catch {
    cachedIndexHtml = "";
    console.error("[server] Failed to read index.html for caching:", indexPath);
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (req, res) => {
    if (!cachedIndexHtml) {
      res.sendFile(path.resolve(distPath, "index.html"));
      return;
    }

    const slug = seoSlugFromPath(req.path);
    const pageConfig = slug ? SEO_LANDING_PAGES.get(slug) : undefined;

    console.log("[SEO] slug:", slug, "found:", !!pageConfig);

    if (pageConfig) {
      const html = injectSeoIntoIndexHtml(cachedIndexHtml, pageConfig, req.path);
      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).send(html);
      return;
    }

    res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).send(cachedIndexHtml);
  });
}
