import { expect, type Page } from "@playwright/test";
/** Long-season regression tests explicitly read and continue each important story. */
export async function continueSeasonUntil(page: Page, done: () => Promise<boolean>, timeout = 480000) {
  await expect.poll(async () => {
    const news = page.getByTestId("career-news-article");
    if (await news.isVisible()) {
      const next = news.getByRole("button", { name: /^(Continue season|Next story)$/ });
      if (await next.count()) await next.click();
      else await news.getByRole("button", { name: "Close news", exact: true }).click();
    }
    return done();
  }, { timeout, intervals: [150, 300, 500] }).toBe(true);
}
