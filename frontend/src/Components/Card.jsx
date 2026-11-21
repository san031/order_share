import { useState } from "react";
import Button from "./Button";

// One item card: tally, each person's share, "target reached" summary and a capped Join box.
// people = { userId: qty }. onJoin(qty) returns true when the join was sent.
export default function Card({ card, people, me, onJoin }) {
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);

  const total = Object.values(people).reduce((a, b) => a + b, 0);
  const reached = total >= card.target;
  const maxForMe = card.target - (total - (people[me] || 0)); // what I could hold, at most
  const full = maxForMe < 1;                                   // nothing left and I'm not in
  const pct = Math.min(100, Math.round((total / card.target) * 100));

  async function join() {
    setBusy(true);
    await onJoin(Number(qty));
    setBusy(false);
  }

  return (
    <div className={`item-card ${reached ? "is-reached" : ""}`}>
      <div className="item-head">
        <span className="item-name">{card.item}</span>
        <span className="chip">{card.price} each</span>
      </div>
      <div className="item-meta">posted by {card.by} · target {card.target}</div>

      <div className="progress"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
      <div className="item-meta">
        {total} / {card.target} {reached ? "· target reached" : `· ${card.target - total} more needed`}
      </div>

      {Object.keys(people).length > 0 && (
        <ul className="shares">
          {Object.entries(people).map(([u, q]) => (
            <li key={u}>
              <span>{u === me ? "you" : u}</span>
              <span>{q} × {card.price} = <b>{q * card.price}</b></span>
            </li>
          ))}
        </ul>
      )}

      {reached && (
        <div className="reached">
          <b>Target reached!</b>{" "}
          {Object.entries(people).map(([u, q]) => `${u} pays ${q * card.price}`).join(", ")}
          {" "}(total {total * card.price})
        </div>
      )}

      <div className="item-join">
        <input className="input qty" type="number" min="1" max={Math.max(maxForMe, 1)} step="1"
          value={qty} disabled={full || busy} onChange={(e) => setQty(e.target.value)} />
        <Button onClick={join} disabled={full || busy}>
          {full ? "Full" : people[me] ? `Update my qty (max ${maxForMe})` : `Join (max ${maxForMe})`}
        </Button>
      </div>
    </div>
  );
}
