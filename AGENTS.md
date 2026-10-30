# 作業再開の指示

1. README.md、docs/REQUIREMENTS.md、docs/ARCHITECTURE.md、docs/STATUS.mdを読む。
2. git status と現在のブランチを確認し、既存の変更を保護する。クラウドタスクは隔離済みなので既存チェックアウトを使い、ユーザーの明示的な依頼なしにworktreeを作らない。
3. Node.js 24.19.0、npm ci、npm test、npm run buildを基本とする。npm run devで起動する。
4. 現在は検証版。端末保存・PWA・クラウド接続コード・権限SQL・管理画面を実装済みだが、実Supabaseと実機Androidは未検証。docs/SUPABASE_SETUP.mdとdocs/TESTING.mdも読む。模擬API試験と実接続成功を混同しない。実データや秘密をリポジトリ・ログに残さない。
5. 要件変更はREQUIREMENTS、進捗・検証結果・残課題はSTATUSに保存してから引き継ぐ。
6. 本番認証ではSupabase RLSによるサーバー側の権限制御を必須とし、service_roleキーをブラウザに置かない。認証・データ同期・CSV・削除は意味のあるテストを伴う。
7. 帳票固有の項目、費用配分、混合分割時の測定単位を推測して確定しない。無料枠での本番保証やAI予測精度の保証をしない。
8. ユーザー向け説明・画面は日本語を基本とする。
