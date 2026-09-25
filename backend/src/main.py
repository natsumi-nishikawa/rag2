import os
import shutil
import firebase_admin

from firebase_admin import credentials
from firebase_admin import auth as firebase_auth
from firebase_admin import firestore

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    Header,
)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from src.rag import (
    register_pdf,
    delete_pdf_from_db,
    generate_answer,
    generate_vmd_proposal,
)

# ==============================
# Firebase Admin
# ==============================

CURRENT_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

BACKEND_DIR = os.path.dirname(
    CURRENT_DIR
)

FIREBASE_KEY_PATH = os.path.join(
    BACKEND_DIR,
    "firebase-service-account.json"
)

if not firebase_admin._apps:
    if os.path.exists(FIREBASE_KEY_PATH):
        # ローカル開発環境
        credential = credentials.Certificate(
            FIREBASE_KEY_PATH
        )
        firebase_admin.initialize_app(
            credential
        )
    else:
        # Cloud Run
        # Google Cloudの認証情報を自動的に使用
        firebase_admin.initialize_app()

db = firestore.client()

# ==============================
# ログインユーザー確認
# ==============================

def get_current_user(
    authorization: str | None
):
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="ログイン情報がありません"
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="ログイン情報の形式が正しくありません"
        )

    id_token = authorization.replace(
        "Bearer ",
        "",
        1
    ).strip()

    try:
        decoded_token = (
            firebase_auth.verify_id_token(
                id_token
            )
        )

        uid = decoded_token["uid"]

        user_ref = (
            db.collection("users")
            .document(uid)
        )

        user_snapshot = user_ref.get()

        if not user_snapshot.exists:
            raise HTTPException(
                status_code=403,
                detail="社員情報が登録されていません"
            )

        user_data = user_snapshot.to_dict()

        if not user_data.get("active", False):
            raise HTTPException(
                status_code=403,
                detail="このアカウントは利用できません"
            )

        return {
            "uid": uid,
            **user_data,
        }

    except HTTPException:
        raise

    except Exception as error:
        print(
            "認証確認エラー：",
            error
        )

        raise HTTPException(
            status_code=401,
            detail="ログイン情報を確認できませんでした"
        )

# ==============================
# 本社権限確認
# ==============================

def require_headquarters(
    authorization: str | None
):
    current_user = get_current_user(
        authorization
    )

    if current_user.get("role") != "headquarters":
        raise HTTPException(
            status_code=403,
            detail="本社ユーザーのみ実行できます"
        )

    return current_user

app = FastAPI(
    title="LUMINA 社内ナレッジRAG API"
)

# ==============================
# 店長・MG / 本社権限確認
# ==============================

def require_manager_or_headquarters(
    authorization: str | None
):
    current_user = get_current_user(
        authorization
    )

    role = current_user.get("role")

    if role not in [
        "manager",
        "headquarters",
    ]:
        raise HTTPException(
            status_code=403,
            detail="店長・MGまたは本社のみ実行できます"
        )

    return current_user

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

class InitialAdminRequest(BaseModel):
    employee_id: str

class StaffCreateRequest(BaseModel):
    employee_id: str
    name: str
    password: str
    role: str
    store: str

class StaffUpdateRequest(BaseModel):
    name: str
    role: str
    store: str


class StaffActiveRequest(BaseModel):
    active: bool

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
# ログインユーザー情報
# ==============================

@app.get("/me")
def get_me(
    authorization: str | None = Header(
        default=None
    )
):
    current_user = get_current_user(
        authorization
    )

    return {
        "uid": current_user["uid"],
        "employeeId": current_user.get(
            "employeeId"
        ),
        "name": current_user.get(
            "name"
        ),
        "role": current_user.get(
            "role"
        ),
        "store": current_user.get(
            "store"
        ),
        "active": current_user.get(
            "active"
        ),
    }

# ==============================
# 社員登録
# 本社ユーザーのみ
# ==============================

@app.post("/staff")
def create_staff(
    request: StaffCreateRequest,
    authorization: str | None = Header(
        default=None
    )
):
    # 本社権限を確認
    require_headquarters(
        authorization
    )

    employee_id = request.employee_id.strip()
    name = request.name.strip()
    password = request.password
    role = request.role.strip()
    store = request.store.strip()

    # --------------------------
    # 入力確認
    # --------------------------

    if not employee_id:
        raise HTTPException(
            status_code=400,
            detail="社員番号を入力してください"
        )

    if not name:
        raise HTTPException(
            status_code=400,
            detail="氏名を入力してください"
        )

    if len(password) < 6:
        raise HTTPException(
            status_code=400,
            detail="パスワードは6文字以上にしてください"
        )

    allowed_roles = [
        "staff",
        "manager",
        "headquarters",
    ]

    if role not in allowed_roles:
        raise HTTPException(
            status_code=400,
            detail="権限が正しくありません"
        )

    if not store:
        raise HTTPException(
            status_code=400,
            detail="所属店舗を入力してください"
        )

    # 社員番号を内部メールアドレスへ変換
    email = f"{employee_id}@lumina.local"

    firebase_user = None

    try:
        # --------------------------
        # Authenticationへ登録
        # --------------------------

        firebase_user = (
            firebase_auth.create_user(
                email=email,
                password=password,
                disabled=False,
            )
        )

        # --------------------------
        # Firestoreへ社員情報登録
        # --------------------------

        user_data = {
            "employeeId": employee_id,
            "name": name,
            "role": role,
            "store": store,
            "active": True,
        }

        db.collection("users").document(
            firebase_user.uid
        ).set(user_data)

        return {
            "success": True,
            "message": "社員を登録しました",
            "employeeId": employee_id,
            "name": name,
            "role": role,
            "store": store,
        }

    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(
            status_code=409,
            detail="この社員番号はすでに登録されています"
        )

    except HTTPException:
        raise

    except Exception as error:
        # Authenticationだけ作成され、
        # Firestore登録に失敗した場合は元に戻す
        if firebase_user is not None:
            try:
                firebase_auth.delete_user(
                    firebase_user.uid
                )
            except Exception:
                pass

        print(
            "社員登録エラー：",
            error
        )

        raise HTTPException(
            status_code=500,
            detail="社員登録中にエラーが発生しました"
        )

# ==============================
# 社員一覧取得
# 本社ユーザーのみ
# ==============================

@app.get("/staff")
def get_staff_list(
    authorization: str | None = Header(
        default=None
    )
):
    # 本社権限を確認
    require_headquarters(
        authorization
    )

    try:
        staff_list = []

        users = (
            db.collection("users")
            .stream()
        )

        for user_document in users:
            user_data = (
                user_document.to_dict()
            )

            staff_list.append({
                "uid": user_document.id,
                "employeeId": user_data.get(
                    "employeeId",
                    ""
                ),
                "name": user_data.get(
                    "name",
                    ""
                ),
                "role": user_data.get(
                    "role",
                    ""
                ),
                "store": user_data.get(
                    "store",
                    ""
                ),
                "active": user_data.get(
                    "active",
                    False
                ),
            })

        # 社員番号順
        staff_list.sort(
            key=lambda staff:
                staff["employeeId"]
        )

        return {
            "staff": staff_list
        }

    except HTTPException:
        raise

    except Exception as error:
        print(
            "社員一覧取得エラー：",
            error
        )

        raise HTTPException(
            status_code=500,
            detail="社員一覧を取得できませんでした"
        )

# ==============================
# 社員情報編集
# ==============================

@app.put("/staff/{uid}")
def update_staff(
    uid: str,
    request: StaffUpdateRequest,
    authorization: str | None = Header(default=None),
):
    current_user = require_headquarters(authorization)

    if uid == current_user["uid"] and request.role != "headquarters":
        raise HTTPException(
            status_code=400,
            detail="自分自身の本社権限は変更できません",
        )

    if request.role not in [
        "staff",
        "manager",
        "headquarters",
    ]:
        raise HTTPException(
            status_code=400,
            detail="権限が正しくありません",
        )

    if not request.name.strip():
        raise HTTPException(
            status_code=400,
            detail="氏名を入力してください",
        )

    if not request.store.strip():
        raise HTTPException(
            status_code=400,
            detail="所属店舗を入力してください",
        )

    try:
        user_ref = db.collection("users").document(uid)

        if not user_ref.get().exists:
            raise HTTPException(
                status_code=404,
                detail="社員が見つかりません",
            )

        user_ref.update({
            "name": request.name.strip(),
            "role": request.role,
            "store": request.store.strip(),
        })

        return {
            "message": "社員情報を更新しました"
        }

    except HTTPException:
        raise

    except Exception as error:
        print("社員情報更新エラー：", error)

        raise HTTPException(
            status_code=500,
            detail="社員情報を更新できませんでした",
        )

@app.patch("/staff/{uid}/active")
def change_staff_active(
    uid: str,
    request: StaffActiveRequest,
    authorization: str | None = Header(default=None),
):
    current_user = require_headquarters(authorization)

    # 自分自身を利用停止にできないようにする
    if uid == current_user["uid"] and not request.active:
        raise HTTPException(
            status_code=400,
            detail="自分自身を利用停止にはできません",
        )

    try:
        user_ref = db.collection("users").document(uid)

        if not user_ref.get().exists:
            raise HTTPException(
                status_code=404,
                detail="社員が見つかりません",
            )

        # Firebase Authentication側
        firebase_auth.update_user(
            uid,
            disabled=not request.active,
        )

        # Firestore側
        user_ref.update({
            "active": request.active
        })

        return {
            "message":
                "利用状態を変更しました"
        }

    except HTTPException:
        raise

    except Exception as error:
        print("利用状態変更エラー：", error)

        raise HTTPException(
            status_code=500,
            detail="利用状態を変更できませんでした",
        )

@app.delete("/staff/{uid}")
def delete_staff(
    uid: str,
    authorization: str | None = Header(default=None),
):
    current_user = require_headquarters(authorization)

    # 自分自身は削除不可
    if uid == current_user["uid"]:
        raise HTTPException(
            status_code=400,
            detail="自分自身は削除できません",
        )

    try:
        user_ref = db.collection("users").document(uid)

        if not user_ref.get().exists:
            raise HTTPException(
                status_code=404,
                detail="社員が見つかりません",
            )

        # Firebase Authenticationから削除
        firebase_auth.delete_user(uid)

        # Firestoreから削除
        user_ref.delete()

        return {
            "message": "社員を削除しました"
        }

    except HTTPException:
        raise

    except Exception as error:
        print("社員削除エラー：", error)

        raise HTTPException(
            status_code=500,
            detail="社員を削除できませんでした",
        )

# ==============================
# 初期本社ユーザー登録
# ==============================

@app.post("/setup/initial-admin")
def setup_initial_admin(
    request: InitialAdminRequest
):
    employee_id = request.employee_id.strip()

    if employee_id != "10001":
        raise HTTPException(
            status_code=403,
            detail="初期本社ユーザーとして登録できません"
        )

    email = f"{employee_id}@lumina.local"

    try:
        # Authenticationからユーザーを取得
        firebase_user = (
            firebase_auth.get_user_by_email(email)
        )

        # Firestoreへ社員情報を登録
        user_data = {
            "employeeId": employee_id,
            "name": "本社 管理者",
            "role": "headquarters",
            "store": "本社",
            "active": True,
        }

        db.collection("users").document(
            firebase_user.uid
        ).set(user_data)

        return {
            "success": True,
            "message": "本社管理者を登録しました",
            "employeeId": employee_id,
        }

    except firebase_auth.UserNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Authenticationに10001が登録されていません"
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"登録中にエラーが発生しました：{str(error)}"
        )

# ==============================
# PDF登録
# ==============================

@app.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    document_id: str = Form(...),
    title: str = Form(...),
    category: str = Form(...),
    target_role: str = Form(...),
    updated_at: str = Form(...),
    status: str = Form(...),
    authorization: str | None = Header(default=None),
):
    # 店長・MG / 本社だけ許可
    require_manager_or_headquarters(
        authorization
    )

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

@app.delete("/documents/{file_name}")
def delete_document(
    file_name: str,
    authorization: str | None = Header(default=None),
):
    # 店長・MG / 本社だけ許可
    require_manager_or_headquarters(
        authorization
    )

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