# ⛏️ MC Waypoints

マインクラフトの座標を管理するブラウザアプリです。GitHub Pages でそのまま公開できます。

## 機能

- **地点登録** — 名前・XYZ座標・カテゴリ・メモを登録
- **カテゴリ管理** — 村/ネザーゲート/神殿など20種以上のデフォルト + カスタム追加
- **Canvasマップ** — 地点をXZ平面で可視化。ドラッグ移動・ピンチ/ホイール拡縮・90度回転対応
- **中心座標表示** — マップ中央の座標を常時表示
- **音声入力** — 「地名 X Y Z」の順に話すと自動登録（Chrome/Edge）
- **ブラウザ保存** — localStorage に自動保存
- **Export/Import** — JSON形式でデータを持ち運び

## 使い方

### ローカル確認

```bash
npx serve .
# または
python3 -m http.server 8080
```

`http://localhost:8080` を開く。

> `file://` では ES modules が動作しないため、必ずサーバー経由で開いてください。

### GitHub Pages への公開

1. このフォルダをリポジトリのルートに配置
2. Settings → Pages → Source: `main` ブランチ / `/ (root)`
3. `https://yourusername.github.io/your-repo/` で公開完了

## 音声入力の話し方

```
「ダイヤ採掘場 マイナス200 12 350」
「村 120 64 マイナス80」
```

地名・X・Y・Z の順に話すと自動でフォームに入力されます。カテゴリはプルダウンで選択してください。

## ファイル構成

```
index.html
css/style.css
js/
  app.js       — 初期化
  store.js     — localStorage CRUD
  map.js       — Canvas描画エンジン
  speech.js    — 音声認識パーサー
  ui.js        — UI・モーダル
  defaults.js  — デフォルトデータ
```
