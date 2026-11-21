import { useState } from "react";
import Button from "../Components/Button";
import Input from "../Components/Input";

// Sign-up page. onSignup(username, password) returns an error message, or nothing on success.
export default function Signin({ onSignup, onGoLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const name = username.trim();
    if (!/^[a-z0-9]{3,20}$/.test(name)) { setError("Username: use 3-20 lowercase letters or digits."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setBusy(true);
    setError((await onSignup(name, password)) || "");
    setBusy(false);
  }

  return (
    <div className="auth-page">
      <form className="panel auth-card" onSubmit={submit}>
        <div className="brand"><span className="logo">◎</span> Order Share</div>
        <h1>Create an account</h1>
        <p className="muted">Pick a username your friends will see in the room.</p>
        <Input label="Username (3-20 lowercase letters or digits)" value={username} autoComplete="username" autoFocus
          onChange={(e) => setUsername(e.target.value)} />
        <Input label="Password (at least 8 characters)" type="password" value={password} autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)} />
        <Input label="Confirm password" type="password" value={confirm} autoComplete="new-password"
          onChange={(e) => setConfirm(e.target.value)} />
        {error && <div className="error">{error}</div>}
        <Button type="submit" disabled={busy || !username.trim() || !password || !confirm}>
          {busy ? "Creating…" : "Sign up"}
        </Button>
        <p className="muted switch">
          Already have an account? <button type="button" className="link" onClick={onGoLogin}>Log in</button>
        </p>
      </form>
    </div>
  );
}
