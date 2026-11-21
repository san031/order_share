import { useEffect, useState } from "react";
import {
  DirectChannel,
  GroupChannel,
  ChannelType,
  SendTextMessageParams,
  SendMessageParams,
  BaseChannel,
  GroupChannelIdentifier
} from "@nexconn/chat";
import * as api from "./api";
import { initChat, connectChat, disconnectChat, CARD_TYPE, JOIN_TYPE } from "./chatClient";
import Login from "./Pages/Login";
import Signin from "./Pages/Signin";
import Chat from "./Pages/Chat";

let seq = 0;
const uid = () => `${Date.now()}-${seq++}`;

// Login saved by startSession, so a page refresh can reconnect: { userId, token }
function readSavedAuth() {
  try { return JSON.parse(sessionStorage.getItem("auth") || "null"); } catch { return null; }
}
function clearSavedAuth() {
  try { sessionStorage.removeItem("auth"); } catch { /* storage blocked */ }
}
let restoreStarted = false; // React StrictMode runs effects twice in dev; reconnect only once

export default function App() {
  // "restoring" while reconnecting a saved login after a refresh
  const [page, setPage] = useState(() => (readSavedAuth() ? "restoring" : "login")); // "login" | "signup" | "chat" | "restoring"
  const [me, setMe] = useState("");
  const [groupId, setGroupId] = useState("");  // room I'm in
  const [timeline, setTimeline] = useState([]); // room items: { id, groupId, kind: text|card|join, from, ... }
  const [dms, setDms] = useState([]);           // direct messages: { id, from, peer, text }
  // Item cards and the tally (computed in React from received messages)
  const [cards, setCards] = useState({});       // cardId -> { groupId, by, item, price, target }
  const [joins, setJoins] = useState({});       // cardId -> { userId: qty }

  const [rooms, setRooms] = useState([]);
  const pushRoom = (entry) => setTimeline((t) => [...t, { id: uid(), ...entry }]);
  const pushDm = (entry) => setDms((d) => [...d, { id: uid(), ...entry }]);

  const applyCard = (gid, by, c) =>
    setCards((all) => ({ ...all, [c.cardId]: { groupId: gid, by, item: c.item, price: Number(c.price), target: Number(c.target) } }));
  const applyJoin = (by, j) =>
    setJoins((all) => ({ ...all, [j.cardId]: { ...(all[j.cardId] || {}), [by]: Number(j.qty) } }));

  // ---------- Incoming messages ----------
  function handleMessages(messages) {
    messages.forEach((m) => {
      const ch = m.channelIdentifier;
      const from = m.senderUserId ?? "?";
      if (ch?.channelType === ChannelType.GROUP) {
        const gid = ch.channelId;
        if (m.messageType === CARD_TYPE) {
          applyCard(gid, from, m.content);
          pushRoom({ groupId: gid, kind: "card", from, cardId: m.content?.cardId });
        } else if (m.messageType === JOIN_TYPE) {
          applyJoin(from, m.content);
          pushRoom({ groupId: gid, kind: "join", from, cardId: m.content?.cardId, qty: m.content?.qty });
        } else {
          // Text messages carry content.text; anything else (e.g. group notifications) shows its type
          pushRoom({ groupId: gid, kind: "text", from, text: m.content?.text ?? `(${m.messageType})` });
        }
      } else {
        pushDm({ from, peer: from, text: m.content?.text ?? `(${m.messageType})` });
      }
    });
  }

  // ---------- Accounts ----------
  // After signup/login: get a Nexconn token from Django (authenticated) and connect
  async function startSession(res, fallback) {
    if (!res.ok) return api.errorText(res, fallback);
    const { userId, token } = res.data;
    api.setAuthToken(token);

    try { sessionStorage.setItem("auth", JSON.stringify({ userId, token })); } catch { /* storage blocked */ }

    initChat(handleMessages);
    const t = await api.getChatToken();
    if (!t.ok) { api.setAuthToken(""); 
      
      return api.errorText(t, "Chat token request failed"); }
    const c = await connectChat(t.data.token);
    if (c.code !== 0) { api.setAuthToken(""); return "Chat connection failed, code " + c.code; }

    setMe(userId);
    await loadRooms();
    setPage("chat");
  }

  // On page load: if a login was saved in this tab, reconnect with it (same steps as a fresh login)
  useEffect(() => {
    const saved = readSavedAuth();
    if (!saved?.token || !saved?.userId || restoreStarted) return;
    restoreStarted = true;
    (async () => {
      const err = await startSession({ ok: true, data: saved }, "Reconnect failed");
      if (err) {
        // e.g. token deleted by logout in another tab, or Django/Nexconn unreachable
        console.warn("Reconnect failed:", err);
        clearSavedAuth();
        api.setAuthToken("");
        setPage("login");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on load
  }, []);

  const doLogin = async (u, p) => startSession(await api.login(u, p), "Login failed");
  const doSignup = async (u, p) => startSession(await api.signup(u, p), "Sign up failed");

  async function logout() {
    await api.logout();
    try { await disconnectChat(); } catch (e) { console.warn("disconnect", e); }
    api.setAuthToken("");
    setMe(""); setGroupId(""); setTimeline([]); setDms([]); setCards({}); setJoins({});
    setPage("login");
    setRooms([])

    clearSavedAuth();
  }

  // ---------- Direct message (Hour 1) ----------
  async function sendDm(peer, text) {
    if (!peer || !text.trim()) return false;
    const { code } = await new DirectChannel(peer).sendMessage(new SendTextMessageParams({ text }));
    if (code !== 0) { alert("Send failed, code " + code); return false; }
    pushDm({ from: me, peer, text });
    return true;
  }

    async function loadRooms() {
    const r = await api.myGroups();
    if (r.ok) setRooms(r.data);
  }

  // Load a room's past messages from Nexconn and replay them through the normal handler
  async function loadHistory(gid) {
    setTimeline((t) => t.filter((x) => x.groupId !== gid)); // avoid duplicates on re-entry
    const query = BaseChannel.createMessagesQuery({
      channelIdentifier: new GroupChannelIdentifier(gid),
      pageSize: 50,
      isAscending: true, // oldest first, so the latest join quantity wins
    });
    for (let page = 0; page < 5 && query.hasNext; page++) {
      const res = await query.loadNextPage();
      console.log("history", res); // check the shape the first time
      if (!res.isOk) { alert("Couldn't load room history"); return; }
      handleMessages(res.data.data);
    }
  }

  async function enterRoom(gid) {
    setGroupId(gid);
    await loadHistory(gid);
  }


  // ---------- Group room (Hour 2) ----------
  // Room names are unique (ignoring case); people join by name. Both return true on success.
  async function createRoom(name) {
    if (!name) return false;
    const r = await api.createGroup(name);
    if (!r.ok) { alert(api.errorText(r, "Create room failed")); return false; }
    await loadRooms();
    await enterRoom(r.data.groupId);
    return true;
  }

  async function joinRoom(name) {
    if (!name) return false;
    const r = await api.joinGroupByName(name);
    if (!r.ok) { alert(api.errorText(r, "Join failed")); return false; }
    await loadRooms();
    await enterRoom(r.data.groupId);
    return true;
  }

  async function sendRoom(text) {
    const { code } = await new GroupChannel(groupId).sendMessage(new SendTextMessageParams({ text }));
    if (code !== 0) { alert("Send to room failed, code " + code); return false; }
    pushRoom({ groupId, kind: "text", from: me, text });
    return true;
  }

  // ---------- Item cards + tally (Hour 3) ----------
  async function postCard(input) {
    const item = input.item.trim();
    const price = Number(input.price);
    const target = Number(input.target);
    if (!item || !(price > 0) || !Number.isInteger(target) || target < 1) {
      alert("Enter an item, a price above 0 and a whole-number target of at least 1");
      return false;
    }
    const content = { cardId: Math.random().toString(36).slice(2, 10), item, price, target };
    const { code } = await new GroupChannel(groupId).sendMessage(new SendMessageParams(content, CARD_TYPE));
    if (code !== 0) { alert("Post item failed, code " + code); return false; }
    applyCard(groupId, me, content); // own messages aren't received back, so apply locally
    pushRoom({ groupId, kind: "card", from: me, cardId: content.cardId });
    return true;
  }

  async function joinCard(cardId, qty) {
    if (!Number.isInteger(qty) || qty < 1) { alert("Quantity must be a whole number of at least 1"); return false; }
    // Cap at what's left: target minus everyone else's quantity (my old qty is replaced, not added)
    const people = joins[cardId] || {};
    const othersTotal = Object.entries(people).reduce((a, [u, q]) => (u === me ? a : a + q), 0);
    const maxForMe = cards[cardId].target - othersTotal;
    if (qty > maxForMe) {
      alert(maxForMe > 0 ? `Only ${maxForMe} left for you on this item` : "This item's target is already full");
      return false;
    }
    const content = { cardId, qty };
    const { code } = await new GroupChannel(groupId).sendMessage(new SendMessageParams(content, JOIN_TYPE));
    if (code !== 0) { alert("Join item failed, code " + code); return false; }
    applyJoin(me, content);
    pushRoom({ groupId, kind: "join", from: me, cardId, qty });
    return true;
  }

  if (page === "restoring") return <div className="auth-page"><p className="muted">Reconnecting…</p></div>;
  if (page === "signup") return <Signin onSignup={doSignup} onGoLogin={() => setPage("login")} />;
  if (page === "login") return <Login onLogin={doLogin} onGoSignup={() => setPage("signup")} />;
  return (
    <Chat
      me={me}
      groupId={groupId}
      rooms={rooms}
      timeline={timeline}
      dms={dms}
      cards={cards}
      joins={joins}
      actions={{ createRoom, joinRoom, enterRoom, sendRoom, postCard, joinCard, sendDm, logout }}
    />
  );
}
