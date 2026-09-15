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

        chunk_overlap=120,

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
        k=5
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

    model = ChatGoogleGenerativeAI(
        model="gemini-3.6-flash"
    )

    response = model.invoke(
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