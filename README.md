# OpenAI Code Inspector

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23122941.svg)](https://doi.org/10.5281/zenodo.23122941)

OpenAI APIを利用して、VS Code上でコードの脆弱性と品質問題を診断する拡張です。

## 機能

- APIキーをSecretStorageへ安全に保存
- OpenAIのモデル一覧取得と日付付きモデル除外
- 単一ファイル、複数ファイル、ワークスペース全体の診断
- 結果を専用Webviewで表示し、該当箇所へジャンプ
- 大きなファイルや機密ファイルを自動除外

## 開発

```bash
npm install
npm run build
```

F5で拡張開発ホストを起動できます。

## ライセンス

このプロジェクトは Apache License 2.0 の下で提供されています。詳細は LICENSE を参照してください。
