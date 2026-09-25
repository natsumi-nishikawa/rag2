import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import "./App.css";
import VmdLayout from "./VmdLayout";
import Login from "./Login";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

type Document = {
  filename: string;
};

type Source = {
  filename: string;
  page: number | string;
};

type Staff = {
  uid: string;
  employeeId: string;
  name: string;
  role: string;
  store: string;
  active: boolean;
};

type StaffPage =
  | "list"
  | "create";

type Page =
  | "question"
  | "documents"
  | "vmd"
  | "staff";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("question");

  // ============================
  // ログイン
  // ============================

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [role, setRole] = useState("");
  const [loginUserName, setLoginUserName] = useState("");
  const [staffPage, setStaffPage] =  useState<StaffPage>("list");
  const [staffList, setStaffList] =  useState<Staff[]>([]);
  const [editingStaffUid, setEditingStaffUid] =  useState<string | null>(null);
  const [editStaffName, setEditStaffName] =  useState("");
  const [editStaffStore, setEditStaffStore] =  useState("");
  const [editStaffRole, setEditStaffRole] =  useState("staff");
  const [staffEmployeeId, setStaffEmployeeId] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffStore, setStaffStore] = useState("");
  const [staffRole, setStaffRole] = useState("staff");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setUser(currentUser);
  
        if (!currentUser) {
          setRole("");
          setLoginUserName("");
          setAuthLoading(false);
          return;
        }
  
        try {
          // ============================
          // Firestoreから権限情報を取得
          // ============================
  
          const userRef = doc(
            db,
            "users",
            currentUser.uid
          );
  
          const userSnapshot = await getDoc(
            userRef
          );
  
          if (userSnapshot.exists()) {
            const userData =
              userSnapshot.data();
  
            console.log(
              "ログインUID:",
              currentUser.uid
            );
  
            console.log(
              "Firestoreユーザー情報:",
              userData
            );
  
            console.log(
              "取得したrole:",
              userData.role
            );
  
            setRole(
              userData.role || ""
            );
  
            // ============================
            // Firebase ID Tokenを取得
            // ============================
  
            const idToken =
              await currentUser.getIdToken();
  
            // ============================
            // FastAPI側でもユーザー確認
            // ============================
  
            const response = await fetch(
              "http://127.0.0.1:8000/me",
              {
                headers: {
                  Authorization:
                    `Bearer ${idToken}`,
                },
              }
            );
  
            const meData =
              await response.json();
  
            if (!response.ok) {
              throw new Error(
                meData.detail ||
                  "ユーザー確認に失敗しました"
              );
            }
  
            console.log(
              "FastAPIユーザー情報:",
              meData
            );
            setLoginUserName(meData.name || "");
          } else {
            console.log(
              "Firestoreにユーザー情報がありません"
            );
  
            setRole("");
          }
        } catch (error) {
          console.error(
            "ユーザー権限の取得に失敗しました",
            error
          );
  
          setRole("");
        } finally {
          setAuthLoading(false);
        }
      }
    );
  
    return () => unsubscribe();
  }, []);

  // ============================
  // PDF
  // ============================

  const [file, setFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);

  // ============================
  // Metadata
  // ============================

  const [documentId, setDocumentId] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [category, setCategory] = useState("");
  const [targetRole, setTargetRole] = useState("all");
  const [updatedAt, setUpdatedAt] = useState("");
  const [documentStatus, setDocumentStatus] = useState("active");

  // ============================
  // 質問
  // ============================

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);

  // ============================
  // 共通
  // ============================

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // ============================
  // 登録済み資料取得
  // ============================

  const loadDocuments = async () => {
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/documents"
      );

      const data = await response.json();

      setDocuments(data.documents || []);
    } catch (error) {
      console.error(
        "登録済み資料を取得できませんでした",
        error
      );
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  // ============================
  // PDF登録
  // ============================

  const uploadPdf = async () => {
    if (!file) {
      setMessage("PDFを選択してください");
      return;
    }

    if (!documentId.trim()) {
      setMessage("文書番号を入力してください");
      return;
    }

    if (!documentTitle.trim()) {
      setMessage("資料名を入力してください");
      return;
    }

    if (!category) {
      setMessage("カテゴリを選択してください");
      return;
    }

    if (!updatedAt) {
      setMessage("更新日を入力してください");
      return;
    }

    const formData = new FormData();

    formData.append("file", file);
    formData.append("document_id", documentId);
    formData.append("title", documentTitle);
    formData.append("category", category);
    formData.append("target_role", targetRole);
    formData.append("updated_at", updatedAt);
    formData.append("status", documentStatus);

    setLoading(true);
    setMessage("PDFを登録しています...");

    try {
      if (!user) {
        setMessage("ログイン情報がありません");
        return;
      }
      
      const idToken =
        await user.getIdToken();
      
      const response = await fetch(
        "http://127.0.0.1:8000/upload",
        {
          method: "POST",
      
          headers: {
            Authorization:
              `Bearer ${idToken}`,
          },
      
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail || "登録に失敗しました"
        );
        return;
      }

      setMessage(
        `${data.filename} を登録しました`
      );

      // 登録後に入力内容をリセット
      setFile(null);
      setDocumentId("");
      setDocumentTitle("");
      setCategory("");
      setTargetRole("all");
      setUpdatedAt("");
      setDocumentStatus("active");

      await loadDocuments();
    } catch (error) {
      console.error(error);

      setMessage(
        "サーバーとの通信に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================
  // PDF削除
  // ============================

  const deleteDocument = async (
    filename: string
  ) => {
    const ok = window.confirm(
      `${filename} を削除しますか？`
    );

    if (!ok) {
      return;
    }

    try {
      if (!user) {
        setMessage("ログイン情報がありません");
        return;
      }
      
      const idToken =
        await user.getIdToken();
      
      const response = await fetch(
        `http://127.0.0.1:8000/documents/${encodeURIComponent(
          filename
        )}`,
        {
          method: "DELETE",
      
          headers: {
            Authorization:
              `Bearer ${idToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail || "削除できませんでした"
        );
        return;
      }

      setMessage(
        `${filename} を削除しました`
      );

      await loadDocuments();
    } catch (error) {
      console.error(error);

      setMessage(
        "削除処理に失敗しました"
      );
    }
  };

  // ============================
  // 質問
  // ============================

  const askQuestion = async () => {
    if (!question.trim()) {
      setMessage(
        "質問を入力してください"
      );
      return;
    }

    setLoading(true);
    setAnswer("");
    setSources([]);

    setMessage(
      "社内資料を検索しています..."
    );

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/ask",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            question: question,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail || "質問に失敗しました"
        );
        return;
      }

      setAnswer(data.answer);
      setSources(data.sources || []);
      setMessage("");
    } catch (error) {
      console.error(error);

      setMessage(
        "サーバーとの通信に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  };


  // ============================
  // 社員一覧取得
  // ============================

  const loadStaff = async () => {
    if (!user) {
      return;
    }

    try {
      const idToken =
        await user.getIdToken();

      const response = await fetch(
        "http://127.0.0.1:8000/staff",
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${idToken}`,
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.detail ||
            "社員一覧を取得できませんでした"
        );
        return;
      }

      setStaffList(
        data.staff || []
      );

    } catch (error) {
      console.error(
        "社員一覧取得エラー：",
        error
      );

      setMessage(
        "社員一覧を取得できませんでした"
      );
    }
  };

  const handleLogout = async () => {
    const ok = window.confirm(
      "ログアウトしますか？"
    );
  
    if (!ok) {
      return;
    }
  
    try {
      await signOut(auth);
  
      setRole("");
      setLoginUserName("");
      setCurrentPage("question");
      setMessage("");
    } catch (error) {
      console.error(
        "ログアウトエラー：",
        error
      );
  
      setMessage(
        "ログアウトに失敗しました"
      );
    }
  };

  const startEditStaff = (staff: Staff) => {
    setEditingStaffUid(staff.uid);
    setEditStaffName(staff.name);
    setEditStaffStore(staff.store);
    setEditStaffRole(staff.role);
    setMessage("");
  };

  const updateStaff = async (uid: string) => {
    if (!user) {
      setMessage("ログイン情報がありません");
      return;
    }
  
    if (!editStaffName.trim()) {
      setMessage("氏名を入力してください");
      return;
    }
  
    if (!editStaffStore.trim()) {
      setMessage("所属店舗を入力してください");
      return;
    }
  
    try {
      const idToken =
        await user.getIdToken();
  
      const response = await fetch(
        `http://127.0.0.1:8000/staff/${uid}`,
        {
          method: "PUT",
  
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
  
          body: JSON.stringify({
            name: editStaffName.trim(),
            store: editStaffStore.trim(),
            role: editStaffRole,
          }),
        }
      );
  
      const data = await response.json();
  
      if (!response.ok) {
        setMessage(
          data.detail ||
            "社員情報を更新できませんでした"
        );
        return;
      }
  
      setMessage("社員情報を更新しました");
  
      setEditingStaffUid(null);
  
      await loadStaff();
  
    } catch (error) {
      console.error(
        "社員情報更新エラー：",
        error
      );
  
      setMessage(
        "社員情報の更新中にエラーが発生しました"
      );
    }
  };

  const changeStaffActive = async (
    staff: Staff
  ) => {
    if (!user) {
      setMessage("ログイン情報がありません");
      return;
    }
  
    const newActive = !staff.active;
  
    const actionText = newActive
      ? "利用を再開"
      : "利用停止";
  
    const ok = window.confirm(
      `${staff.name}さんを${actionText}にしますか？`
    );
  
    if (!ok) {
      return;
    }
  
    try {
      const idToken =
        await user.getIdToken();
  
      const response = await fetch(
        `http://127.0.0.1:8000/staff/${staff.uid}/active`,
        {
          method: "PATCH",
  
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
  
          body: JSON.stringify({
            active: newActive,
          }),
        }
      );
  
      const data = await response.json();
  
      if (!response.ok) {
        setMessage(
          data.detail ||
            "利用状態を変更できませんでした"
        );
        return;
      }
  
      setMessage(
        `${staff.name}さんの${actionText}を行いました`
      );
  
      await loadStaff();
  
    } catch (error) {
      console.error(
        "利用状態変更エラー：",
        error
      );
  
      setMessage(
        "利用状態の変更中にエラーが発生しました"
      );
    }
  };

  const deleteStaff = async (
    staff: Staff
  ) => {
    if (!user) {
      setMessage("ログイン情報がありません");
      return;
    }
  
    const ok = window.confirm(
      `${staff.name}さんを削除しますか？\nこの操作は元に戻せません。`
    );
  
    if (!ok) {
      return;
    }
  
    try {
      const idToken =
        await user.getIdToken();
  
      const response = await fetch(
        `http://127.0.0.1:8000/staff/${staff.uid}`,
        {
          method: "DELETE",
  
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );
  
      const data = await response.json();
  
      if (!response.ok) {
        setMessage(
          data.detail ||
            "社員を削除できませんでした"
        );
        return;
      }
  
      setMessage(
        `${staff.name}さんを削除しました`
      );
  
      await loadStaff();
  
    } catch (error) {
      console.error(
        "社員削除エラー：",
        error
      );
  
      setMessage(
        "社員の削除中にエラーが発生しました"
      );
    }
  };

  // ============================
  // 社員登録
  // ============================

  const createStaff = async () => {
    if (!user) {
      setMessage("ログイン情報がありません");
      return;
    }

    if (!staffEmployeeId.trim()) {
      setMessage("社員番号を入力してください");
      return;
    }

    if (!staffName.trim()) {
      setMessage("氏名を入力してください");
      return;
    }

    if (staffPassword.length < 6) {
      setMessage("パスワードは6文字以上にしてください");
      return;
    }

    if (!staffStore.trim()) {
      setMessage("所属店舗を入力してください");
      return;
    }

    setLoading(true);
    setMessage("社員を登録しています...");

    try {
      const idToken = await user.getIdToken();

      const response = await fetch(
        "http://127.0.0.1:8000/staff",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },

          body: JSON.stringify({
            employee_id: staffEmployeeId.trim(),
            name: staffName.trim(),
            password: staffPassword,
            role: staffRole,
            store: staffStore.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail || "社員登録に失敗しました"
        );
        return;
      }

      setMessage(
        `${data.name}さんを登録しました`
      );

      // 入力欄を空にする
      setStaffEmployeeId("");
      setStaffName("");
      setStaffPassword("");
      setStaffStore("");
      setStaffRole("staff");
      await loadStaff();
      setStaffPage("list");

    } catch (error) {
      console.error(
        "社員登録エラー：",
        error
      );

      setMessage(
        "社員登録中にエラーが発生しました"
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================
  // 画面
  // ============================

  if (authLoading) {
    return <div>ログイン情報を確認しています...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-layout">

      {/* ============================
          サイドバー
      ============================ */}

      <aside className="sidebar">

        <div className="sidebar-logo">
          <h1>LUMINA</h1>
          <p>社内ナレッジAI</p>
        </div>

        <nav className="sidebar-menu">

          {/* 質問する */}

          <button
            className={
              currentPage === "question"
                ? "menu-button active"
                : "menu-button"
            }
            onClick={() => {
              setCurrentPage("question");
              setMessage("");
            }}
          >
            🔍 質問する
          </button>

          {/* 資料管理 */}

          <button
            className={
              currentPage === "documents"
                ? "menu-button active"
                : "menu-button"
            }
            onClick={() => {
              setCurrentPage("documents");
              setMessage("");
              loadDocuments();
            }}
          >
            📄 資料管理
          </button>

          {/* VMD提案 */}

          <button
            className={
              currentPage === "vmd"
                ? "menu-button active"
                : "menu-button"
            }
            onClick={() => {
              setCurrentPage("vmd");
              setMessage("");
            }}
          >
            🏬 VMD提案
          </button>

          {/* スタッフ管理 */}

          {role === "headquarters" && (
            <button
              className={
                currentPage === "staff"
                  ? "menu-button active"
                  : "menu-button"
              }
              onClick={() => {
                setCurrentPage("staff");
                setStaffPage("list");
                setMessage("");
                loadStaff();
              }}
            >
              👥 スタッフ管理
            </button>
          )}

        </nav>

      </aside>

      {/* ============================
          メイン画面
      ============================ */}

      <main className="main-content">

      <div className="login-user-area">
        <span className="login-user-icon">
          👤
        </span>

        <div>
          <div className="login-user-name">
            {loginUserName}
          </div>

          <div className="login-user-role">
            {role === "headquarters"
              ? "本社"
              : role === "manager"
              ? "店長・MG"
              : "一般スタッフ"}
          </div>
        </div>

        <button
          className="logout-button"
          onClick={handleLogout}
        >
          ログアウト
        </button>

      </div>

        {/* ============================
            質問画面
        ============================ */}

        {currentPage === "question" && (
          <section className="content-card">

            <div className="page-title">
              <h2>社内ナレッジ検索</h2>

              <p>
                社内ルールや過去事例について
                質問してください。
              </p>
            </div>

            <textarea
              className="question-input"
              value={question}
              onChange={(event) =>
                setQuestion(
                  event.target.value
                )
              }
              placeholder="例：セール商品は他店舗から取り寄せできますか？"
            />

            <button
              className="primary-button"
              onClick={askQuestion}
              disabled={loading}
            >
              {loading
                ? "検索中..."
                : "質問する"}
            </button>

            {message && (
              <div className="message">
                {message}
              </div>
            )}

            {answer && (
              <div className="answer-area">

                <h3>AI回答</h3>

                <p className="answer-text">
                  {answer}
                </p>

                <h3>
                  参照した社内資料
                </h3>

                {sources.length === 0 ? (
                  <p className="empty">
                    参照資料はありません。
                  </p>
                ) : (
                  <div className="sources">

                    {sources.map(
                      (source, index) => (
                        <a
                          className="source-card"
                          key={`${source.filename}-${source.page}-${index}`}
                          href={`http://127.0.0.1:8000/documents/${encodeURIComponent(
                            source.filename
                          )}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          📄 {source.filename}

                          <span>
                            {source.page}ページ
                          </span>
                        </a>
                      )
                    )}

                  </div>
                )}

              </div>
            )}

          </section>
        )}

        {/* ============================
            資料管理画面
        ============================ */}

        {currentPage === "documents" && (
          <section className="content-card">

            <div className="page-title">
              <h2>社内資料管理</h2>

              <p>
                RAGに使用する社内資料を管理します。
              </p>
            </div>

            {/* ============================
                PDF・Metadata登録
            ============================ */}

            {(role === "manager" ||
              role === "headquarters") && (

              <div className="upload-box">

                {/* PDF */}

                <div className="metadata-field">
                  <label>PDFファイル</label>

                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(event) => {
                      const selected =
                        event.target.files?.[0];

                      if (selected) {
                        setFile(selected);
                      }
                    }}
                  />
                </div>

                {/* Metadata */}

                <div className="metadata-form">

                  <div className="metadata-field">
                    <label>文書番号</label>

                    <input
                      type="text"
                      value={documentId}
                      onChange={(event) =>
                        setDocumentId(
                          event.target.value
                        )
                      }
                      placeholder="例：CS-001"
                    />
                  </div>

                  <div className="metadata-field">
                    <label>資料名</label>

                    <input
                      type="text"
                      value={documentTitle}
                      onChange={(event) =>
                        setDocumentTitle(
                          event.target.value
                        )
                      }
                      placeholder="例：接客・返品マニュアル"
                    />
                  </div>

                  <div className="metadata-field">
                    <label>カテゴリ</label>

                    <select
                      value={category}
                      onChange={(event) =>
                        setCategory(
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        選択してください
                      </option>

                      <option value="customer-service">
                        接客・返品
                      </option>

                      <option value="inventory">
                        在庫・棚卸し
                      </option>

                      <option value="store-operation">
                        店舗運営
                      </option>

                      <option value="hr">
                        勤怠・社内ルール
                      </option>

                      <option value="trouble">
                        トラブル対応
                      </option>

                      <option value="vmd">
                        VMD
                      </option>

                      <option value="other">
                        その他
                      </option>
                    </select>
                  </div>

                  <div className="metadata-field">
                    <label>対象者</label>

                    <select
                      value={targetRole}
                      onChange={(event) =>
                        setTargetRole(
                          event.target.value
                        )
                      }
                    >
                      <option value="all">
                        全スタッフ
                      </option>

                      <option value="manager">
                        店長・MG
                      </option>

                      <option value="headquarters">
                        本社
                      </option>
                    </select>
                  </div>

                  <div className="metadata-field">
                    <label>更新日</label>

                    <input
                      type="date"
                      value={updatedAt}
                      onChange={(event) =>
                        setUpdatedAt(
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div className="metadata-field">
                    <label>状態</label>

                    <select
                      value={documentStatus}
                      onChange={(event) =>
                        setDocumentStatus(
                          event.target.value
                        )
                      }
                    >
                      <option value="active">
                        有効
                      </option>

                      <option value="inactive">
                        無効
                      </option>
                    </select>
                  </div>

                </div>

                {/* 登録ボタン */}

                <button
                  className="primary-button"
                  onClick={uploadPdf}
                  disabled={loading}
                >
                  {loading
                    ? "登録中..."
                    : "PDFを登録"}
                </button>

              </div>

            )}


            {/* ============================
                登録済み資料
            ============================ */}

            <div className="document-section">

              <h3>登録済み資料</h3>

              {documents.length === 0 ? (
                <p className="empty">
                  登録されている資料はありません。
                </p>
              ) : (
                <div className="documents">

                  {documents.map(
                    (document) => (
                      <div
                        className="document"
                        key={document.filename}
                      >

                        <a
                          href={`http://127.0.0.1:8000/documents/${encodeURIComponent(
                            document.filename
                          )}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          📄 {document.filename}
                        </a>

                        {(role === "manager" ||
                          role === "headquarters") && (

                          <button
                            className="delete-button"
                            onClick={() =>
                              deleteDocument(
                                document.filename
                              )
                            }
                          >
                            削除
                          </button>

                        )}

                      </div>
                    )
                  )}

                </div>
              )}

            </div>

          </section>
        )}

        {/* ============================
            VMD提案画面
        ============================ */}

        {currentPage === "vmd" && (
          <VmdLayout />
        )}

        {/* ============================
    スタッフ管理画面
============================ */}

{currentPage === "staff" &&
  role === "headquarters" && (
    <section className="content-card">

      <div className="page-title">
        <h2>スタッフ管理</h2>

        <p>
          社員情報の登録・確認・管理を行います。
        </p>
      </div>

      {/* 画面切り替え */}

      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "24px",
        }}
      >
        <button
          className="primary-button"
          onClick={() => {
            setStaffPage("list");
            setMessage("");
            loadStaff();
          }}
        >
          👥 社員一覧
        </button>

        <button
          className="primary-button"
          onClick={() => {
            setStaffPage("create");
            setMessage("");
          }}
        >
          ＋ 社員登録
        </button>
      </div>

      {/* ============================
          社員一覧
      ============================ */}

      {staffPage === "list" && (
        <div>
          <h3>登録済み社員</h3>

          {staffList.length === 0 ? (
            <p className="empty">
              登録されている社員はいません。
            </p>
          ) : (
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr>
                    <th>社員番号</th>
                    <th>氏名</th>
                    <th>所属</th>
                    <th>権限</th>
                    <th>状態</th>
                    <th>操作</th>
                  </tr>
                </thead>

                <tbody>
                  {staffList.map((staff) => (
                    <tr key={staff.uid}>

                      {/* 社員番号 */}
                      <td>
                        {staff.employeeId}
                      </td>

                      {/* 氏名 */}
                      <td>
                        {editingStaffUid === staff.uid ? (
                          <input
                            type="text"
                            value={editStaffName}
                            onChange={(event) =>
                              setEditStaffName(
                                event.target.value
                              )
                            }
                          />
                        ) : (
                          staff.name
                        )}
                      </td>

                      {/* 所属 */}
                      <td>
                        {editingStaffUid === staff.uid ? (
                          <input
                            type="text"
                            value={editStaffStore}
                            onChange={(event) =>
                              setEditStaffStore(
                                event.target.value
                              )
                            }
                          />
                        ) : (
                          staff.store
                        )}
                      </td>

                      {/* 権限 */}
                      <td>
                        {editingStaffUid === staff.uid ? (
                          <select
                            value={editStaffRole}
                            onChange={(event) =>
                              setEditStaffRole(
                                event.target.value
                              )
                            }
                          >
                            <option value="staff">
                              一般スタッフ
                            </option>

                            <option value="manager">
                              店長・MG
                            </option>

                            <option value="headquarters">
                              本社
                            </option>
                          </select>
                        ) : (
                          staff.role === "headquarters"
                            ? "本社"
                            : staff.role === "manager"
                            ? "店長・MG"
                            : "一般スタッフ"
                        )}
                      </td>

                      {/* 状態 */}
                      <td>
                        {staff.active
                          ? "利用中"
                          : "利用停止"}
                      </td>

                      {/* 操作 */}
                      <td>
                        {editingStaffUid === staff.uid ? (
                          <div
                            style={{
                              display: "flex",
                              gap: "6px",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              onClick={() =>
                                updateStaff(staff.uid)
                              }
                            >
                              保存
                            </button>

                            <button
                              onClick={() => {
                                setEditingStaffUid(null);
                                setMessage("");
                              }}
                            >
                              キャンセル
                            </button>
                          </div>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              gap: "6px",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              onClick={() =>
                                startEditStaff(staff)
                              }
                            >
                              編集
                            </button>

                            <button
                              onClick={() =>
                                changeStaffActive(staff)
                              }
                            >
                              {staff.active
                                ? "利用停止"
                                : "利用再開"}
                            </button>

                            <button
                              className="delete-button"
                              onClick={() =>
                                deleteStaff(staff)
                              }
                            >
                              削除
                            </button>
                          </div>
                        )}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {message && (
            <div className="message">
              {message}
            </div>
          )}
        </div>
      )}

      {/* ============================
          社員登録
      ============================ */}

      {staffPage === "create" && (
        <div>
          <h3>社員登録</h3>

          <div className="metadata-form">

            <div className="metadata-field">
              <label>社員番号</label>

              <input
                type="text"
                value={staffEmployeeId}
                onChange={(event) =>
                  setStaffEmployeeId(
                    event.target.value
                  )
                }
                placeholder="例：10002"
              />
            </div>

            <div className="metadata-field">
              <label>氏名</label>

              <input
                type="text"
                value={staffName}
                onChange={(event) =>
                  setStaffName(
                    event.target.value
                  )
                }
                placeholder="例：山田 花子"
              />
            </div>

            <div className="metadata-field">
              <label>初期パスワード</label>

              <input
                type="password"
                value={staffPassword}
                onChange={(event) =>
                  setStaffPassword(
                    event.target.value
                  )
                }
                placeholder="6文字以上"
              />
            </div>

            <div className="metadata-field">
              <label>所属店舗</label>

              <input
                type="text"
                value={staffStore}
                onChange={(event) =>
                  setStaffStore(
                    event.target.value
                  )
                }
                placeholder="例：大津店"
              />
            </div>

            <div className="metadata-field">
              <label>権限</label>

              <select
                value={staffRole}
                onChange={(event) =>
                  setStaffRole(
                    event.target.value
                  )
                }
              >
                <option value="staff">
                  一般スタッフ
                </option>

                <option value="manager">
                  店長・MG
                </option>

                <option value="headquarters">
                  本社
                </option>
              </select>
            </div>

          </div>

          <button
            className="primary-button"
            onClick={createStaff}
            disabled={loading}
          >
            {loading
              ? "登録中..."
              : "社員を登録"}
          </button>

          {message && (
            <div className="message">
              {message}
            </div>
          )}
        </div>
      )}

    </section>
  )}

      </main>

    </div>
  );
}

export default App;