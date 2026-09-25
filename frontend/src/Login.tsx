import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";

function Login() {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      // 社員番号をFirebase Authentication用の
      // メールアドレス形式に内部変換
      const loginEmail = `${employeeId.trim()}@lumina.local`;

      await signInWithEmailAndPassword(
        auth,
        loginEmail,
        password
      );
    } catch (error) {
      console.error(error);

      setError(
        "社員番号またはパスワードを確認してください"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>LUMINA</h1>
        <p>社内ナレッジAI</p>

        <h2>ログイン</h2>

        <form onSubmit={handleLogin}>
          <div className="login-field">
            <label>社員番号</label>

            <input
              type="text"
              value={employeeId}
              onChange={(e) =>
                setEmployeeId(e.target.value)
              }
              placeholder="例：10001"
              autoComplete="username"
              required
            />
          </div>

          <div className="login-field">
            <label>パスワード</label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="パスワードを入力"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="login-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading
              ? "ログイン中..."
              : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;