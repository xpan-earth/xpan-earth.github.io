import { expect, test } from "@playwright/test";

test("recorre noticia, deriva, cruce y archivo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: /deriva$/ }).click();
  await expect(page.getByRole("region", { name: "sesión de deriva" })).toBeVisible();
  const before = await page.locator("h1").first().textContent();
  await page.getByRole("button", { name: "otra cosa" }).click();
  await expect(page.locator("h1").first()).not.toHaveText(before || "");
  await page.getByRole("button", { name: /cruces$/ }).click();
  await expect(page.getByText("cruce verificable")).toBeVisible();
  await page.getByRole("button", { name: /archivo$/ }).click();
  await expect(page.getByText("archivo local-first")).toBeVisible();
});

test("abre fuentes, instalación y mantiene foco accesible", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "fuentes" }).click();
  await expect(page.getByRole("dialog", { name: "sources" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "instalar" }).click();
  await expect(page.getByText("En iPhone o iPad")).toBeVisible();
});
