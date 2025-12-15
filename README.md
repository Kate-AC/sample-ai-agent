# Sample AI エージェント

## 🎯 主な機能

- **URL指定処理**: SlackメッセージのURLを直接指定して処理

## 🚀 使い方

#### メッセージURLで直接指定

SlackメッセージのURLを指定して直接処理します。

```bash
npm run monitor:slack url <SlackメッセージURL>
```

## 🔧 セットアップ

### 1. package.jsonでsample-mcpを使用する設定を追記

```json
{
  "dependencies": {
    "sample-mcp": "git+https://github.com/Kate-AC/sample-mcp.git#main"
  }
}
```

### 2. jest.config.jsでsample-mcpを使用する設定を追記

```js
module.exports = {
  moduleNameMapper: {
    "^sample-mcp$": "<rootDir>/node_modules/sample-mcp",
  },
};
```

### 3. 依存関係のインストール

```bash
npm install
```

### 4. 環境変数の設定

`.env`ファイルを作成：
環境変数の設定が面倒なので、こちらのREADMEを参照
https://github.com/Kate-AC/sample-mcp

### デバッグ

```bash
# ローカルで特定のメッセージをテスト
npm run monitor:slack url https://xxx.slack.com/archives/xxxxx/xxxxx
```
