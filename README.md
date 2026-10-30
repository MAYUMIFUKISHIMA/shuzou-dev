# 蔵の記録 / shuzou-dev

焼酎製造の仕込み〜蒸留を記録する、共用Android向けWebアプリ。
現在は **仮データだけで操作を確認する試作版** です。認証、Supabase接続、永続化、圏外保存はまだありません。実データを入力しないでください。

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
