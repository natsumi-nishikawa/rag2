# LUMINA 社内ナレッジ検索・VMD提案 RAG Webアプリ

## 概要

架空のアパレル会社「株式会社LUMINA」の店舗スタッフ向けに作成した、
**社内ナレッジ検索・VMD提案 Webアプリ**です。

店舗業務では、接客・返品・在庫・商品取り寄せ・店舗運営・VMDなど、多くの社内ルールやマニュアルを確認する必要があります。

そこで、スタッフが自然な言葉で質問すると、登録された社内PDFから関連情報を検索し、その内容をもとにAIが回答する **RAG（Retrieval-Augmented Generation）** の仕組みを実装しました。

検索ではVector Searchだけでなく、BM25によるキーワード検索、RRFによる検索結果の統合、Rerankingによる関連度の再評価を組み合わせています。

また、アパレル業務への応用として、店舗レイアウトと社内VMD資料をもとに、AIが可動ラックやボディの配置、商品展開を提案する機能も実装しています。

さらにFirebase Authenticationを利用したログイン認証と、Firestoreに保存したユーザー情報を利用した権限管理を実装し、一般スタッフ・店長MG・本社で利用できる機能を分けています。

---

## 開発目的

アパレル店舗では、接客・返品・在庫・店舗運営など確認すべき社内ルールが多く、必要な情報を探すのに時間がかかることを想定しました。

そこで、社内マニュアルや過去トラブル事例をRAGで検索し、スタッフが自然な言葉で質問するだけで、関連資料をもとに回答を得られる社内ナレッジシステムを作成しました。

主な目的は以下です。

* 社内資料を探す時間の短縮
* 店舗ごとの対応品質のばらつき防止
* 新人スタッフの業務支援
* 複数資料を横断した情報検索
* 回答の根拠となった資料の確認
* VMD業務への生成AI活用

---

# 主な機能

## 1. 社内ナレッジ検索

スタッフが社内ルールについて質問すると、登録されたPDFから関連情報を検索し、Geminiが回答を生成します。

質問例：

* 返品は何日以内ですか？
* セール商品の返品はできますか？
* 他店舗から商品を取り寄せできますか？
* レジの現金が合わない場合はどうする？
* 商品の在庫差異が発生した場合は？
* トラブルが発生した場合の報告手順は？

回答とあわせて、検索時に参照した社内資料も確認できます。

一般的な生成AIの知識だけで回答するのではなく、LUMINA独自の社内資料を検索し、その内容を回答の根拠として利用します。

---

## 2. Hybrid Searchによる社内資料検索

検索精度を向上させるため、Vector SearchとBM25を組み合わせたHybrid Searchを実装しています。

### Vector Search

文章をEmbeddingへ変換し、質問と意味が近い文章を検索します。

### BM25

文書内のキーワードを利用して検索します。

商品名、制度名、数値、固有の表現など、意味検索だけでは取りこぼす可能性がある情報を補います。

### RRF

Vector SearchとBM25の検索順位をRRF（Reciprocal Rank Fusion）で統合します。

### Reranking

統合された検索結果をRerankerで再評価し、質問との関連度が高いChunkを優先します。

現在の検索フローは以下です。

```text
スタッフの質問
      ↓
Metadata Filter
      ↓
┌─────────────────┐
│                 │
Vector Search    BM25
│                 │
└────────┬────────┘
         ↓
        RRF
         ↓
     Reranking
         ↓
関連度の高いChunk
         ↓
       Gemini
         ↓
       回答生成
```

Vector Searchだけに依存せず、意味検索とキーワード検索の両方を利用する構成にしています。

---

## 3. Metadataを利用した文書管理・検索

PDF登録時に、PDFファイルだけでなく文書情報も登録します。

主なMetadata：

* 文書番号
* 資料名
* カテゴリ
* 対象者
* 更新日
* 状態
* ファイル名
* ページ番号

これらをChunkと一緒にChromaへ保存します。

VMD提案では、全資料を検索してからVMD資料を探すのではなく、`category=vmd` の資料へ検索対象を絞ったうえでHybrid Searchを行います。

これにより、返品・勤怠・在庫などVMDと関係のない資料が検索候補へ入りにくい構成にしています。

---

## 4. 社内文書管理

RAGで使用するPDFをWeb画面から管理できます。

主な機能：

* PDF登録
* Metadata登録
* 登録済み文書一覧
* PDF閲覧
* PDF削除

開発者が直接フォルダへPDFを配置するのではなく、アプリ画面から社内資料を追加できる構成にしています。

---

## 5. 社員番号によるログイン

Firebase Authenticationを利用してログイン認証を実装しています。

ユーザーはメールアドレスではなく、

```text
社員番号
パスワード
```

を入力してログインします。

入力された社員番号はアプリ内部でFirebase Authentication用の形式へ変換して認証しています。

---

## 6. ユーザー権限管理

ユーザー情報と権限はFirestoreで管理しています。

現在の権限は以下の3種類です。

| 権限     | 主な操作                 |
| ------ | -------------------- |
| 一般スタッフ | ナレッジ検索、VMD、資料閲覧      |
| 店長・MG  | 一般スタッフの機能 + PDF登録・削除 |
| 本社     | 店長・MGの機能 + 社員管理      |

画面上で機能を非表示にするだけでなく、PDF登録・削除などの管理処理ではバックエンド側でもFirebase ID Tokenを確認し、ユーザー権限を判定する構成にしています。

---

## 7. 社員管理

本社ユーザー向けに社員管理機能を実装しています。

主な機能：

* 社員登録
* 社員一覧表示
* 氏名・所属・権限の変更
* 利用停止・再開
* 社員削除

社員のパスワードはFirestoreへ保存せず、Firebase Authenticationで管理します。

---

# VMD機能

## 8. 店舗レイアウト作成

VMD提案に使用する店舗レイアウトを作成できます。

配置できる主な固定設備：

* 入口
* レジ
* 試着室
* テーブル
* 壁面ラック
* 固定ラック

店舗の横幅・奥行きや、テーブルの形状・サイズなども設定できます。

固定設備はドラッグして、実際の店舗に近い位置へ配置できます。

---

## 9. 店舗レイアウト保存

作成した店舗レイアウトを保存し、再利用できます。

保存する主な情報：

* 店舗名
* 店舗形状
* 店舗サイズ
* 固定設備
* 固定設備の位置
* 固定設備のサイズ・向き

季節、重点商品、商品量、可動ラック数、ボディ数など、VMDごとに変化する条件は店舗データには保存せず、VMD提案時に入力する設計にしています。

---

## 10. AIによるVMD提案

店舗レイアウトに加えて、

* 季節
* 重点商品
* 商品量
* 可動ラック数
* ボディ数

などの条件を入力すると、社内VMD資料を検索し、AIが売場構成を提案します。

提案結果として、

* 可動ラックの配置
* ボディの配置
* 展開する商品
* 配置理由
* 固定什器への商品展開案
* 参照した社内資料

などを表示します。

AIが提案した可動ラックやボディは、提案後にスタッフがドラッグして調整できます。

---

## VMD提案で考慮するルール

社内VMD資料を検索し、例えば以下のようなルールを提案時に考慮します。

* ボディを入口付近へ配置する
* 入口や主要動線を塞がない
* 可動ラックをテーブルと関連付けて配置する
* 可動ラックを主要動線上へ孤立させない
* 固定什器をAI側で移動しない
* 店内の主要な動線を確保する

AIに店舗レイアウトを完全に任せるのではなく、固定設備はスタッフが作成し、AIはそのレイアウトを前提として可動什器の配置を提案する構成にしています。

---

# システム構成

```text
ユーザー
   ↓
React + TypeScript
   ↓
Firebase Authentication
   ↓
FastAPI
   ↓
Firebase Admin
   ↓
Python / LangChain
   ↓
Metadata Filter
   ↓
Vector Search + BM25
   ↓
RRF
   ↓
Reranking
   ↓
関連する社内資料
   ↓
Gemini
   ↓
回答 / VMD提案
   ↓
FastAPI
   ↓
Reactに表示
```

ユーザー情報・権限情報についてはFirestoreを利用しています。

---

# RAGの仕組み

## PDF登録時

```text
社内PDF
   ↓
PyPDFLoader
   ↓
テキスト抽出
   ↓
テキスト整形
   ↓
Chunk分割
   ↓
Embedding
   ↓
Metadata付与
   ↓
Chromaへ保存
```

PDFから取得した文章には、不自然な空白や改行が含まれる場合があるため、テキストを整形してから検索用データとして登録しています。

---

## 質問時

```text
スタッフの質問
   ↓
Metadata条件
   ↓
Vector Search + BM25
   ↓
RRF
   ↓
Reranking
   ↓
関連するChunkを取得
   ↓
質問 + 社内資料
   ↓
Gemini
   ↓
回答生成
```

質問をそのままGeminiへ送るのではなく、最初に社内資料を検索することがポイントです。

これにより、一般的な生成AIが知らないLUMINA独自の社内ルールをもとに回答できるようにしています。

---

# 使用技術

| 分類                     | 技術                                    | 使用目的                    |
| ---------------------- | ------------------------------------- | ----------------------- |
| Frontend               | React                                 | Web画面・状態管理              |
| Frontend               | TypeScript                            | 店舗レイアウトなどの型管理           |
| Styling                | CSS                                   | UI・店舗レイアウト表示            |
| Build Tool             | Vite                                  | React開発環境               |
| Backend                | Python                                | RAG・AI処理                |
| API                    | FastAPI                               | FrontendとBackendの接続     |
| Authentication         | Firebase Authentication               | ログイン認証                  |
| User Management        | Firestore                             | ユーザー情報・権限管理             |
| Backend Authentication | Firebase Admin SDK                    | ID Token検証・ユーザー管理       |
| RAG                    | LangChain                             | RAG処理の構築                |
| PDF                    | PyPDFLoader                           | PDFテキスト抽出               |
| Embedding              | Hugging Face                          | 文章のEmbedding            |
| Embedding Model        | paraphrase-multilingual-MiniLM-L12-v2 | 日本語を含む文章のEmbedding      |
| Keyword Search         | BM25                                  | キーワード検索                 |
| Search Fusion          | RRF                                   | Vector SearchとBM25の順位統合 |
| Reranking              | BAAI/bge-reranker-v2-m3               | 検索候補の関連度再評価             |
| Vector DB              | Chroma                                | Embedding・Metadata保存    |
| Generative AI          | Gemini                                | 回答・VMD提案生成              |
| Version Control        | Git                                   | ソースコードの変更履歴管理           |
| Repository             | GitHub                                | ソースコード管理                |
| Editor                 | Cursor                                | 開発・コード編集                |

---

# 各技術を選択した理由

## React / TypeScript

質問画面だけでなく、店舗レイアウト上で什器を追加・移動したり、AIの提案結果を反映したりするため、状態変化の多い画面を管理しやすいReactを使用しました。

また、VMDでは什器の種類・座標・横幅・奥行き・向きなど多くのデータを扱うため、型を定義できるTypeScriptを使用しています。

---

## Python / FastAPI

RAGやAI関連のライブラリを利用しやすいため、バックエンドにはPythonを使用しています。

ReactからPythonの処理を直接実行するのではなく、FastAPIを窓口として質問・文書管理・VMD提案・認証情報などを送受信しています。

---

## Firebase Authentication / Firestore

社員番号とパスワードによるログイン機能を実現するため、Firebase Authenticationを使用しています。

また、一般スタッフ・店長MG・本社というユーザーごとの権限情報や所属情報はFirestoreで管理しています。

Frontend側の表示制御だけに依存せず、管理系APIではFirebase ID TokenをBackendへ送り、Firebase Admin SDKで認証情報を確認する構成にしています。

---

## LangChain

PDF読み込み、文章分割、Embedding、Vector Database、Geminiなど、RAGに必要な複数の処理をPython上で組み合わせるために使用しています。

---

## Hugging Face / Embedding

単純なキーワード一致だけではなく、文章の「意味の近さ」で社内資料を検索するためにEmbeddingを使用しています。

例えば、

```text
返品はいつまでできますか？
```

という質問と、

```text
購入日を含め14日以内
```

という資料では文字が完全には一致しません。

文章をEmbeddingへ変換することで、このような意味的に関連する文章を検索できるようにしています。

---

## BM25

Vector Searchは意味的に近い文章の検索に向いている一方で、固有のキーワードや数値を含む情報を取りこぼす場合があります。

そのため、キーワード検索であるBM25を追加しました。

Vector SearchとBM25を組み合わせることで、意味とキーワードの両方から関連資料を検索しています。

---

## RRF

Vector SearchとBM25では検索結果のスコアの意味が異なるため、単純にスコアを足すのではなく、検索順位を利用するRRFで結果を統合しています。

---

## Reranking

Hybrid Searchで取得した候補をそのままGeminiへ渡すのではなく、質問と各Chunkの関連度を再評価しています。

これにより、候補の中から質問へより直接的に関連するChunkを優先してGeminiへ渡す構成にしています。

---

## Chroma

EmbeddingとMetadataを保存し、質問と意味が近い社内資料を検索するVector Databaseとして使用しています。

ローカル環境で導入しやすく、今回のRAGアプリの規模で扱いやすいことから採用しました。

---

## Gemini

Geminiは社内資料を検索する役割ではなく、検索処理によって取得された社内資料を読み、スタッフ向けの自然な回答やVMD提案を生成する役割として使用しています。

Promptでは、

* 社内資料を回答の根拠として利用する
* 資料にない情報を推測しない
* 正式なマニュアルを過去事例より優先する
* 日付・時間・条件・数値を回答に含める

などの制約を設定しています。

---

# Chunk設計と検索精度の改善

PDFをそのまま検索するのではなく、文章をChunkに分割してChromaへ登録しています。

現在の主な設定：

```python
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=700,
    chunk_overlap=250
)
```

開発中に、

```text
返品は何日以内ですか？
```

という質問に対して、PDFには「購入日を含め14日以内」という情報が存在するにもかかわらず、必要な情報を取得できないケースがありました。

原因を確認すると、検索されたChunkに必要な情報が含まれていませんでした。

そこでChunk同士の重なりを調整し、PDFを再登録することで検索結果を改善しました。

さらにVector Searchだけでは、固有のキーワードや数値を含む情報を取りこぼすケースがあったため、

```text
Vector Search
      +
BM25
      ↓
RRF
      ↓
Reranking
```

という検索構成へ改善しました。

この検証から、RAGでは生成AIの性能だけではなく、

* PDFの前処理
* Chunkの分割方法
* Embedding
* Metadata
* Vector Search
* Keyword Search
* Reranking
* AIへ渡すContext

が回答品質に大きく影響することを確認しました。

---

# VMD提案のデータ構造

店舗レイアウトは画像としてAIへ渡すのではなく、座標データとして管理しています。

例：

```json
{
  "type": "table",
  "xMeters": 3.0,
  "yMeters": 4.0,
  "widthMeters": 1.8,
  "depthMeters": 0.8
}
```

これにより、

* 固定設備の位置
* 店舗サイズ
* 什器サイズ
* 什器の向き
* AIが提案した可動什器の位置

などをプログラム上で扱えるようにしています。

AIの提案結果も構造化されたデータとして受け取り、Reactの店舗レイアウト上へ反映しています。

---

# ディレクトリ構成

```text
RAG2/
│
├── .gitignore
│
├── backend/
│   ├── src/
│   │   ├── main.py
│   │   ├── rag.py
│   │   ├── uploads/
│   │   └── chroma_db/
│   │
│   └── ...
│
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── App.css
    │   ├── Login.tsx
    │   ├── firebase.ts
    │   ├── VmdLayout.tsx
    │   ├── VmdLayout.css
    │   ├── assets/
    │   └── main.tsx
    │
    └── ...
```

※ Firebase Adminのサービスアカウントファイルや環境変数などの秘密情報はGitHubへ登録しません。

---

# 主なファイルの役割

## `backend/src/main.py`

FastAPIのエンドポイントと認証・権限確認を管理します。

主に、

* ログインユーザー確認
* Firebase ID Token検証
* 社員管理API
* PDF登録・削除
* 質問受付
* VMD提案受付

などを担当します。

---

## `backend/src/rag.py`

RAG処理の中心となるファイルです。

主に、

* PDF読み込み
* PDFテキスト整形
* Chunk分割
* Embedding
* Chromaへの登録
* Metadata管理
* Vector Search
* BM25
* RRF
* Reranking
* Geminiによる回答生成
* VMD資料検索
* VMD提案

を担当します。

---

## `frontend/src/App.tsx`

アプリ全体のメイン画面を管理します。

主に、

* 社内ナレッジ検索
* 文書管理
* ログインユーザー表示
* 権限による画面制御
* 社員管理
* VMD画面への切り替え
* FastAPIとの通信

などを担当します。

---

## `frontend/src/Login.tsx`

社員番号とパスワードによるログイン画面を管理します。

Firebase Authenticationを利用して認証を行います。

---

## `frontend/src/firebase.ts`

FrontendからFirebase AuthenticationとFirestoreを利用するためのFirebase設定を管理します。

---

## `frontend/src/VmdLayout.tsx`

VMD機能を担当します。

主に、

* 店舗サイズの設定
* 固定設備の配置
* ドラッグ操作
* 店舗レイアウト保存
* VMD条件入力
* AI提案の取得
* AI提案結果の表示
* 提案後の可動ラック・ボディ調整

などを管理します。

---

# 起動方法

## Backend

Backendディレクトリへ移動します。

```powershell
cd backend
```

FastAPIを起動します。

```powershell
python -m uvicorn src.main:app
```

起動後：

```text
http://127.0.0.1:8000
```

---

## Frontend

別のターミナルでFrontendディレクトリへ移動します。

```powershell
cd frontend
```

起動します。

```powershell
npm run dev
```

起動後：

```text
http://localhost:5173
```

---

# セキュリティ・権限設計

本アプリでは、Frontend上でボタンを非表示にするだけではなく、管理操作についてBackend側でもユーザー情報を確認する構成にしています。

```text
React
   ↓
Firebase Authentication
   ↓
ID Token取得
   ↓
FastAPIへ送信
   ↓
Firebase Admin SDK
   ↓
Token検証
   ↓
Firestoreからユーザー権限確認
   ↓
API実行可否を判定
```

これにより、一般スタッフ・店長MG・本社で利用できる機能を分けています。

---

# UIデザイン

架空のアパレル会社LUMINAの社内システムとして、業務画面の読みやすさを維持しながら、アパレルブランドを意識したデザインにしています。

主なデザイン方針：

* ブラック・アイボリー・ベージュを基調とした配色
* LUMINAブランドを意識したサイドバー
* 情報の読みやすさを優先したメイン画面
* ファッションビジュアルを使用したログイン画面
* 業務システムとして操作しやすいシンプルなUI

---

# 今後の改善予定

現在、以下の改善を予定しています。

* RAG検索精度の継続的な検証・改善
* VMD提案精度の向上
* スタッフ自身による可動ラック配置機能
* 指定したラック数・ボディ数を確実に反映する処理
* 什器同士の重なり判定
* 入口・レジ・試着室までの動線チェック
* 商品画像を使用した、より具体的なVMD提案
* 文書Metadataを利用した資料一覧・検索機能の拡張

---

# 開発を通して学んだこと

今回の開発では、生成AIを呼び出すだけではなく、

**「必要な情報を検索し、その情報をAIへ渡し、回答をWebアプリの機能として利用する」**

というRAGアプリ全体の流れを実装しました。

特に、PDFに正解が書かれていても、検索によって適切なChunkを取得できなければAIは正確に回答できないことを実際の検証から確認しました。

そのため、Vector SearchだけではなくBM25、RRF、Rerankingを組み合わせ、検索結果そのものを改善する構成へ変更しました。

また、RAGだけでなく、

* ReactとFastAPIを利用したFrontend / Backend連携
* Firebase Authenticationによるログイン認証
* Firestoreによるユーザー・権限管理
* Firebase Admin SDKによるBackend認証
* Metadataを利用した文書管理
* 座標データを利用したVMD提案
* ユーザー権限に応じた機能制御

まで実装することで、AI機能をWebアプリとして利用するための一連の構成を学びました。

単に生成AIへPromptを送るだけではなく、
**「どの情報を検索し、どの情報をAIへ渡し、どのようにユーザーへ提供するか」**
を設計することが、RAGアプリでは重要だと学びました。
