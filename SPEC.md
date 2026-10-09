# MyRaindrop 仕様書

## 概要

Raindrop.io にインスパイアされた、個人用ブックマーク管理 Web アプリ。  
Firebase Firestore によるリアルタイムクラウド同期に対応し、iPhone・iPad・Windows など複数デバイスで同じブックマークを共有できる。  
Chrome 拡張機能からも保存可能。運用対象は `index.html` のオンライン版のみで、起動・同期にはインターネット接続が必要。オフライン起動は提供しない。

- **公開 URL**: https://chiharumurabayashi-stack.github.io/my-raindrop/
- **リポジトリ**: https://github.com/chiharumurabayashi-stack/my-raindrop
- **ホスティング**: GitHub Pages（無料）
- **データベース**: Firebase Firestore（無料枠、プロジェクト ID: `my-raindrop`）

---

## 機能一覧

| 機能 | 説明 |
|------|------|
| ブックマーク追加 | URL・タイトル・コレクション・タグを設定して保存。URL 入力でタイトルを自動取得 |
| クリップボード自動ペースト | 追加ボタン押下時にクリップボードの URL を自動入力 |
| OGP サムネイル自動取得 | corsproxy.io 経由で og:image を取得、失敗時は microlink.io にフォールバック |
| ブックマーク編集 | カードの ✏️ ボタンから編集モーダルを開いて更新 |
| ページを開く | サムネイル（画像または絵文字）をクリックすると新しいタブで開く。「開く」ボタンは設けない |
| ブックマーク削除 | カードの 🗑 ボタンから削除（確認ダイアログあり） |
| コレクション管理 | フォルダ相当。絵文字アイコン付きで作成・編集・削除。ドラッグで並び替え |
| 未分類コレクション | コレクション未設定のブックマークを自動的に「未分類」として表示 |
| タグ付け | チップ形式の入力 UI。既存タグのオートコンプリートドロップダウン付き |
| タグ一括リネーム | サイドバーのタグを右クリック → 名前変更で、全ブックマークのタグを一括更新 |
| タグ削除 | タグを右クリック → 削除で、全ブックマークから一括削除 |
| 検索 | タイトル・URL・タグを横断検索（リアルタイムフィルタ） |
| カード並び替え | 左上のつまみやカードをドラッグし、カード間の青い挿入線にドロップ。前後・先頭・末尾へ移動可能 |
| クラウド同期 | Firebase Firestore でリアルタイム同期。全デバイスに即時反映 |
| ローカルデータの控え | localStorage に保持し、接続待ちの表示や保存失敗時の退避に使用。オフライン起動用ではない |
| JSON エクスポート | 全データを JSON ファイルとしてダウンロード |
| JSON インポート | JSON ファイルからデータを復元・上書き |
| PWA 対応 | ホーム画面への追加でネイティブアプリ風に起動 |
| 旧キャッシュの削除 | Service Worker の更新時に旧アプリ用キャッシュを削除。キャッシュ配信は行わない |
| Chrome 拡張機能 | 閲覧中のページを1クリックで MyRaindrop に保存（Manifest V3） |
| スマホ対応 | ハンバーガーメニューでサイドバーをスライド表示（600px 以下） |
| robots noindex | 検索エンジンにインデックスされないよう設定済み |

---

## 技術スタック

| 項目 | 技術 |
|------|------|
| フロントエンド | HTML / CSS / Vanilla JavaScript（フレームワークなし） |
| データベース | Firebase Firestore（NoSQL クラウド DB）compat SDK v10.12.2 |
| ホスティング | GitHub Pages |
| PWA | Web App Manifest でホーム画面への追加に対応。Service Worker は旧キャッシュ削除用 |
| Chrome 拡張 | Manifest V3、Firestore REST API 使用 |
| タイトル取得 | corsproxy.io + DOMParser → microlink.io フォールバック |
| ビルドツール | なし（HTMLと共通の分類スクリプトを直接配信） |

---

## ファイル構成

```
my-raindrop/
├── index.html            メインアプリ（UI・ロジック・Firebase 連携）
├── manifest.json         PWA 設定（アプリ名・アイコン・表示モード）
├── sw.js                 Service Worker（旧キャッシュの削除のみ）
├── icon.svg              ホーム画面・ブラウザタブ用アイコン
├── SPEC.md               本仕様書
├── README.md             現行オンライン版のユーザーガイド
├── DESIGN.md             デザインルール
├── my-raindrop.html      旧ローカル保存版の参考ファイル（現行版では使用しない）
├── my-raindrop-bookmarks.json  ブックマークデータのバックアップ（JSON エクスポート形式）
└── extension/
    ├── manifest.json     拡張機能マニフェスト（Manifest V3）
    ├── popup.html        拡張機能ポップアップ UI
    ├── classification.js Web版と拡張機能で共通の分類ルール
    └── popup.js          拡張機能ロジック（Firestore REST API）
```

---

## データ構造

### 分類ルール

コレクションは主用途、タグは具体的な検索語として扱う。タグ入力・保存・一括リネーム時に表記を正規化して重複を除く。AIには全既存タグと既存コレクションを渡し、既存タグを0〜3個、既存コレクションを1個まで選ばせる。回答は共通スクリプトで検証し、新規のタグ・コレクションは別の未適用候補欄に表示する。AI回答から自動で新規分類を作らない。手動入力のタグ数は制限しない。

2026年10月の整理では「学習」「研究資料」を統合し、単独だった「スマートシティ」を「クリエイティブ」に移した。「ツール」「資産管理」「ストリーミング」「記事アーカイブ」は用途が伝わる名前に変更した。旧分類の選択状態は同期時に新分類へ引き継ぐ。個人データの作業用バックアップは公開対象外の `local-data/` に保存する。

### Firestore ドキュメントパス

```
コレクション: myraindrop
  ドキュメント: data
    ├── bookmarks: Array<Bookmark>
    ├── collections: Array<Collection>
    └── updatedAt: Timestamp（任意）
```

### Bookmark オブジェクト

```json
{
  "id": 1712345678901,
  "url": "https://example.com",
  "title": "サイト名",
  "collection": "Tech",
  "tags": ["design", "tool"],
  "thumb": "https://example.com/og.png"
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | number | `Date.now()` で生成したユニーク ID |
| `url` | string | ブックマーク URL |
| `title` | string | 表示タイトル |
| `collection` | string | 所属コレクションの `id`。未設定は空文字または省略 |
| `tags` | string[] | タグ名の配列 |
| `thumb` | string | サムネイル画像 URL または絵文字 |
| `quickAccessOrder` | number（任意） | ホームのクイックアクセス内で手動指定した表示順 |
| `recentOrder` | number（任意） | ホームの最近使った項目内で手動指定した表示順 |

ホームの表示対象は従来どおりピン留め・使用頻度・最終使用時刻から選ぶ。各セクション内でドラッグした場合は、選ばれたカードの表示に手動順を優先し、順番未指定のカードはその後に既定順で並べる。セクション間の移動は行わない。通常の一覧ではブックマーク配列の順番を更新する。

### Collection オブジェクト

```json
{
  "id": "Tech",
  "name": "Tech",
  "icon": "💻"
}
```

`id: "all"` は「すべて」の表示に使う予約 ID。初期データでは `collections` に含まれ、その配列は Firestore に保存される。

`id: "__home__"` はホーム表示用の仮想コレクション（Firestore には保存しない）。

`id: "__unclassified__"` は未分類ブックマーク用の仮想コレクション（Firestore には保存しない）。

---

## データフロー

```
ユーザー操作
    ↓
state（メモリ上）を更新
    ↓
画面を再描画（renderSidebar / renderCards）
    ↓
Firestore に保存（saveToFirestore）
    ↓
onSnapshot で全デバイスに自動配信
    ↓
他デバイスの画面が自動更新
```

起動時は localStorage の控えを先に表示し、Firestore から受信したデータで更新する。接続エラー時は控えの表示であることを案内する。保存失敗時も端末内に控えを残すが、未同期の編集を復元・マージする仕組みはない。オンラインでのクラウド保存完了を確認して使用する。

---

## Chrome 拡張機能

### 動作概要

1. 拡張機能アイコンをクリック → ポップアップが開く
2. 現在のタブの URL・タイトルが自動入力される
3. コレクション・タグを選択して「保存」ボタンを押す
4. Firestore REST API 経由でデータを書き込む

### 使用 API

- **Firestore REST API**: `https://firestore.googleapis.com/v1/projects/my-raindrop/databases/(default)/documents/myraindrop/data`
- 認証: 不要（セキュリティルールで public read/write を許可中）

### インストール方法

Chrome 拡張機能は Chrome Web Store には非公開のため、手動インストールが必要。

1. Chrome で `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」をオン
3. 「パッケージ化されていない拡張機能を読み込む」→ `extension/` フォルダを選択

> 他デバイスへの自動同期はできない。各デバイスで手動インストールが必要。

---

## PWA 対応

### ホーム画面への追加方法

| デバイス | 手順 |
|---------|------|
| iPhone / iPad | Safari で URL を開く → 共有ボタン →「ホーム画面に追加」 |
| Android | Chrome で URL を開く → インストールバナーが自動表示 |
| Windows / Mac | Chrome / Edge で URL を開く → アドレスバーのインストールアイコン |

### オンライン専用の読み込み

ホーム画面から起動する場合もインターネット接続が必要。Service Worker は `fetch` を捕捉せず、HTML・静的ファイルはブラウザの通常のネットワーク読み込みに任せる。アプリ独自のキャッシュ配信やオフライン用フォールバックは行わない。

旧バージョンを利用済みのブラウザへ変更を届けるため、`sw.js` の登録は維持する。更新された Service Worker が有効になる際に、`myraindrop-` で始まる Cache Storage のみ削除する。他のアプリのキャッシュや、localStorage 内のブックマークの控え・設定は削除しない。

---

## セキュリティ

### Firestore セキュリティルール（現在の設定）

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /myraindrop/data {
      allow read, write: if true;
    }
  }
}
```

> **注意**: 現在は認証なしで誰でも読み書き可能。URL を知られると第三者が操作できる。  
> 将来的には Firebase Authentication を導入し、`request.auth != null` に変更することを推奨。

### robots 設定

```html
<meta name="robots" content="noindex, nofollow">
```

検索エンジンにインデックスされないよう設定済み。ただし URL を直接知られるとアクセス可能。

---

## 今後の拡張案

- Firebase Authentication によるログイン認証（マルチユーザー対応）
- ダークモード対応
- ブックマークの一括操作（複数選択 → コレクション移動・削除）
- コレクションのネスト（サブコレクション）
- ブックマークのソート順変更（追加日・タイトル順など）
