# Sample AI Agent

Slack の指定チャンネルからメッセージを取得し、Datadog ログ分析、コード調査、SQL 生成、重複チェックを行うサンプル AI エージェントです。

## セットアップ

```bash
npm install
```

必要な環境変数は `.env.example` を参考に `.env` へ設定してください。

```bash
cp .env.example .env
```

## 実行方法

直近 30 分の Slack メッセージを dry-run で処理します。

```bash
npm run cli:sample:opsMonitoringWorkflow -- C1234567890
```

期間を指定する場合:

```bash
npm run cli:sample:opsMonitoringWorkflow -- C1234567890 "2024-01-01 00:00:00" "2024-01-01 23:59:59"
```

実際に Slack へ投稿する場合は、最後の引数に `false` を指定します。

```bash
npm run cli:sample:opsMonitoringWorkflow -- C1234567890 "2024-01-01 00:00:00" "2024-01-01 23:59:59" false
```

## テスト

```bash
npm test
```