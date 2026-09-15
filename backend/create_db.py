import os
import shutil

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings


# ==============================
# 保存場所の設定
# ==============================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

PDF_DIR = os.path.join(BASE_DIR, "sample_pdf")
CHROMA_DIR = os.path.join(BASE_DIR, "chroma_db")


# ==============================
# PDFを読み込む
# ==============================

documents = []

print("PDFを読み込んでいます...")

for file_name in os.listdir(PDF_DIR):

    if not file_name.lower().endswith(".pdf"):
        continue

    file_path = os.path.join(PDF_DIR, file_name)

    print(f"読み込み中：{file_name}")

    loader = PyPDFLoader(file_path)

    pages = loader.load()

    # どのPDFから取得した文章なのか記録
    for page in pages:
        page.metadata["source_file"] = file_name

    documents.extend(pages)


print(f"読み込んだページ数：{len(documents)}")


# ==============================
# 文章をChunkに分割
# ==============================

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)

chunks = text_splitter.split_documents(documents)

print(f"作成したChunk数：{len(chunks)}")


# ==============================
# Embeddingモデルを準備
# ==============================

print("Embeddingモデルを読み込んでいます...")

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
)


# ==============================
# 古いChroma DBを削除
# ==============================

if os.path.exists(CHROMA_DIR):
    shutil.rmtree(CHROMA_DIR)


# ==============================
# Chromaへ登録
# ==============================

print("Chromaへ登録しています...")

vector_db = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings,
    persist_directory=CHROMA_DIR
)


print("------------------------------")
print("登録完了")
print(f"PDF数：{len(set(doc.metadata['source_file'] for doc in documents))}")
print(f"ページ数：{len(documents)}")
print(f"Chunk数：{len(chunks)}")
print("------------------------------")