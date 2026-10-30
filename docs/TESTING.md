# テストの実行

`npm ci` 後に `npm test` と `npm run build`。

- Nodeテスト: 入力検証とCSVの数式・引用符対策。
- DBテスト: PGlite（PostgreSQL WASM）でSQLマイグレーションを実行。Supabaseのauth.uid()とロールだけをテスト用に定義し、実際のPostgreSQL RLS/GRANT/RPCを検証する。実Supabase Auth/PostgRESTの試験ではない。

## ブラウザ試験
Chromiumをインストール済みなら `CHROMIUM_PATH` に実行ファイルを指定（既定 `/usr/bin/chromium`）。各サーバーを別ターミナルで起動する。

```sh
# デモ端末保存（設定変数なし）
npm run dev -- --port 5173 --strictPort
npm run test:browser

# 接続画面の模擬API試験。次の値はテスト用で、実サービスの認証情報ではない。
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=test-public-key npm run dev -- --port 5174 --strictPort
node tests/browser/cloud.mjs

# PWA圏外再起動（設定変数なしでビルドしたデモ版を使用）
npm run build
npm run preview -- --port 4173 --strictPort
node tests/browser/pwa.mjs
```

模擬API試験はログイン、応答失敗時のキュー保持、同じIDでの再送、修正、削除、復元、履歴、CSV出力・保存確認、ログアウトを確認する。実サービスの接続成功を意味しない。
PWA試験は本番ビルドを読み込み、ページを閉じ、圏外で新しいページを開いて保存済み記録の確認と追加保存を行う。
GitHub CIはNode/DBテストとビルドを実行。ブラウザ試験は現時点で手動実行。
