/**
 * Custom Email/Password + Google OAuth Authentication
 * Uses bcryptjs for password hashing and JWT for sessions.
 * Supports email verification on signup.
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb } from "./db";
import { users, passwordResetTokens } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { ENV } from "./_core/env";
import crypto from "crypto";

const JWT_SECRET = ENV.cookieSecret || "fallback-secret-change-in-production";
const SESSION_DURATION = "30d";
const RESET_TOKEN_EXPIRY_HOURS = 2;
const VERIFY_TOKEN_EXPIRY_HOURS = 24;

export interface AuthUser {
  id: number;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  emailVerified?: boolean;
  avatarUrl?: string | null;
  hasUsedFreeTrial?: boolean;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Sign up a new user with email and password.
 * Sends a verification email — user can still browse but can't unlock until verified.
 */
export async function signupWithEmail(
  input: SignupInput,
  origin: string = "https://gigxo.com"
): Promise<{ user: AuthUser; token: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const email = input.email.toLowerCase().trim();

  const existing = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    throw new Error("An account with this email already exists");
  }

  if (input.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  // Generate email verification token
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpiry = new Date(Date.now() + VERIFY_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  const result = await db.insert(users).values({
    name: input.name.trim(),
    email,
    passwordHash,
    emailVerified: false,
    emailVerificationToken: verificationToken,
    emailVerificationExpiry: verificationExpiry,
    loginMethod: "email",
    role: "user",
    lastSignedIn: new Date(),
  });

  // Re-query to get the actual user with the correct id (Drizzle MySQL insertId is unreliable)
  const newUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!newUser[0]) {
    throw new Error("Failed to create user account");
  }
  const userId = newUser[0].id;

  // Send verification email (non-blocking)
  try {
    const { sendVerificationEmail } = await import("./email");
    await sendVerificationEmail(email, input.name.trim(), verificationToken, origin);
  } catch (e) {
    console.warn("[Auth] Failed to send verification email:", e);
  }

  const user: AuthUser = {
    id: userId,
    name: input.name.trim(),
    email,
    role: "user",
    emailVerified: false,
  };

  const token = generateToken(user);
  return { user, token };
}

/**
 * Verify email address using the token from the verification email
 */
export async function verifyEmail(token: string): Promise<AuthUser> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const found = await db.select().from(users)
    .where(eq(users.emailVerificationToken, token))
    .limit(1);

  if (found.length === 0) {
    throw new Error("Invalid or expired verification link");
  }

  const user = found[0];

  if (user.emailVerified) {
    // Already verified — just return the user
    return { id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: true };
  }

  if (user.emailVerificationExpiry && new Date() > user.emailVerificationExpiry) {
    throw new Error("This verification link has expired. Please request a new one.");
  }

  // Mark as verified
  await db.update(users).set({
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpiry: null,
  }).where(eq(users.id, user.id));

  return { id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: true };
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(userId: number, origin: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const found = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (found.length === 0) throw new Error("User not found");

  const user = found[0];
  if (user.emailVerified) throw new Error("Email is already verified");
  if (!user.email) throw new Error("No email on file");

  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpiry = new Date(Date.now() + VERIFY_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await db.update(users).set({
    emailVerificationToken: verificationToken,
    emailVerificationExpiry: verificationExpiry,
  }).where(eq(users.id, userId));

  const { sendVerificationEmail } = await import("./email");
  await sendVerificationEmail(user.email, user.name ?? "", verificationToken, origin);
}

/**
 * Log in with email and password
 */
export async function loginWithEmail(input: LoginInput): Promise<{ user: AuthUser; token: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const email = input.email.toLowerCase().trim();
  const found = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (found.length === 0) {
    throw new Error("Invalid email or password");
  }

  const user = found[0];

  if (!user.passwordHash) {
    // Account was created via OAuth (Manus/Google) — guide them to set a password via reset
    throw new Error("No password set for this account. Use \"Forgot password?\" to set one, or sign in with Google.");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new Error("Invalid email or password");
  }

  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

  const authUser: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    avatarUrl: user.avatarUrl,
  };

  const token = generateToken(authUser);
  return { user: authUser, token };
}

/**
 * Sign in or sign up with Google OAuth
 */
export async function loginWithGoogle(googleProfile: {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}): Promise<{ user: AuthUser; token: string; isNew: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const email = googleProfile.email.toLowerCase().trim();

  // Check if user exists by googleId or email
  const existing = await db.select().from(users)
    .where(eq(users.googleId, googleProfile.googleId))
    .limit(1);

  let userId: number;
  let isNew = false;

  if (existing.length > 0) {
    // Existing Google user — update avatar if changed
    userId = existing[0].id;
    await db.update(users).set({
      lastSignedIn: new Date(),
      avatarUrl: googleProfile.avatarUrl ?? existing[0].avatarUrl,
      name: googleProfile.name || existing[0].name,
    }).where(eq(users.id, userId));
  } else {
    // Check if email already exists (link accounts)
    const byEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (byEmail.length > 0) {
      // Link Google to existing email account
      userId = byEmail[0].id;
      await db.update(users).set({
        googleId: googleProfile.googleId,
        avatarUrl: googleProfile.avatarUrl ?? byEmail[0].avatarUrl,
        emailVerified: true,
        lastSignedIn: new Date(),
        loginMethod: "google",
      }).where(eq(users.id, userId));
    } else {
      // New user via Google
      const result = await db.insert(users).values({
        name: googleProfile.name,
        email,
        googleId: googleProfile.googleId,
        avatarUrl: googleProfile.avatarUrl,
        emailVerified: true, // Google emails are pre-verified
        loginMethod: "google",
        role: "user",
        lastSignedIn: new Date(),
      });
      userId = (result as any).insertId as number;
      isNew = true;
    }
  }

  const fresh = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const u = fresh[0];

  const authUser: AuthUser = {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    emailVerified: true,
    avatarUrl: u.avatarUrl,
  };

  const token = generateToken(authUser);
  return { user: authUser, token, isNew };
}

/**
 * Request a password reset email
 */
export async function requestPasswordReset(email: string, origin: string = "https://gigxo.com"): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const normalizedEmail = email.toLowerCase().trim();
  const found = await db.select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (found.length === 0) return; // Prevent email enumeration

  const user = found[0];
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await db.insert(passwordResetTokens).values({ userId: user.id, token, expiresAt });

  const { sendPasswordResetEmail } = await import("./email");
  if (user.email) {
    await sendPasswordResetEmail(user.email, user.name ?? "", token, origin);
  }
}

/**
 * Reset password using a valid token
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");

  const found = await db.select().from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);

  if (found.length === 0) throw new Error("Invalid or expired reset link");

  const resetToken = found[0];
  if (resetToken.usedAt) throw new Error("This reset link has already been used");
  if (new Date() > resetToken.expiresAt) throw new Error("This reset link has expired. Please request a new one.");

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, resetToken.userId));
  await db.update(passwordResetTokens).set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, resetToken.id));
}

/**
 * Verify a JWT token and return the user payload
 */
export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser & { iat: number; exp: number };
    return { id: payload.id, name: payload.name, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: SESSION_DURATION }
  );
}

/**
 * Get user from database by ID
 */
export async function getUserById(id: number): Promise<AuthUser | null> {
  const db = await getDb();
  if (!db) return null;

  const found = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    emailVerified: users.emailVerified,
    avatarUrl: users.avatarUrl,
    hasUsedFreeTrial: users.hasUsedFreeTrial,
  }).from(users).where(eq(users.id, id)).limit(1);

  if (found.length === 0) return null;
  return found[0];
}
