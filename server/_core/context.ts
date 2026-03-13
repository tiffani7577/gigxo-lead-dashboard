import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { CUSTOM_AUTH_COOKIE } from "@shared/const";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  if (!cookieHeader) return new Map();
  const map = new Map<string, string>();
  cookieHeader.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (key) map.set(key.trim(), decodeURIComponent(rest.join("=")));
  });
  return map;
}

function extractBearerToken(req: CreateExpressContextOptions["req"]): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1];
  }
  return null;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // Try custom JWT — check Authorization Bearer header first (works in Safari),
  // then fall back to cookie (for backward compatibility)
  try {
    const bearerToken = extractBearerToken(opts.req);
    const cookies = parseCookies(opts.req.headers.cookie);
    const sessionCookie = cookies.get(CUSTOM_AUTH_COOKIE);
    const jwtToken = bearerToken ?? sessionCookie ?? null;

    if (jwtToken) {
      const { verifyToken, getUserById } = await import("../customAuth");
      const payload = verifyToken(jwtToken);
      if (payload && payload.id) {
        const freshUser = await getUserById(payload.id);
        if (freshUser) {
          user = {
            id: freshUser.id,
            name: freshUser.name,
            email: freshUser.email,
            role: freshUser.role,
            openId: null,
            passwordHash: null,
            emailVerified: freshUser.emailVerified ?? false,
            loginMethod: (freshUser as any).loginMethod ?? "email",
            hasUsedFreeTrial: freshUser.hasUsedFreeTrial ?? false,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSignedIn: new Date(),
          } as User;
        }
      }
    }
  } catch {
    user = null;
  }

  // If custom JWT failed, fall back to Manus OAuth (for existing admin accounts)
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch {
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
