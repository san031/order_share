import { useState } from "react";
import Button from "./Button";

// Message box at the bottom of the chat, with a toggle for the "post an item" form.
// onSend(text) and onPostItem({item, price, target}) return true on success.
export default function Footer({ onSend, onPostItem }) {
  const [text, setText] = useState("");
  const [showItem, setShowItem] = useState(false);
  const [item, setItem] = useState({ item: "", price: "", target: "" });

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    if (await onSend(text)) setText("");
  }

  async function post(e) {
    e.preventDefault();
    if (await onPostItem(item)) {
      setItem({ item: "", price: "", target: "" });
      setShowItem(false);
    }
  }

  return (
    <footer className="composer">
      {showItem && (
        <form className="item-form" onSubmit={post}>
          <input className="input" placeholder="Item (e.g. rice 5kg)" value={item.item}
            onChange={(e) => setItem({ ...item, item: e.target.value })} />
          <input className="input" placeholder="Price each" type="number" min="0" step="any" value={item.price}
            onChange={(e) => setItem({ ...item, price: e.target.value })} />
          <input className="input" placeholder="Target qty" type="number" min="1" step="1" value={item.target}
            onChange={(e) => setItem({ ...item, target: e.target.value })} />
          <Button type="submit">Post item</Button>
        </form>
      )}
      <form className="composer-row" onSubmit={send}>
        <Button variant="secondary" onClick={() => setShowItem((s) => !s)}>
          {showItem ? "× Item" : "+ Item"}
        </Button>
        <input className="input grow" placeholder="Message the room…" value={text}
          onChange={(e) => setText(e.target.value)} />
        <Button type="submit" disabled={!text.trim()}>Send</Button>
      </form>
    </footer>
  );
}
