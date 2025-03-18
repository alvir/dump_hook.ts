import { test, expect, Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { DumpHook } from "dump_hook.ts";

const prisma = new PrismaClient();

test.describe("Items Management", () => {
  test.beforeEach(async () => {
    await prisma.todo.deleteMany();
  });

  const createItem = async (page: Page, title: string) => {
    await page.goto("/");
    const initialCount: number = parseInt(
      await page.getByTitle("total").innerText()
    );
    await page.getByPlaceholder("Title").fill(title);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByTitle("total")).toContainText(
      (initialCount + 1).toString()
    );
  };

  test("creates item", async ({ page }) => {
    await createItem(page, "First");
    const list = page.getByRole("list");
    await expect(list).toContainText("First");
    await expect(list.getByRole("listitem")).toHaveCount(1);
  });

  test.describe("deletion", () => {
    test.beforeEach(async ({ page }) => {
      await createItem(page, "First");
    });

    test("deletes item", async ({ page }) => {
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByRole("list")).not.toContainText("First");
    });
  });

  test.describe("order", () => {
    const bulkCreate = async (page: Page) => {
      const list = [
        "First",
        "Second",
        "Third",
        "Fourth",
        "Fifth",
        "Sixth",
        "Seventh",
        "Eighth",
        "Ninth",
        "Tenth"
      ];
      for (const title of list) {
        await createItem(page, title);
      }
    };

    const dumpHook = new DumpHook({
      database: process.env.DATABASE_URL!,
      excludeTables: ["_prisma_migrations"]
    });

    test.beforeEach(async ({ page }) => {
      await dumpHook.execute("order", async () => {
        await bulkCreate(page);
      });
    });

    test("order", async ({ page }) => {
      await page.goto("/");
      const list = page.getByRole("list");
      await expect(page.locator("body")).toContainText("Showing 5 of 10");
      await expect(list).toMatchAriaSnapshot(`
        - listitem: Eighth
        - listitem: Fifth
        - listitem: First
        - listitem: Fourth
        - listitem: Ninth
      `);

      const item = list.getByRole("listitem").nth(2);
      await item.getByRole("button").click();
      await expect(page.locator("body")).toContainText("Showing 5 of 9");
      await expect(list).toMatchAriaSnapshot(`
        - listitem: Eighth
        - listitem: Fifth
        - listitem: Fourth
        - listitem: Ninth
        - listitem: Second
      `);
    });
  });
});
