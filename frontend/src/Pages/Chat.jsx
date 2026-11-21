import { useEffect, useRef, useState } from "react";
import Button from "../Components/Button";
import Input from "../Components/Input";
import Card from "../Components/Card";
import Header from "../Components/Header";
import Footer from "../Components/Footer";

// Three columns: sidebar (rooms, direct messages, log out) · room chat · order summary.
// All state and Nexconn calls live in App; this page only shows them.
export default function Chat({ me, groupId, timeline, dms, cards, joins, actions, rooms = [] }) {
  const [newName, setNewName] = useState("");   // name for a new room
  const [joinName, setJoinName] = useState(""); // name of a room to join
  const [dmTo, setDmTo] = useState("");
  const [dmText, setDmText] = useState("");
  const endRef = useRef(null);

  const roomItems = timeline.filter((t) => t.groupId === groupId);
  const roomCards = Object.entries(cards).filter(([, c]) => c.groupId === groupId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [roomItems.length]);

  async function sendDm(e) {
    e.preventDefault();
    if (await actions.sendDm(dmTo.trim(), dmText)) setDmText("");
  }

  // My total across this room's items
  const myTotal = roomCards.reduce((sum, [id, c]) => sum + (joins[id]?.[me] || 0) * c.price, 0);

  return (
    <div className="shell">
      {/* ---------- Sidebar ---------- */}
      <aside className="panel sidebar">
        <div className="brand"><span className="logo">◎</span> Order Share</div>
        <div className="me"><span className="avatar">{me[0]?.toUpperCase()}</span> {me}</div>

        {/* <section className="section">
          <div className="label">Room</div>
          {groupId ? (
            <code className="room-id">{groupId}</code>
          ) : (
            <>
              <Button onClick={actions.createRoom}>+ New room</Button>
              <div className="or">or join one</div>
              <form className="stack" onSubmit={(e) => { e.preventDefault(); actions.joinRoom(joinId.trim()); }}>
                <Input placeholder="Room ID" value={joinId} onChange={(e) => setJoinId(e.target.value)} />
                <Button type="submit" variant="secondary" disabled={!joinId.trim()}>Join room</Button>
              </form>
            </>
          )}
        </section> */}

                <section className="section">
          <div className="label">My rooms</div>
          {rooms.length === 0 && <p className="muted">No rooms yet.</p>}
          {[
            ["Created by me", rooms.filter((r) => r.isCreator)],
            ["Joined", rooms.filter((r) => !r.isCreator)],
          ].map(([title, list]) => list.length > 0 && (
            <div key={title} className="room-group">
              <div className="room-group-title">{title}</div>
              {list.map((r) => (
                <button key={r.groupId} type="button"
                  className={`room-item ${r.groupId === groupId ? "is-active" : ""}`}
                  onClick={() => actions.enterRoom(r.groupId)}>
                  <span className="room-name">{r.name}</span>
                  <code className="room-code">{r.groupId}</code>
                </button>
              ))}
            </div>
          ))}
          <form className="stack" onSubmit={async (e) => {
            e.preventDefault();
            if (await actions.createRoom(newName.trim())) setNewName("");
          }}>
            <Input placeholder="New room name (must be unique)" maxLength={64} value={newName}
              onChange={(e) => setNewName(e.target.value)} />
            <Button type="submit" disabled={!newName.trim()}>+ Create room</Button>
          </form>
          <div className="or">or join one</div>
          <form className="stack" onSubmit={async (e) => {
            e.preventDefault();
            if (await actions.joinRoom(joinName.trim())) setJoinName("");
          }}>
            <Input placeholder="Room name" maxLength={64} value={joinName}
              onChange={(e) => setJoinName(e.target.value)} />
            <Button type="submit" variant="secondary" disabled={!joinName.trim()}>Join room</Button>
          </form>
        </section>


        <section className="section">
          <div className="label">Direct message</div>
          <form className="stack" onSubmit={sendDm}>
            <Input placeholder="To (username)" value={dmTo} onChange={(e) => setDmTo(e.target.value)} />
            <Input placeholder="Message" value={dmText} onChange={(e) => setDmText(e.target.value)} />
            <Button type="submit" variant="secondary" disabled={!dmTo.trim() || !dmText.trim()}>Send</Button>
          </form>
          {dms.length > 0 && (
            <ul className="dm-list">
              {dms.slice(-6).map((d) => (
                <li key={d.id}>
                  <b>{d.from === me ? `you → ${d.peer}` : d.from}</b>: {d.text}
                </li>
              ))}
            </ul>
          )}
        </section>

        <Button variant="ghost" className="logout" onClick={actions.logout}>⎋ Log out</Button>
      </aside>

      {/* ---------- Room chat ---------- */}
      <main className="panel chat">
        {groupId ? (
          <>
            <Header roomId={groupId} roomName={rooms.find((r) => r.groupId === groupId)?.name} />
            <div className="timeline">
              {roomItems.length === 0 && (
                <div className="empty">Share the room ID, wait for everyone to join, then post the first item with “+ Item”.</div>
              )}
              {roomItems.map((t) => {
                if (t.kind === "card") {
                  const c = cards[t.cardId];
                  return c ? (
                    <Card key={t.id} card={c} people={joins[t.cardId] || {}} me={me}
                      onJoin={(qty) => actions.joinCard(t.cardId, qty)} />
                  ) : null;
                }
                if (t.kind === "join") {
                  return (
                    <div key={t.id} className="sys">
                      {t.from === me ? "You" : t.from} want{t.from === me ? "" : "s"} {t.qty} × {cards[t.cardId]?.item ?? "item"}
                    </div>
                  );
                }
                const mine = t.from === me;
                return (
                  <div key={t.id} className={`bubble-row ${mine ? "mine" : ""}`}>
                    {!mine && <span className="avatar sm">{t.from[0]?.toUpperCase()}</span>}
                    <div className="bubble">
                      {!mine && <div className="bubble-from">{t.from}</div>}
                      {t.text}
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <Footer onSend={actions.sendRoom} onPostItem={actions.postCard} />
          </>
        ) : (
          <div className="empty center">
            <h2>No room yet</h2>
            <p>Create a room or join one with its ID to start a group order.</p>
          </div>
        )}
      </main>

      {/* ---------- Order summary ---------- */}
      <aside className="panel summary">
        <div className="label">Order summary</div>
        {roomCards.length === 0 ? (
          <p className="muted">Items posted in the room show up here.</p>
        ) : (
          <ul className="summary-list">
            {roomCards.map(([id, c]) => {
              const people = joins[id] || {};
              const total = Object.values(people).reduce((a, b) => a + b, 0);
              const pct = Math.min(100, Math.round((total / c.target) * 100));
              return (
                <li key={id} className={total >= c.target ? "is-reached" : ""}>
                  <div className="summary-head"><span>{c.item}</span><span>{total}/{c.target}</span></div>
                  <div className="progress"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="my-total">
          <span>You pay</span>
          <b>{myTotal}</b>
        </div>
      </aside>
    </div>
  );
}
