import { chromium } from "playwright-core";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext();
  let page = await context.newPage();
  await page.goto("http://127.0.0.1:4173");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.getByLabel("仕込み番号").fill("PWA-RESTART");
  await page.getByRole("button", { name: "端末に一時保存" }).click();
  await page.getByText("未送信：1件", { exact: true }).waitFor();
  await page.close();
  await context.setOffline(true);
  page = await context.newPage();
  await page.goto("http://127.0.0.1:4173");
  await page.getByText("未送信：1件", { exact: true }).waitFor();
  await page.getByLabel("仕込み番号").fill("PWA-OFFLINE");
  await page.getByRole("button", { name: "端末に一時保存" }).click();
  await page.getByText("未送信：2件", { exact: true }).waitFor();
  console.log(
    "PASS: production PWA closes/reopens offline, retained queue, offline new record",
  );
} finally {
  await browser.close();
}
