import os
import shutil

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from rag import (
    register_pdf,
    delete_pdf_from_db,
    generate_answer
)


app = FastAPI(
    title="LUMINA 社内ナレッジRAG API"
)


# React（リアクト）からの通信を許可
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_DIR = os.path.join(
    BASE_DIR,
    "uploads"
)

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True
)


class QuestionRequest(BaseModel):
    question: str


@app.get("/")
def home():

    return {
        "message": "LUMINA 社内ナレッジRAG API"
    }


# ==============================
# PDF登録
# ==============================

@app.post("/upload")
def upload_pdf(file: UploadFile = File(...)):

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="ファイル名がありません"
        )

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="PDFファイルを選択してください"
        )

    file_path = os.path.join(
        UPLOAD_DIR,
        file.filename
    )

    # 同じファイルが存在する場合
    if os.path.exists(file_path):

        raise HTTPException(
            status_code=409,
            detail="同じ名前のPDFがすでに登録されています"
        )

    # PDF保存
    with open(file_path, "wb") as buffer:

        shutil.copyfileobj(
            file.file,
            buffer
        )

    try:

        result = register_pdf(file_path)

        return {
            "success": True,
            "message": "PDFを登録しました",
            "filename": result["filename"],
            "pages": result["pages"],
            "chunks": result["chunks"]
        }

    except Exception as error:

        # 登録失敗時は保存したPDFも削除
        if os.path.exists(file_path):
            os.remove(file_path)

        raise HTTPException(
            status_code=500,
            detail=f"PDF登録中にエラーが発生しました：{str(error)}"
        )


# ==============================
# 登録済みPDF一覧
# ==============================

@app.get("/documents")
def get_documents():

    files = []

    for file_name in os.listdir(UPLOAD_DIR):

        if file_name.lower().endswith(".pdf"):

            files.append({
                "filename": file_name
            })

    return {
        "documents": files
    }


# ==============================
# PDF削除
# ==============================

@app.delete("/documents/{file_name}")
def delete_document(file_name: str):

    file_path = os.path.join(
        UPLOAD_DIR,
        file_name
    )

    if not os.path.exists(file_path):

        raise HTTPException(
            status_code=404,
            detail="指定されたPDFがありません"
        )

    delete_pdf_from_db(file_name)

    os.remove(file_path)

    return {
        "success": True,
        "message": "PDFを削除しました"
    }


# ==============================
# 質問
# ==============================

@app.post("/ask")
def ask_question(request: QuestionRequest):

    question = request.question.strip()

    if not question:

        raise HTTPException(
            status_code=400,
            detail="質問を入力してください"
        )

    result = generate_answer(question)

    return result

# ==============================
# PDF表示
# ==============================

@app.get("/documents/{file_name}/view")
def view_document(file_name: str):

    file_path = os.path.join(
        UPLOAD_DIR,
        file_name
    )

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="指定されたPDFがありません"
        )

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=file_name,
        content_disposition_type="inline"
    )