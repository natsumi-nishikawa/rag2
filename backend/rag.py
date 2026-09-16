import os
import re
import shutil

from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_google_genai import ChatGoogleGenerativeAI


# ==============================
# 基本設定
# ==============================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)

ENV_PATH = os.path.join(PROJECT_DIR, ".env")
CHROMA_DIR = os.path.join(BASE_DIR, "chroma_db")

load_dotenv(ENV_PATH)


# ==============================
# Embedding
# ==============================

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
)


# ==============================
# Chroma取得
# ==============================

def get_vector_db():

    return Chroma(
        persist_directory=CHROMA_DIR,
        embedding_function=embeddings
    )


# ==============================
# PDF文章を整える
# ==============================

def clean_pdf_text(text):

    if not text:
        return ""

    # Windows系の改行を統一
    text = text.replace("\r\n", "\n")
    text = text.replace("\r", "\n")

    # 改行でバラバラになった文章をつなぐ
    text = re.sub(r"(?<![。！？\n])\n(?!\n)", "", text)

    # 日本語文字の間に入った空白を削除
    japanese_chars = r"一-龯ぁ-んァ-ヶ々ー"

    text = re.sub(
        rf"(?<=[{japanese_chars}])\s+(?=[{japanese_chars}])",
        "",
        text
    )

    # 日本語と数字の間の不要な空白を削除
    text = re.sub(
        rf"(?<=[{japanese_chars}])\s+(?=\d)",
        "",
        text
    )

    text = re.sub(
        rf"(?<=\d)\s+(?=[{japanese_chars}])",
        "",
        text
    )

    # 連続したスペースを1つにする
    text = re.sub(r"[ \t]+", " ", text)

    # 改行が多すぎる場合は整理
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


# ==============================
# PDF登録
# ==============================

def register_pdf(file_path):

    file_name = os.path.basename(file_path)

    print(f"\nPDF読み込み開始：{file_name}")

    loader = PyPDFLoader(file_path)

    documents = loader.load()

    cleaned_documents = []

    for document in documents:

        # PDFから取り出した文章を整える
        document.page_content = clean_pdf_text(
            document.page_content
        )

        # ファイル名を保存
        document.metadata["source_file"] = file_name

        # ページ番号を保存
        page_number = document.metadata.get(
            "page",
            0
        )

        document.metadata["page_number"] = (
            page_number + 1
        )

        # 空ページは登録しない
        if document.page_content.strip():

            cleaned_documents.append(
                document
            )

    # ==========================
    # Chunk分割
    # ==========================

    text_splitter = RecursiveCharacterTextSplitter(

        chunk_size=700,

        chunk_overlap=250,

        separators=[
            "\n\n",
            "\n",
            "。",
            "！",
            "？",
            ""
        ]
    )

    chunks = text_splitter.split_documents(
        cleaned_documents
    )

    # ==========================
    # Chromaへ登録
    # ==========================

    vector_db = get_vector_db()

    vector_db.add_documents(chunks)

    print(
        f"登録完了：{file_name}"
    )

    print(
        f"ページ数：{len(cleaned_documents)}"
    )

    print(
        f"Chunk数：{len(chunks)}"
    )

    return {

        "filename": file_name,

        "pages": len(cleaned_documents),

        "chunks": len(chunks)
    }


# ==============================
# PDF削除
# ==============================

def delete_pdf_from_db(file_name):

    vector_db = get_vector_db()

    data = vector_db.get(
        where={
            "source_file": file_name
        }
    )

    ids = data.get(
        "ids",
        []
    )

    if ids:

        vector_db.delete(
            ids=ids
        )


# ==============================
# 社内資料検索
# ==============================

def search_documents(question):

    vector_db = get_vector_db()

    results = vector_db.similarity_search(
        question,
        k=10
    )

    # 動作確認用
    print(
        "\n========== 検索結果 =========="
    )

    for i, document in enumerate(
        results,
        start=1
    ):

        print(
            f"\n--- 検索結果 {i} ---"
        )

        print(
            "資料：",
            document.metadata.get(
                "source_file"
            )
        )

        print(
            "ページ：",
            document.metadata.get(
                "page_number"
            )
        )

        print("内容：")

        print(
            document.page_content
        )

    print(
        "\n=============================="
    )

    return results
# ==============================
# Gemini呼び出し
# 制限時は別モデルへ切り替える
# ==============================

def invoke_gemini_with_fallback(prompt):

    model_names = [
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
    ]

    last_error = None

    for model_name in model_names:

        try:
            print(
                f"\nGemini使用モデル：{model_name}"
            )

            model = ChatGoogleGenerativeAI(
                model=model_name
            )

            response = model.invoke(
                prompt
            )

            return response

        except Exception as error:

            last_error = error

            print(
                f"\n{model_name} でエラーが発生しました"
            )

            print(error)

            print(
                "次のGeminiモデルを試します"
            )

    raise RuntimeError(
        "利用可能なGeminiモデルで"
        "回答を生成できませんでした"
    ) from last_error

# ==============================
# AI回答生成
# ==============================

def generate_answer(question):

    documents = search_documents(
        question
    )

    if not documents:

        return {

            "answer":
                "関連する社内資料が見つかりませんでした。",

            "sources": []
        }

    context_parts = []

    sources = []

    for document in documents:

        file_name = document.metadata.get(
            "source_file",
            "不明な資料"
        )

        page_number = document.metadata.get(
            "page_number",
            "不明"
        )

        context_parts.append(
            f"""
資料名：{file_name}
ページ：{page_number}

{document.page_content}
"""
        )

        source = {

            "filename": file_name,

            "page": page_number
        }

        if source not in sources:

            sources.append(
                source
            )

    context = "\n\n".join(
        context_parts
    )

    # ==========================
    # Geminiへの指示
    # ==========================

    prompt = f"""
あなたは株式会社LUMINAの店舗スタッフ向け
社内ナレッジAIです。

スタッフからの質問に対して、
以下の【社内資料】だけを根拠として回答してください。

ルール：

・質問に直接関係する情報を社内資料から探してください。
・社内資料に具体的な日付、時間、条件、数値がある場合は回答に含めてください。
・複数の資料がある場合は、質問に最も直接関係する資料を優先してください。
・過去トラブル事例より、正式な業務マニュアルに直接答えが書かれている場合は、その内容を優先してください。
・社内資料にない情報を推測してはいけません。
・本当に資料から確認できない場合だけ
「社内資料からは確認できませんでした」
と回答してください。
・店舗スタッフがすぐ理解できるよう、簡潔な日本語で回答してください。


【社内資料】

{context}


【スタッフからの質問】

{question}


【回答】
"""

    response = invoke_gemini_with_fallback(
        prompt
    )

    # ==========================
    # Gemini回答を文字列化
    # ==========================

    if isinstance(
        response.content,
        str
    ):

        answer_text = response.content

    elif isinstance(
        response.content,
        list
    ):

        text_parts = []

        for item in response.content:

            if isinstance(
                item,
                dict
            ):

                text = item.get(
                    "text"
                )

                if text:

                    text_parts.append(
                        text
                    )

            else:

                text_parts.append(
                    str(item)
                )

        answer_text = "\n".join(
            text_parts
        )

    else:

        answer_text = str(
            response.content
        )

    return {

        "answer": answer_text,

        "sources": sources
    }


# ==============================
# Chroma初期化
# ==============================

def reset_database():

    if os.path.exists(
        CHROMA_DIR
    ):

        shutil.rmtree(
            CHROMA_DIR
        )

        print(
            "Chromaデータを削除しました"
        )

import json


# ==============================
# VMD提案生成
# ==============================

import json


def generate_vmd_proposal(vmd_data):
    """
    店舗レイアウトと今回の条件を受け取り、
    LUMINAのVMD社内資料をRAG検索して
    VMD提案を作成する。
    """

    # ==========================
    # フロントから受け取った情報
    # ==========================

    store = vmd_data.get(
        "store",
        {}
    )

    fixed_items = vmd_data.get(
        "fixedItems",
        []
    )

    movable_items = vmd_data.get(
        "movableItems",
        {}
    )

    merchandising = vmd_data.get(
        "merchandising",
        {}
    )

    store_width = store.get(
        "widthMeters",
        0
    )

    store_depth = store.get(
        "depthMeters",
        0
    )

    store_shape = store.get(
        "shape",
        "rectangle"
    )

    rack_count = movable_items.get(
        "rackCount",
        0
    )

    body_count = movable_items.get(
        "bodyCount",
        0
    )

    product_amount = merchandising.get(
        "productAmount",
        "標準"
    )

    season = merchandising.get(
        "season",
        ""
    )

    main_product = merchandising.get(
        "mainProduct",
        ""
    )

    # ==========================
    # VMD関連資料をRAG検索
    # ==========================

    search_question = f"""
VMD 売場づくり 商品陳列 店舗レイアウト
入口 店頭 メインディスプレイ
動線 テーブル 可動ラック ボディ
重点商品 季節商品 関連商品
商品量 {product_amount}
季節 {season}
重点商品 {main_product}
"""

    documents = search_documents(
        search_question
    )

    # ==========================
    # VMD資料だけに絞る
    # ==========================

    vmd_documents = []

    for document in documents:

        file_name = document.metadata.get(
            "source_file",
            ""
        )

        if "VMD" in file_name.upper():

            vmd_documents.append(
                document
            )

    # ==========================
    # VMD資料がなければ提案しない
    # ==========================

    if not vmd_documents:

        raise ValueError(
            "VMD社内資料を検索できませんでした。"
            "文書管理からVMDマニュアルを登録してから、"
            "もう一度提案してください。"
        )

    # ==========================
    # Geminiへ渡す資料を作成
    # ==========================

    context_parts = []
    sources = []

    for document in vmd_documents:

        file_name = document.metadata.get(
            "source_file",
            "不明な資料"
        )

        page_number = document.metadata.get(
            "page_number",
            "不明"
        )

        context_parts.append(
            f"""
資料名：{file_name}
ページ：{page_number}

{document.page_content}
"""
        )

        source = {
            "filename": file_name,
            "page": page_number
        }

        if source not in sources:

            sources.append(
                source
            )

    context = "\n\n".join(
        context_parts
    )

    # ==========================
    # Geminiへの指示
    # ==========================

    prompt = f"""
あなたは株式会社LUMINAの
店舗VMD担当者を支援するAIです。

あなたの役割は、
店舗情報とLUMINAの社内VMD資料を使って、
店舗スタッフが実際に調整できる
VMDの初期案を作ることです。


【最重要ルール】

LUMINAのVMDルールとして使用してよいのは、
下に記載された【社内VMD資料】の内容だけです。

あなたが一般知識として知っている
アパレル業界のVMDルールや、
一般的な店舗レイアウトの知識を、
LUMINAの社内ルールとして
勝手に追加してはいけません。

社内資料に書かれていないことについては、
「LUMINAではこのルールである」
と断定してはいけません。


【固定設備について】

以下の固定設備は
スタッフが事前に登録した
実際の店舗設備です。

固定設備の位置は
絶対に変更しないでください。

固定設備の上に
可動ラックやボディを
重ねて配置しないでください。

固定設備には、

・テーブル
・レジ
・試着室
・入口
・壁面ラック
・店内固定ラック

などがあります。


【可動什器について】

今回使用できる可動ラックは
最大 {rack_count} 台です。

今回使用できるボディは
最大 {body_count} 体です。

必ずしも最大数すべてを
使用する必要はありません。

ただし、
社内VMD資料に配置について
明確なルールが書かれている場合は、
そのルールを優先してください。


【商品について】

今回の商品量：
{product_amount}

今回の季節：
{season}

今回の重点商品：
{main_product}

重点商品をどこで見せるかを
明確にしてください。

季節商品や関連商品についても、
社内VMD資料を根拠として
提案してください。

商品量が少ない場合は、
無理に売場を広げず、
まとまりのある見せ方を検討してください。

商品量が多い場合でも、
社内資料に反するほど
商品や什器を詰め込まないでください。


【店舗の座標】

店舗横幅：
{store_width}m

店舗奥行：
{store_depth}m

店舗形状：
{store_shape}

xMetersは、
店舗の左端を0として
右方向へ増える座標です。

yMetersは、
店舗の上端を0として
下方向へ増える座標です。

配置する可動什器は、
必ず店舗の範囲内にしてください。

店舗形状がL字型の場合は、
存在しない右下部分へ
什器を配置しないでください。


【安全な配置】

入口、レジ、試着室など、
スタッフが登録した固定設備を
可動什器で塞がないでください。

社内資料に動線について
ルールが書かれている場合は、
そのルールを優先してください。

社内資料だけでは
正確な配置位置を判断できない場合は、
一般知識を使って
会社ルールを作るのではなく、
固定設備を避けた
単純な初期配置にしてください。

この提案は最終決定ではありません。

AIが提案した可動ラックとボディは、
提案後に店舗スタッフが
画面上で位置を調整します。


【社内VMD資料】

{context}


【店舗情報】

{json.dumps(
    store,
    ensure_ascii=False,
    indent=2
)}


【固定設備】

{json.dumps(
    fixed_items,
    ensure_ascii=False,
    indent=2
)}


【回答形式】

必ずJSONだけを返してください。

JSON以外の文章は
出力しないでください。

Markdownの
```json
も付けないでください。

次の形式にしてください。

{{
  "summary": "今回のVMD提案全体の考え方",

  "placements": [
    {{
      "type": "rack",
      "xMeters": 4.0,
      "yMeters": 3.0,
      "widthMeters": 1.8,
      "depthMeters": 0.6,
      "direction": 0,
      "product": "展開する商品",
      "reason": "社内資料をもとにした配置理由"
    }},
    {{
      "type": "body",
      "xMeters": 2.0,
      "yMeters": 1.0,
      "widthMeters": 0.7,
      "depthMeters": 0.7,
      "direction": 0,
      "product": "着用する商品",
      "reason": "社内資料をもとにした配置理由"
    }}
  ],

  "fixedItemSuggestions": [
    {{
      "fixedItemId": "固定設備のID",
      "product": "展開する商品",
      "reason": "社内資料をもとにした商品展開理由"
    }}
  ]
}}


【placementsのルール】

placementsには、
AIが新しく配置する

・可動ラック
・ボディ

だけを入れてください。

typeは必ず

"rack"

または

"body"

のどちらかにしてください。

固定設備はplacementsへ
入れないでください。


【fixedItemSuggestionsのルール】

fixedItemSuggestionsには、
既存の固定テーブルや
固定ラックなどを利用した
商品展開の提案を入れてください。

固定設備の位置は
絶対に変更しないでください。
"""

    # ==========================
    # Geminiへ送信
    # ==========================

    response = invoke_gemini_with_fallback(
        prompt
    )

    # ==========================
    # Gemini回答を文字列化
    # ==========================

    if isinstance(
        response.content,
        str
    ):

        response_text = (
            response.content
        )

    elif isinstance(
        response.content,
        list
    ):

        text_parts = []

        for item in response.content:

            if isinstance(
                item,
                dict
            ):

                text = item.get(
                    "text"
                )

                if text:

                    text_parts.append(
                        text
                    )

            else:

                text_parts.append(
                    str(item)
                )

        response_text = "\n".join(
            text_parts
        )

    else:

        response_text = str(
            response.content
        )

    # ==========================
    # Markdown記号を除去
    # ==========================

    response_text = (
        response_text
        .replace(
            "```json",
            ""
        )
        .replace(
            "```",
            ""
        )
        .strip()
    )

    # ==========================
    # JSONへ変換
    # ==========================

    try:

        proposal = json.loads(
            response_text
        )

    except json.JSONDecodeError:

        print(
            "\nVMD JSON解析失敗"
        )

        print(
            response_text
        )

        raise ValueError(
            "AIのVMD提案を読み取れませんでした"
        )

    # ==========================
    # 使用した社内資料を追加
    # ==========================

    proposal["sources"] = (
        sources
    )

    return proposal