/**
 * Visual QA screenshots (see .claude/skills/visual-qa/SKILL.md).
 *
 *   npm run screenshots                 # every default route
 *   npm run screenshots -- /classes     # only routes containing "/classes"
 *
 * Signs in as the seeded demo teacher, then captures each route at laptop (1440x900)
 * and phone (iPhone 14) widths in light and dark mode, and runs axe on each.
 * Output: screenshots/<route>/<viewport>-<theme>.png (git-ignored).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, devices, type BrowserContext } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const BASE = process.env.APP_URL_FOR_SCREENSHOTS ?? "http://localhost:3000";
const EMAIL = "demo@example.com";
const PASSWORD = "demo-password";

async function signedInState(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Sign-in failed (${res.status}). Run npm run db:seed with ENABLE_DEV_LOGIN=true.`);
  const cookies = res.headers.getSetCookie().map((c) => {
    const [pair] = c.split(";");
    const [name, ...rest] = pair.split("=");
    return { name, value: rest.join("="), domain: new URL(BASE).hostname, path: "/" };
  });
  const file = path.resolve("screenshots/.auth.json");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ cookies, origins: [] }));
  return file;
}

/** Resolve demo routes that need IDs by following links from the classes page. */
async function discoverRoutes(ctx: BrowserContext): Promise<Record<string, string>> {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/classes`);
  const classHref = await page.locator('table a[href^="/classes/"]').first().getAttribute("href");
  await page.goto(`${BASE}${classHref}`);
  const assignmentHref = await page.locator('table a[href^="/assignments/"]').first().getAttribute("href");
  await page.goto(`${BASE}${assignmentHref}`);
  const studentLinks = await page.locator('a[href*="/students/"]').evaluateAll((els) =>
    els.map((e) => ({ href: (e as HTMLAnchorElement).getAttribute("href")!, row: e.closest("tr")?.textContent ?? "" })),
  );
  const find = (label: string) => studentLinks.find((l) => l.row.includes(label))?.href;
  await page.close();
  return {
    "sign-in": "/sign-in",
    classes: "/classes",
    class: classHref!,
    "new-class": "/classes/new",
    "new-assignment": `/assignments/new?classId=${classHref!.split("/").pop()}`,
    assignment: assignmentHref!,
    upload: `${assignmentHref}/upload`,
    match: `${assignmentHref}/match`,
    review: find("Needs review") ?? studentLinks[0].href,
    approved: find("Approved") ?? studentLinks[0].href,
    verify: find("Check transcription") ?? studentLinks[0].href,
    empty: find("No pages") ?? studentLinks[0].href,
  };
}

async function main() {
  const filter = process.argv[2];
  const state = await signedInState();
  const browser = await chromium.launch();
  const probe = await browser.newContext({ storageState: state });
  const routes = await discoverRoutes(probe);
  await probe.close();

  const viewports = [
    { name: "laptop", options: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
    { name: "phone", options: { ...devices["iPhone 14"] } },
  ];
  const themes = ["light", "dark"] as const;
  const problems: string[] = [];

  for (const [name, route] of Object.entries(routes)) {
    if (filter && !route.includes(filter) && !name.includes(filter)) continue;
    for (const vp of viewports) {
      for (const theme of themes) {
        const ctx = await browser.newContext({
          ...vp.options,
          colorScheme: theme,
          storageState: name === "sign-in" ? undefined : state,
        });
        const page = await ctx.newPage();
        await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
        const dir = path.resolve("screenshots", name);
        await mkdir(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, `${vp.name}-${theme}.png`), fullPage: true });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        if (overflow) problems.push(`${name} ${vp.name} ${theme}: page scrolls horizontally`);
        if (theme === "light") {
          const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
          for (const v of axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")) {
            problems.push(`${name} ${vp.name}: axe ${v.id} (${v.impact}) x${v.nodes.length}: ${v.help}`);
          }
        }
        await ctx.close();
      }
    }
    console.log(`captured ${name} (${route})`);
  }
  await browser.close();
  if (problems.length) {
    console.log("\nProblems:\n" + problems.map((p) => `- ${p}`).join("\n"));
    process.exitCode = 1;
  } else {
    console.log("\nNo horizontal scroll and no serious or critical axe issues.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
