import { describe, expect, it } from "vitest";

import { getAuth } from "@/lib/auth";

describe("sign-in rate limits", () => {
  it("lets a whole class start Google sign-in from one school IP", () => {
    const rules = getAuth().options.rateLimit?.customRules as Record<string, { window: number; max: number }>;
    const google = rules["/sign-in/social"];
    // 35 students within a minute, from one shared IP.
    expect(google.max / google.window).toBeGreaterThanOrEqual(35 / 60);
  });
});
