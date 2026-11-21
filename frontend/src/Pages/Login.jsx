import { useState } from "react";
import Button from "../Components/Button";
import Input from "../Components/Input";

// onLogin(username, password) returns an error message, or nothing on success
export default function Login({ onLogin, onGoSignup }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError((await onLogin(username.trim(), password)) || "");
    setBusy(false);
  }

  return (
    <div className="auth-page">
      <form className="panel auth-card" onSubmit={submit}>
        <div className="brand"><span className="logo">◎</span> Order Share</div>
        <h1>Welcome back</h1>
        <p className="muted">Log in to start or join a group order.</p>
        <Input label="Username" value={username} autoComplete="username" autoFocus
          onChange={(e) => setUsername(e.target.value)} />
        <Input label="Password" type="password" value={password} autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="error">{error}</div>}
        <Button type="submit" disabled={busy || !username.trim() || !password}>
          {busy ? "Logging in…" : "Log in"}
        </Button>
        <p className="muted switch">
          New here? <button type="button" className="link" onClick={onGoSignup}>Create an account</button>
        </p>
      </form>
    </div>
  );
}
