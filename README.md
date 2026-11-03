# TASK AI

GitHub Pagesで公開する単一ページの仕事管理アプリです。仕事一覧、優先度スコア、同時進行のWIP上限2件はブラウザのlocalStorageを使って従来どおり動作します。相談機能はCloudflare Worker経由でGeminiに接続します。

## Gemini相談のセットアップ

GitHub Pagesは静的ホスティングのため、Gemini APIキーはCloudflare WorkerのSecretに保管します。このリポジトリの `worker.js` はCloudflare Workers Buildsから自動デプロイできます。

### GitHubからCloudflare Workerを自動デプロイ

1. CloudflareのWorkers & Pagesで既存の `task-ai-gemini` を開き、Settings > Builds > ConnectからこのGitHubリポジトリを接続します。
2. Production branchは `main`、Root directoryはリポジトリのルートにします。Build commandは不要で、Deploy commandは `npx wrangler deploy` を使います。
3. Build watch pathsのIncludeに `worker.js` と `wrangler.jsonc` を設定します。これにより `index.html` やREADMEだけの変更ではWorkerを再デプロイしません。
4. 接続後、`worker.js` または `wrangler.jsonc` を `main` にpushすると、CloudflareがWorkerをビルド・デプロイします。GitHub Pagesの公開は従来どおりGitHub側が行います。

Wrangler設定のWorker名は `task-ai-gemini`、エントリーポイントは `worker.js` です。`keep_vars` により、Cloudflareダッシュボードで管理しているテキスト変数をデプロイ時に保持します。APIキーSecretの値はGitHubへ保存されず、SecretはWranglerデプロイでも保持されます。

### CloudflareのSecretと変数

WorkerのSettings > Variables and Secretsで次を設定します。

- Secret `GEMINI_API_KEY`: Google AI StudioのGemini APIキー。値はGitHubやソースコードに書き込まないでください。
- Text `ALLOWED_ORIGIN`: GitHub Pagesのオリジン。通常は `https://n69g87dph5-lab.github.io` です。末尾のスラッシュやパスは含めません。
- Text `GEMINI_MODEL`: 任意。現在の設定例は `gemini-3.5-flash-lite`。省略時は `gemini-2.5-flash` を使います。

Workerの公開URLに `/api/chat` を付け、TASK AI画面の「Gemini Worker URL」に入力して保存します。例: `https://task-ai-gemini.<account>.workers.dev/api/chat`

相談履歴はブラウザ内のメモリに保持し、各ターンでWorkerへ送信します。ページを再読み込みすると会話履歴は消えます。APIキーはHTML、JavaScript、localStorageへ送信・保存されません。Workerは設定したOriginからのPOSTのみ受け付け、会話サイズとターン数を制限します。

## ローカル確認

`index.html` はブラウザで直接開けますが、Gemini通信にはHTTPSで公開したWorkerが必要です。Geminiを使わず、仕事登録・一覧・実行中切替・完了操作はローカルでも利用できます。
