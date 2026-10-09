# MyRaindrop Design System

このファイルはAIエージェントおよび開発者向けのデザインシステム定義です。
新しいUIを追加・修正するときは必ずこのファイルに従ってください。

---

## デザイン原則

- **ミニマル**: 装飾より機能。シャドウ・グラデーションは最小限
- **モノクロベース**: カラーアクセントは青・紫と、お気に入り専用のピンク。白いパネルをグレーの一覧背景で区別する
- **0.5px ボーダー**: すべての枠線は `0.5px solid` で繊細さを統一
- **システムフォント**: ネイティブUIに溶け込む `-apple-system` スタック

---

## カラー

### ベースカラー

| 用途 | 値 | 使用箇所 |
|---|---|---|
| テキスト（主） | `#1a1a1a` | 本文、ボタンラベル、入力値 |
| テキスト（副） | `#555` | サイドバー項目、非アクティブ状態 |
| テキスト（弱） | `#888` | ステータスバー |
| テキスト（最弱） | `#aaa` | URL表示、プレースホルダー |
| テキスト（ラベル） | `#999` | セクションラベル、ドロップダウンヘッダー |
| テキスト（数値） | `#bbb` | カウンター、件数 |
| 背景（アプリ） | `#e8e9ec` | body、コンテンツエリア |
| 背景（入力・補助） | `#f5f5f3` | 入力、サムネイル背景、ステータスバー |
| 背景（パネル） | `#fff` | サイドバー、カード、モーダル、トップバー |
| ホバー背景 | `#f0f0ee` | ボタン・リストアイテムのhover |
| ホバー背景（濃） | `#e8e8e6` | 強調したホバー背景 |

### アクセントカラー（青）

| 用途 | 値 |
|---|---|
| タグ背景 | `#e8f0fe` |
| タグ文字 / チップ文字 | `#1a56db` |
| タグhover背景 | `#d0e2fd` |
| ドラッグオーバー背景 | `#e8f0fe` |
| ドラッグ枠線 | `#1a56db` |
| チップ削除hover | `#0d47a1` |

### アクセントカラー（お気に入り / ピンク）

- ハート・検索候補・条件チップの文字: `#c92f68`
- 選択背景: `#fff0f5`、hover: `#ffe0eb`、ボタン枠: `#df7ba0`
- 登録済みは塗りつぶしの ♥、未登録は輪郭の ♡ で区別する。

### アクセントカラー（AI / 紫）

| 用途 | 値 |
|---|---|
| AIボタン グラデーション開始 | `#6366f1` |
| AIボタン グラデーション終了 | `#8b5cf6` |
| AIボタン hover開始 | `#4f46e5` |
| AIボタン hover終了 | `#7c3aed` |

### ステータスカラー

| 状態 | 値 |
|---|---|
| 同期済み | `#4CAF50` |
| 同期中 | `#f59e0b` |
| エラー | `#ef4444` |
| 危険アクション文字 | `#e53e3e` |
| 危険アクション背景 | `#fff0f0` |

### ボーダー

| 用途 | 値 |
|---|---|
| 標準枠線 | `0.5px solid rgba(0,0,0,0.1)` |
| 入力枠線 | `0.5px solid rgba(0,0,0,0.15)` |
| フォーカス枠線 | `0.5px solid rgba(0,0,0,0.35)` |
| コンテキストメニュー枠線 | `0.5px solid rgba(0,0,0,0.12)` |
| セパレーター | `0.5px solid rgba(0,0,0,0.08)` |

---

## タイポグラフィ

### フォントスタック

```
-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
```

すべての要素で `font-family: inherit` を使い、このスタックを継承させること。

### フォントサイズ

| 用途 | サイズ |
|---|---|
| ロゴ / モーダルタイトル相当 | `15–16px` |
| 本文 / ボタン / 入力 | `13px` |
| カードタイトル | `13px / font-weight:500` |
| ラベル / セクション見出し | `12px` |
| タグ / チップ / URLテキスト | `11px` |
| カウンター / 補助テキスト | `11px` |
| カードサマリー | `11px` |
| セクションラベル（大文字） | `11px / uppercase / letter-spacing:0.06em` |
| ステータスバー | `12px` |

---

## 間隔・サイズ

### スペーシング

| 用途 | 値 |
|---|---|
| コンテンツパディング | `16px` |
| カードパディング | `10px` |
| モーダルパディング | `24px` |
| フォームフィールド間隔 | `14px` |
| サイドバー横パディング | `12px` |
| ボタン (通常) | `7px 14px` |
| ボタン (小) | `5px 10px` |
| 入力フィールド | `8px 10px` |
| タグチップ | `2px 7px` |

### 角丸

| 用途 | 値 |
|---|---|
| カード | `12px` |
| モーダル | `12px` |
| ボタン / 入力 | `8px` |
| サイドバー項目 | `8px` |
| タグ / チップ | `99px`（pill形状） |
| コンテキストメニュー | `10px` |
| ドロップダウン | `10px` |
| アイコンボタン (小) | `4–6px` |

### シャドウ

| 用途 | 値 |
|---|---|
| モーダル | `0 8px 32px rgba(0,0,0,0.12)` |
| コンテキストメニュー | `0 4px 20px rgba(0,0,0,0.15)` |
| ドロップダウン | `0 4px 16px rgba(0,0,0,0.1)` |
| モバイルサイドバー開放時 | `4px 0 24px rgba(0,0,0,0.18)` |
| モーダル背景オーバーレイ | `rgba(0,0,0,0.35)` |
| サイドバーオーバーレイ | `rgba(0,0,0,0.4)` |

---

## コンポーネント

### ボタン

```
/* 標準 */
.btn: padding 7px 14px, border 0.5px solid rgba(0,0,0,0.2), border-radius 8px,
      background transparent, font-size 13px, color #1a1a1a
      hover → background #f0f0ee

/* プライマリ（黒塗り） */
.btn-primary: background #1a1a1a, color #fff, border-color #1a1a1a
              hover → background #333

/* AI（紫グラデーション） */
.btn-ai: background linear-gradient(135deg, #6366f1, #8b5cf6), color #fff
         hover → linear-gradient(135deg, #4f46e5, #7c3aed)
         disabled → opacity 0.55
```

### カード

```
background: #fff
border: 0.5px solid rgba(0,0,0,0.16)
border-radius: 12px
hover → border-color: rgba(0,0,0,0.25)

- サムネイル高さ: 110px / background: #f5f5f3 / クリックで新しいタブにページを開く
- サムネイルリンク: hover時 brightness(0.96)、キーボードfocus時 青いoutline
- タイトル: 13px / font-weight:500 / 1行省略
- URL: 11px / color:#aaa / 1行省略
- 「開く」ボタンは置かない。画像なしの絵文字サムネイルもリンクにする
- ドラッグつまみは置かず、カード全体をドラッグして並び替える
- 挿入位置: カード間の青い3px線（背景色で描画）。ドラッグ中のカードは opacity:0.4
- アクションボタン: hover・カード内focus時に表示 (opacity 0→1)
- AI要約: 11px / color:#777 / 最大3行
```

### タグ / チップ

```
background: #e8f0fe
color: #1a56db
border-radius: 99px
font-size: 11px
padding: 2px 7px
hover → background: #d0e2fd
```

### 入力フィールド

```
border: 0.5px solid rgba(0,0,0,0.15)
border-radius: 8px
background: #f5f5f3
font-size: 13px
color: #1a1a1a
focus → border-color: rgba(0,0,0,0.35), background: #fff
```

### モーダル

```
background: #fff
border-radius: 12px
padding: 24px
width: 420px / max-width: 90vw
border: 0.5px solid rgba(0,0,0,0.1)
box-shadow: 0 8px 32px rgba(0,0,0,0.12)
タイトル: 16px / font-weight:500
```

### サイドバー

```
width: 220px
background: #fff
border-right: 0.5px solid rgba(0,0,0,0.1)

セクションラベル: 11px / uppercase / letter-spacing:0.06em / color:#999
アイテム: 13px / border-radius:8px / margin:0 4px / padding:6px 12px
  active → background:#f0f0ee / color:#1a1a1a / font-weight:500
  hover → background:#f0f0ee
  アイテム名: flex:1 / overflow:hidden / text-overflow:ellipsis / white-space:nowrap
```

### 検索と一覧表示

- 「すべて」「お気に入り」「未分類」はコレクション一覧の上に常時表示する。
- サイドバーにはアプリ名の見出しや設定ボタンを置かず、「すべて」から始まる一覧に全体を使う。
- 設定とJSON入出力はトップバーの「追加」の右にある「⋯」メニューにまとめる。
- 検索窓の候補は白いパネル、角丸10px、既定のドロップダウンシャドウ。タグは件数順に並べ、件数を右揃えにする。
- 選択中の条件は検索窓の下に青いチップで表示し、×で個別に解除できる。
- 標準はリスト表示。カード・ヘッドライン・ムードボードを同じ「表示」メニューから選ぶ。
- 画像・タイトル・タグ・説明・URLの表示を調整できる。画像を非表示にするときはタイトルリンクを残す。
- リストの画像は104×76px、モバイルでは64×56px。画像位置は左右から選択する。
- リストの幅が760px以上なら、タイトル・タグと説明を横に並べる。説明は右側で折り返して全文表示し、狭い一覧では下に配置する。
- ムードボードは画像の縦横比を保ち、可変高のカードを列に配置する。
- お気に入りはピンクと塗りつぶしの♥で選択状態を表す。従来の `pinned` データを使用する。

### ステータスバー

```
background: #f5f5f3
border-top: 0.5px solid rgba(0,0,0,0.08)
padding: 8px 16px
font-size: 12px / color:#888

ドット: 7px × 7px / border-radius:50%
  synced → #4CAF50
  syncing → #f59e0b
  error → #ef4444
```

---

## トランジション

| 対象 | 値 |
|---|---|
| ボタン・リスト背景 | `background 0.1s` |
| カード枠線 | `border-color 0.15s` |
| カードアクション表示 | `opacity 0.15s` |
| ステータスドット | `background 0.3s` |
| セクション折りたたみ | `max-height 0.2s ease` |
| 折りたたみアイコン回転 | `transform 0.2s` |
| モバイルサイドバー | `transform 0.25s ease` |

---

## レスポンシブ

### ブレークポイント

| 幅 | 挙動 |
|---|---|
| `> 600px` | サイドバー常時表示、グリッド `auto-fill minmax(200px, 1fr)` |
| `≤ 600px` | サイドバー非表示（ハンバーガーメニューでスライドイン）、グリッド2列固定 |

---

## 禁止事項

- ボーダーに `1px solid` は使わない（必ず `0.5px`）
- カラーアクセントは青・紫とお気に入り専用のピンクに統一する
- `font-family` を直接指定しない（`inherit` を使う）
- テキストの折り返しを防ぐために `white-space:nowrap` + `overflow:hidden` + `text-overflow:ellipsis` をセットで使うこと
- 新しいシャドウを独自に定義しない（上記のいずれかを再利用する）
