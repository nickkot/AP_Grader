/**
 * Student practice through the real UI with fake models: a teacher makes a class, a new
 * student joins it by code and name, writes an untimed essay, submits it and sees row
 * scores labeled as a practice estimate. The teacher then sees the student as joined.
 */
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, path: string, name: string, email: string) {
  await page.goto(path);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("e2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

const ESSAY =
  "Boredom is useful when it pushes people to make something of their own time. Last summer my phone broke for two weeks, and the empty afternoons felt endless at first. By the second week I had started fixing an old bike with my neighbor, which taught me more about mechanics than any video. Boredom only helps when people have the freedom and materials to act on it, so schools should protect some unscheduled time instead of filling every hour.";

test("student joins by class code, writes a practice essay and sees scores", async ({ browser }) => {
  const stamp = Date.now();

  // Teacher: create a class and read its code.
  const teacherContext = await browser.newContext();
  const teacher = await teacherContext.newPage();
  await signIn(teacher, "/sign-in", "E2E Teacher", `e2e-teacher-${stamp}@example.com`);
  await expect(teacher.getByRole("heading", { name: "Classes" })).toBeVisible();
  await teacher.getByRole("link", { name: "Create class" }).first().click();
  await teacher.getByLabel("Course").selectOption("AP_LANG");
  await teacher.getByLabel("Class name").fill("Period 4");
  await teacher.getByLabel("Roster").fill("Maya Chen\nRivera, Daniel");
  await teacher.getByRole("button", { name: "Create class" }).click();
  await expect(teacher.getByRole("heading", { name: "Period 4" })).toBeVisible();
  const joinLine = await teacher.getByText(/Students join for practice at/).textContent();
  const code = joinLine?.match(/code ([A-Z0-9]{6})/)?.[1];
  expect(code).toBeTruthy();

  // Student: sign up from the join page, enter the code and their name.
  const studentContext = await browser.newContext();
  const student = await studentContext.newPage();
  await signIn(student, `/join?code=${code}`, "Daniel Rivera", `e2e-student-${stamp}@example.com`);
  await expect(student.getByLabel("Class code")).toHaveValue(code!);
  await student.getByRole("button", { name: "Find my class" }).click();
  await expect(student.getByText("You are joining Period 4.")).toBeVisible();
  await student.getByLabel("First name").fill("daniel");
  await student.getByLabel("Last name").fill("RIVERA");
  await student.getByRole("button", { name: "Join class" }).click();
  await expect(student.getByRole("heading", { name: "Practice" })).toBeVisible();
  await expect(student.getByText("Your teacher can see the practice essays you write.")).toBeVisible();

  // Students never reach teacher pages.
  await student.goto("/classes");
  await expect(student).toHaveURL(/\/practice$/);

  // Write an untimed essay from the library.
  await student.getByRole("link", { name: "Library" }).click();
  await student.getByRole("link", { name: "The use of boredom" }).click();
  await student.getByRole("button", { name: "Write without a timer" }).click();
  // On narrow screens the editor sits behind a tab.
  if (await student.getByRole("tab", { name: "Your essay" }).isVisible()) await student.getByRole("tab", { name: "Your essay" }).click();
  await student.getByRole("textbox", { name: "Your essay" }).fill(ESSAY);
  await expect(student.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15_000 });
  await student.getByRole("button", { name: "Submit essay" }).first().click();
  await student.getByRole("dialog").getByRole("button", { name: "Submit essay" }).click();

  // Results open by themselves when scoring finishes.
  await expect(student.getByText("Practice estimate", { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(student.getByText(/ of 6$/)).toBeVisible();
  await expect(student.getByRole("heading", { name: "Thesis" })).toBeVisible();

  // Teacher sees the student joined.
  await teacher.reload();
  await expect(teacher.getByText("1 of 2 joined.", { exact: false })).toBeVisible();
  await expect(teacher.getByRole("row", { name: /Rivera, Daniel/ }).getByText("Joined")).toBeVisible();

  await teacherContext.close();
  await studentContext.close();
});
