# TASK AI

GitHub Pagesで公開する単一ページの仕事管理アプリです。仕事一覧、優先度スコア、同時進行のWIP上限2件はブラウザのlocalStorageを使って従来どおり動作します。相談機能はCloudflare Worker経由でGeminiに接続します。

## Gemini相談のセットアップ

GitHub Pagesは静的ホスティングのため、Gemini APIキーを安全に保持できません。次の手順でサーバー側Workerを用意してください。

1. Cloudflareにログインし、Workers & Pagesで `task-ai-gemini` というWorkerを作成します。
2. このリポジトリの `worker.js` をWorkerのコードとして貼り付けてデプロイします。
3. WorkerのSettings > Variables and SecretsでSecret `GEMINI_API_KEY` を追加し、Google AI StudioのGemini APIキーを設定します。キーはWorker secretだけに保存してください。
4. 環境変数 `ALLOWED_ORIGIN` をGitHub Pagesのオリジンに設定します。通常は `https://n69g87dph5-lab.github.io` です。カスタムドメインを使う場合はそのオリジン（例: `https://tasks.example.com`）にします。末尾のスラッシュやパスは含めません。
5. 任意で `GEMINI_MODEL` を設定できます。省略時は `gemini-2.5-flash` を使います。
6. Workerの公開URLに `/api/chat` を付け、TASK AI画面の「Gemini Worker URL」に入力して保存します。例: `https://task-ai-gemini.<account>.workers.dev/api/chat`

相談履歴はブラウザ内のメモリに保持し、各ターンでWorkerへ送信します。ページを再読み込みすると会話履歴は消えます。APIキーはHTML、JavaScript、localStorageへ送信・保存されません。Workerは設定したOriginからのPOSTのみ受け付け、会話サイズとターン数を制限します。

## ローカル確認

`index.html` はブラウザで直接開けますが、Gemini通信にはHTTPSで公開したWorkerが必要です。Geminiを使わず、仕事登録・一覧・実行中切替・完了操作はローカルでも利用できます。
