import { useState } from "react";
import Button from "./Button";

// Room header: room name (what people type to join), room ID and a copy-name button
export default function Header({ roomId, roomName }) {
  const [copied, setCopied] = useState(false);
  const shareText = roomName || roomId;

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("Copy failed. Room name: " + shareText);
    }
  }

  return (
    <header className="chat-header">
      <div>
        <div className="chat-title">{roomName || "Group order"}</div>
        <div className="chat-sub">Join with this name · ID <code>{roomId}</code></div>
      </div>
      <Button variant="secondary" onClick={copy}>{copied ? "Copied" : "Copy room name"}</Button>
    </header>
  );
}
