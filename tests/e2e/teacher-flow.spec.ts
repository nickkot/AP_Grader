/**
 * The MVP definition of done, through the real UI with fake models:
 * sign in, create a class and a DBQ, print the packet, photograph an answer sheet,
 * confirm the transcription, get row scores with evidence, approve, export.
 */
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { getDocumentProxy, renderPageAsImage } from "unpdf";

async function rasterizePage(pdf: Buffer, pageNumber: number): Promise<Buffer> {
  const doc = await getDocumentProxy(new Uint8Array(pdf));
  const image = await renderPageAsImage(doc, pageNumber, { canvasImport: () => import("@napi-rs/canvas"), scale: 2 });
  return Buffer.from(image);
}

async function pageCount(pdf: Buffer) {
  return (await getDocumentProxy(new Uint8Array(pdf))).numPages;
}

test("teacher scores a handwritten DBQ from printed packet to export", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  // Sign in with the development login.
  await page.goto("/sign-in");
  await page.getByLabel("Name").fill("E2E Teacher");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("e2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Classes" })).toBeVisible();

  // Create a class with a roster.
  await page.getByRole("link", { name: "Create class" }).first().click();
  await page.getByLabel("Class name").fill("Period 1");
  await page.getByLabel("Roster").fill("Maya Chen\nRivera, Daniel");
  await page.getByRole("button", { name: "Create class" }).click();
  await expect(page.getByRole("heading", { name: "Period 1" })).toBeVisible();

  // Create a DBQ.
  await page.getByRole("link", { name: "Create assignment" }).click();
  await page.getByLabel("Title").fill("Reform DBQ");
  await page.getByLabel("Prompt").fill("Evaluate the extent to which reform movements from 1820 to 1860 expanded democratic ideals.");
  await page.getByLabel("Document 1 citation").fill("Seneca Falls Declaration, 1848");
  await page.getByLabel("Document 1 text").fill("We hold these truths to be self-evident: that all men and women are created equal.");
  await page.getByRole("button", { name: "Create assignment" }).click();
  await expect(page.getByRole("heading", { name: "Reform DBQ" })).toBeVisible();
  const assignmentUrl = page.url();

  // Print packets: 2 students x 4 pages + 3 spare sets x 4 pages = 20 answer sheets.
  await page.getByRole("button", { name: "Print packets" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download packet" }).click();
  const download = await downloadPromise;
  const pdf = await readFile((await download.path())!);
  const total = await pageCount(pdf);
  const firstAnswerSheet = total - 20 + 1; // Alphabetical: Chen, Maya page 1.
  const photo = await rasterizePage(pdf, firstAnswerSheet);
  await page.keyboard.press("Escape");

  // Upload the "photo" from the phone screen.
  await page.getByRole("link", { name: "Upload photos" }).click();
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles({ name: "page.png", mimeType: "image/png", buffer: photo });
  await expect(page.getByText("1 of 1 pages read")).toBeVisible({ timeout: 60_000 });

  // Check the transcription and send it to scoring.
  await page.goto(assignmentUrl);
  await page.getByRole("link", { name: "Chen, Maya" }).click();
  await expect(page.getByText("Check transcription").first()).toBeVisible();
  await page.getByRole("button", { name: "Confirm and score" }).click();

  // Scores arrive row by row, with quotes from the essay.
  await expect(page.getByRole("button", { name: "Approve" })).toBeVisible({ timeout: 60_000 });
  for (const row of ["Thesis", "Contextualization", "Evidence from the documents", "Sourcing", "Complexity"]) {
    await expect(page.getByRole("group", { name: `${row} points` })).toBeVisible();
  }
  await expect(page.locator("button.essay-text").first()).toBeVisible();

  // Approve with one key.
  await page.keyboard.press("a");
  await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();

  // Export.
  await page.goto(assignmentUrl);
  await expect(page.getByText("Approved").first()).toBeVisible();
  const csvPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  const csv = await readFile((await (await csvPromise).path())!, "utf8");
  expect(csv).toContain('"Chen","Maya","Approved"');
});
