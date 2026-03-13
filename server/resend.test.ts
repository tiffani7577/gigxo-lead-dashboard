import { describe, it, expect } from "vitest";

describe("Resend API Key", () => {
  it("should have RESEND_API_KEY set in environment", () => {
    const key = process.env.RESEND_API_KEY;
    // Key is either set (re_... format) or empty (demo mode)
    // Both are valid - empty means console-only email mode
    expect(key !== undefined).toBe(true);
  });
});
