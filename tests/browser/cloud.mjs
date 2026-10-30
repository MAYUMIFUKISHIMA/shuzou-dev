import { chromium } from "playwright-core";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const owner = "10000000-0000-0000-0000-000000000003";
const payload = {
  lot: "SERVER-001",
  date: "2026-10-30",
  process: "仕込み",
  quantity: "1",
  note: "before",
};
let record = {
  id: "20000000-0000-0000-0000-000000000001",
  owner_id: owner,
  payload,
  revision: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};
let failSend = true,
  sent = [];
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.route("http://127.0.0.1:54321/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    const reply = (data, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (path === "/auth/v1/token")
      return reply({
        access_token: "test-token",
        token_type: "bearer",
        refresh_token: "test-refresh",
        expires_in: 3600,
        user: {
          id: owner,
          email: "admin@example.test",
          aud: "authenticated",
          role: "authenticated",
        },
      });
    if (path === "/auth/v1/logout") return reply({});
    if (path === "/rest/v1/profiles") return reply({ role: "admin" });
    if (path === "/rest/v1/work_records") return reply([record]);
    if (path === "/rest/v1/record_history")
      return reply([{ action: "edit", revision: 2, payload: record.payload }]);
    if (path === "/rest/v1/rpc/submit_record") {
      const body = req.postDataJSON();
      sent.push(body.p_id);
      if (failSend) return reply({ message: "Simulated lost response" }, 503);
      return reply(body.p_id);
    }
    if (path === "/rest/v1/rpc/change_record") {
      const body = req.postDataJSON();
      record = {
        ...record,
        revision: record.revision + 1,
        payload: body.p_payload ?? record.payload,
        deleted_at:
          body.p_action === "delete" ? new Date().toISOString() : null,
      };
      return reply(null);
    }
    if (path === "/rest/v1/rpc/create_archive") return reply("archive-1");
    if (path === "/rest/v1/rpc/confirm_archive") return reply(null);
    if (path === "/rest/v1/archive_exports") {
      const a = {
        id: "archive-1",
        created_at: new Date().toISOString(),
        confirmed_at: null,
        snapshot: { schema_version: 1, records: [record], history: [] },
      };
      return reply(url.searchParams.has("id") ? a : [a]);
    }
    return reply({ message: "Unexpected mock route " + path }, 500);
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5174");
  await page.getByLabel("メールアドレス").fill("admin@example.test");
  await page.getByLabel("パスワード").fill("test-only-password");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await page.getByLabel("仕込み番号").fill("QUEUED-001");
  await page.getByRole("button", { name: "端末に一時保存" }).click();
  await page.getByText(/接続あり · 未送信：1件/).waitFor();
  await page.getByRole("button", { name: "未送信分を送信" }).click();
  await page.getByRole("status").filter({ hasText: "送信未完了" }).waitFor();
  await page.reload();
  await page.getByRole("status").filter({ hasText: "送信未完了" }).waitFor();
  failSend = false;
  await page.getByRole("button", { name: "未送信分を送信" }).click();
  await page.getByText(/接続あり · 未送信：0件/).waitFor();
  assert.ok(sent.length >= 2);
  assert.equal(new Set(sent).size, 1);
  await page.getByRole("button", { name: "記録一覧", exact: true }).click();
  await page.getByRole("heading", { name: "SERVER-001" }).waitFor();
  await page.getByRole("button", { name: "修正", exact: true }).click();
  await page.getByLabel("作業メモ").fill("after");
  await page.getByRole("button", { name: "修正を保存" }).click();
  await page.getByText("after", { exact: true }).waitFor();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "復元", exact: true }).waitFor();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "復元", exact: true }).click();
  await page.getByRole("button", { name: "削除", exact: true }).waitFor();
  await page.getByRole("button", { name: "変更履歴" }).click();
  await page.getByRole("heading", { name: "変更履歴" }).waitFor();
  await page.getByRole("button", { name: "CSV・社内保存" }).click();
  await page.getByRole("button", { name: "全記録の出力を作成" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "出力を作成しました" })
    .waitFor();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSVをダウンロード" }).click();
  assert.ok((await downloading).suggestedFilename().endsWith(".csv"));
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "社内保存完了を確認" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "ログアウト・交代" }).click();
  await page.getByRole("heading", { name: "ログイン", exact: true }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  console.log(
    "PASS: mocked Supabase login, failed send retains queue, same-ID retry, edit/delete/restore/history, archive download/confirmation, logout",
  );
} finally {
  await browser.close();
}
