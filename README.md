# 蔵の記録 / shuzou-dev

焼酎製造の仕込み〜蒸留を記録する、共用Android向けWebアプリ。
現在は **帳票未確定の検証版** です。設定なしでは端末保存のデモ、Supabaseの公開設定を入れると個人ログイン・送信・管理画面を使う構成です。実サービス接続と実機Androidは未検証のため、実データでの運用はまだ開始しないでください。

実装済み: 端末保存、送信・再送、権限SQL、変更履歴、24時間以内の復元、CSV/JSON出力と社内保存確認、PWAの圏外起動。

[Supabase設定と制限事項](docs/SUPABASE_SETUP.md) / [テスト手順](docs/TESTING.md)

## 開発を始める

Node.js **24.19.0** と npm を使います。GitHub Codespaces、またはVS CodeのDev Containersで開くと `.devcontainer/devcontainer.json` が利用できます。Dockerコンテナ自体の起動は現クラウドでは未検証です。

```sh
npm ci
npm run dev
```

通常の開発ポートは5173。検証は `npm test` と `npm run build`。本番ビルドの確認は `npm run preview`。

## 次回のCodexで続ける

このGitHubリポジトリを選択してタスクを開き、「AGENTS.mdとdocs/STATUS.mdを読んで続きから進めて」と依頼してください。コードと引き継ぎはGitHubに保存します。会話履歴や動作中のサーバーの復元には依存しません。

- [要件](docs/REQUIREMENTS.md)
- [設計方針](docs/ARCHITECTURE.md)
- [進捗・再開手順](docs/STATUS.md)

作業を切り替える前にcommit/pushし、別の環境では作業ツリーが安全なことを確認して最新の変更を取得してください。秘密鍵・業務データ・CSVの実物はGitに保存しません。

## 端末保存の確認

開いた画面では圏外でも「端末に一時保存」が使えます。保存後は再読み込みしても残ります。利用者交代は確認後に未送信記録と入力途中の内容を破棄します。PWAは本番ビルドで有効です。初回オンライン読み込み後の圏外再起動をブラウザで検証済みです。実認証・クラウド再送信のコードは準備済みで、会社のSupabaseへの接続確認は未実施です。

ブラウザ試験は開発サーバーを起動した状態で `npm run test:browser`。Chromiumの実行パスは `CHROMIUM_PATH` で指定できます（既定 `/usr/bin/chromium`）。GitHub CIではまだブラウザ試験を実行しません。
