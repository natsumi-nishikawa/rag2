import { useEffect, useState } from "react";
import "./App.css";


type Document = {
  filename: string;
};


type Source = {
  filename: string;
  page: number | string;
};


type Page = "question" | "documents";


function App() {

  // 最初は質問画面
  const [currentPage, setCurrentPage] = useState<Page>("question");

  const [file, setFile] = useState<File | null>(null);

  const [documents, setDocuments] = useState<Document[]>([]);

  const [question, setQuestion] = useState("");

  const [answer, setAnswer] = useState("");

  const [sources, setSources] = useState<Source[]>([]);

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

      setDocuments(data.documents);

    } catch {

      console.error("登録済み資料を取得できませんでした");

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


    const formData = new FormData();

    formData.append(
      "file",
      file
    );


    setLoading(true);

    setMessage(
      "PDFを登録しています..."
    );


    try {

      const response = await fetch(
        "http://127.0.0.1:8000/upload",
        {
          method: "POST",
          body: formData
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

      setFile(null);

      await loadDocuments();


    } catch {

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

      const response = await fetch(
        `http://127.0.0.1:8000/documents/${encodeURIComponent(filename)}`,
        {
          method: "DELETE"
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


    } catch {

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
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            question: question
          })
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


    } catch {

      setMessage(
        "サーバーとの通信に失敗しました"
      );


    } finally {

      setLoading(false);

    }
  };


  return (

    <div className="app-layout">


      {/* =========================
          サイドバー
      ========================== */}

      <aside className="sidebar">

        <div className="sidebar-logo">

          <h1>LUMINA</h1>

          <p>
            社内ナレッジAI
          </p>

        </div>


        <nav className="sidebar-menu">

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

        </nav>

      </aside>


      {/* =========================
          メイン画面
      ========================== */}

      <main className="main-content">


        {/* 質問画面 */}

        {currentPage === "question" && (

          <section className="content-card">

            <div className="page-title">

              <h2>
                社内ナレッジ検索
              </h2>

              <p>
                社内ルールや過去事例について質問してください。
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
                : "質問する"
              }
            </button>


            {message && (

              <div className="message">

                {message}

              </div>

            )}


            {answer && (

              <div className="answer-area">

                <h3>
                  AI回答
                </h3>

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
                          href={`http://127.0.0.1:8000/documents/${encodeURIComponent(source.filename)}/view`}
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


        {/* PDF管理画面 */}

        {currentPage === "documents" && (

          <section className="content-card">

            <div className="page-title">

              <h2>
                社内資料管理
              </h2>

              <p>
                RAGに使用する社内資料を管理します。
              </p>

            </div>


            <div className="upload-box">

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


              <button
                className="primary-button"
                onClick={uploadPdf}
                disabled={loading}
              >
                {loading
                  ? "登録中..."
                  : "PDFを登録"
                }
              </button>

            </div>


            {message && (

              <div className="message">

                {message}

              </div>

            )}


            <div className="document-section">

              <h3>
                登録済み資料
              </h3>


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
                          href={`http://127.0.0.1:8000/documents/${encodeURIComponent(document.filename)}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          📄 {document.filename}
                        </a>


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

                      </div>

                    )
                  )}

                </div>

              )}

            </div>

          </section>

        )}


      </main>

    </div>

  );

}


export default App;