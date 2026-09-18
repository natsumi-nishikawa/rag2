import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert("ログインしました");
    } catch (error) {
      console.error(error);
      setError("メールアドレスまたはパスワードを確認してください");
    }
  };

  return (
    <div>
      <h1>LUMINA 社内ナレッジ</h1>
      <h2>ログイン</h2>

      <form onSubmit={handleLogin}>
        <div>
          <label>メールアドレス</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label>パスワード</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit">ログイン</button>

        {error && <p>{error}</p>}
      </form>
    </div>
  );
}

export default Login;