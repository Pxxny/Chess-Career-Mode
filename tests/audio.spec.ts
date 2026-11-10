import { expect, test, type Page } from "@playwright/test";
import { createCareer } from "./helpers";

async function probe(page: Page) {
  await page.addInitScript(() => {
    const state = {
      played: [] as number[],
      decoded: [] as number[],
      oscillators: 0,
    };
    (window as any).__boardAudio = state;
    const proto = AudioContext.prototype;
    const makeSource = proto.createBufferSource;
    proto.createBufferSource = function () {
      const source = makeSource.call(this),
        start = source.start.bind(source);
      source.start = ((...args: Parameters<typeof source.start>) => {
        state.played.push(source.buffer?.duration ?? 0);
        start(...args);
      }) as typeof source.start;
      return source;
    };
    const decode = proto.decodeAudioData;
    proto.decodeAudioData = function (data: ArrayBuffer) {
      return decode.call(this, data).then((buffer) => {
        state.decoded.push(buffer.duration);
        return buffer;
      });
    };
    const oscillator = proto.createOscillator;
    proto.createOscillator = function () {
      state.oscillators++;
      return oscillator.call(this);
    };
  });
}
const playback = (page: Page) =>
  page.evaluate(
    () =>
      (window as any).__boardAudio as {
        played: number[];
        decoded: number[];
        oscillators: number;
      },
  );
async function startFriendly(page: Page) {
  await page.getByRole("link", { name: "Complete", exact: true }).click();
  await page.getByText("Individual match / free play", { exact: true }).click();
  await page.getByRole("button", { name: "White", exact: true }).click();
  await page.getByRole("button", { name: "Friendly", exact: true }).click();
  await page.getByTestId("start-game").click();
  await expect(page.getByTestId("match-viewer")).toBeVisible();
}
async function move(page: Page, from: string, to: string) {
  await page.locator(`[data-square="${from}"]`).click();
  await page.locator(`[data-square="${to}"]`).click();
}

test("live board plays decoded local recordings, stays silent when muted, and resumes recorded moves", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await probe(page);
  await createCareer(page);
  await expect.poll(async () => (await playback(page)).decoded.length).toBe(4);
  expect(
    (await playback(page)).decoded.every((d) => d > 0.3 && d < 0.4),
  ).toBeTruthy();
  await startFriendly(page);
  expect((await playback(page)).played).toEqual([]); // No fake move on mount.
  await move(page, "e2", "e4");
  await expect
    .poll(async () => (await playback(page)).played.length)
    .toBeGreaterThanOrEqual(1);
  await expect(
    page.getByTestId("move-list").locator('button[data-ply="2"]'),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Turn sound off", exact: true })
    .click();
  const muted = (await playback(page)).played.length;
  await move(page, "g1", "f3");
  await expect(
    page.getByTestId("move-list").locator('button[data-ply="4"]'),
  ).toBeVisible();
  expect((await playback(page)).played.length).toBe(muted);
  await page
    .getByRole("button", { name: "Turn sound on", exact: true })
    .click();
  await move(page, "b1", "c3");
  await expect
    .poll(async () => (await playback(page)).played.length)
    .toBeGreaterThan(muted);
  const audio = await playback(page);
  expect(audio.oscillators).toBe(0);
  expect(audio.played.every((d) => d > 0.3 && d < 0.4)).toBeTruthy();
  expect(errors).toEqual([]);
});

test("phone/PWA caches all four recordings and continues to play moves offline", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await probe(page);
  await createCareer(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBeTruthy();
  const files = [
    "/audio/chess/move-1.wav",
    "/audio/chess/move-2.wav",
    "/audio/chess/move-3.wav",
    "/audio/chess/capture.wav",
  ];
  await expect
    .poll(() =>
      page.evaluate(
        async (files) =>
          (await Promise.all(files.map((file) => caches.match(file)))).filter(
            Boolean,
          ).length,
        files,
      ),
    )
    .toBe(4);
  for (const file of files) {
    const response = await page.request.get(file);
    expect(response.ok()).toBeTruthy();
    expect((await response.body()).subarray(0, 4).toString()).toBe("RIFF");
  }
  await startFriendly(page);
  await move(page, "e2", "e4");
  await expect(
    page.getByTestId("move-list").locator('button[data-ply="2"]'),
  ).toBeVisible();
  const before = (await playback(page)).played.length;
  await context.setOffline(true);
  await move(page, "g1", "f3");
  await expect
    .poll(async () => (await playback(page)).played.length)
    .toBeGreaterThan(before);
  expect((await playback(page)).oscillators).toBe(0);
  await page.screenshot({ path: "artifacts/recorded-sounds-mobile.png" });
  await context.setOffline(false);
});

test("saved mute preference works before audio unlock and remains usable in Thai", async ({
  page,
}) => {
  await probe(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem("audio-test-initialized")) {
      localStorage.setItem("chess-career-sound", "off");
      localStorage.setItem("audio-test-initialized", "yes");
    }
  });
  await createCareer(page);
  await expect(
    page.getByRole("button", { name: "Turn sound on", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  expect((await playback(page)).decoded).toEqual([]);
  await page
    .getByRole("button", { name: "Turn sound on", exact: true })
    .click();
  await expect.poll(async () => (await playback(page)).decoded.length).toBe(4);
  expect((await playback(page)).played).toEqual([]);
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("th");
  await page.getByRole("button", { name: "ปิดเสียง", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "เปิดเสียง", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  expect((await playback(page)).decoded).toEqual([]);
  expect((await playback(page)).played).toEqual([]);
});
