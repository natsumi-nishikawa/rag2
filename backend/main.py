import os
import shutil

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from rag import (
    register_pdf,
    delete_pdf_from_db,
    generate_answer,
    generate_vmd_proposal,
)


app = FastAPI(
    title="LUMINA 社内ナレッジRAG API"
)


# ==============================
# Reactからの通信を許可
# ==============================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================
# 保存先
# ==============================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

UPLOAD_DIR = os.path.join(
    BASE_DIR,
    "uploads"
)

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True
)


# ==============================
# 質問用データ
# ==============================

class QuestionRequest(BaseModel):
    question: str


# ==============================
# VMD提案用データ
# ==============================

class VmdRequest(BaseModel):
    store: dict
    fixedItems: list
    movableItems: dict
    merchandising: dict


# ==============================
# トップ
# ==============================

@app.get("/")
def home():

    return {
        "message": "LUMINA 社内ナレッジRAG API"
    }


# ==============================
# PDF登録
# ==============================

@app.post("/upload")
def upload_pdf(
    file: UploadFile = File(...),
    document_id: str = Form(...),
    title: str = Form(...),
    category: str = Form(...),
    target_role: str = Form(...),
    updated_at: str = Form(...),
    status: str = Form(...),
):

    # --------------------------
    # ファイル確認
    # --------------------------

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

    # --------------------------
    # Metadata確認
    # --------------------------

    document_id = document_id.strip()
    title = title.strip()
    category = category.strip()
    target_role = target_role.strip()
    updated_at = updated_at.strip()
    status = status.strip()

    if not document_id:
        raise HTTPException(
            status_code=400,
            detail="文書番号を入力してください"
        )

    if not title:
        raise HTTPException(
            status_code=400,
            detail="資料名を入力してください"
        )

    if not category:
        raise HTTPException(
            status_code=400,
            detail="カテゴリを選択してください"
        )

    if not updated_at:
        raise HTTPException(
            status_code=400,
            detail="更新日を入力してください"
        )

    # --------------------------
    # Metadata作成
    # --------------------------

    metadata = {
        "document_id": document_id,
        "title": title,
        "category": category,
        "target_role": target_role,
        "updated_at": updated_at,
        "status": status,
    }

    # 確認用
    print("受信したMetadata：")
    print(metadata)

    # --------------------------
    # PDF保存
    # --------------------------

    file_path = os.path.join(
        UPLOAD_DIR,
        file.filename
    )

    if os.path.exists(file_path):

        raise HTTPException(
            status_code=409,
            detail="同じ名前のPDFがすでに登録されています"
        )

    with open(file_path, "wb") as buffer:

        shutil.copyfileobj(
            file.file,
            buffer
        )

    # --------------------------
    # RAG登録
    # --------------------------

    try:

        result = register_pdf(
            file_path,
            metadata
        )

        return {
            "success": True,
            "message": "PDFを登録しました",
            "filename": result["filename"],
            "pages": result["pages"],
            "chunks": result["chunks"],
            "metadata": metadata,
        }

    except Exception as error:

        # 登録失敗時は保存したPDFも削除
        if os.path.exists(file_path):
            os.remove(file_path)

        raise HTTPException(
            status_code=500,
            detail=(
                "PDF登録中にエラーが発生しました："
                f"{str(error)}"
            )
        )


# ==============================
# 登録済みPDF一覧
# ==============================

@app.get("/documents")
def get_documents():

    files = []

    for file_name in os.listdir(
        UPLOAD_DIR
    ):

        if file_name.lower().endswith(
            ".pdf"
        ):

            files.append({
                "filename": file_name
            })

    return {
        "documents": files
    }


# ==============================
# PDF削除
# ==============================

@app.delete(
    "/documents/{file_name}"
)
def delete_document(
    file_name: str
):

    file_path = os.path.join(
        UPLOAD_DIR,
        file_name
    )

    if not os.path.exists(
        file_path
    ):

        raise HTTPException(
            status_code=404,
            detail="指定されたPDFがありません"
        )

    delete_pdf_from_db(
        file_name
    )

    os.remove(
        file_path
    )

    return {
        "success": True,
        "message": "PDFを削除しました"
    }


# ==============================
# 質問
# ==============================

@app.post("/ask")
def ask_question(
    request: QuestionRequest
):

    question = (
        request.question.strip()
    )

    if not question:

        raise HTTPException(
            status_code=400,
            detail="質問を入力してください"
        )

    result = generate_answer(
        question
    )

    return result


# ==============================
# PDF表示
# ==============================

@app.get(
    "/documents/{file_name}/view"
)
def view_document(
    file_name: str
):

    file_path = os.path.join(
        UPLOAD_DIR,
        file_name
    )

    if not os.path.exists(
        file_path
    ):

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


# ==============================
# VMD提案
# ==============================

@app.post("/vmd/propose")
def propose_vmd(
    request: VmdRequest
):

    try:

        data = {
            "store":
                request.store,

            "fixedItems":
                request.fixedItems,

            "movableItems":
                request.movableItems,

            "merchandising":
                request.merchandising,
        }

        result = (
            generate_vmd_proposal(
                data
            )
        )

        return result

    except Exception as error:

        print(
            "VMD提案エラー：",
            error
        )

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )