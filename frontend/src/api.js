// Calls to the Django backend. After login every call sends "Authorization: Token <key>".
const API = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/$/, "");

let authToken = "";
export function setAuthToken(token) {
  authToken = token || "";
}

async function post(path, body) {
  const headers = { "Content-Type": "application/json" };
  if (authToken) headers.Authorization = `Token ${authToken}`;
  let r;
  try {
    r = await fetch(API + path, { method: "POST", headers, body: JSON.stringify(body ?? {}) });
  } catch {
    return { ok: false, status: 0, data: { error: "Can't reach the server. Is Django running?" } };
  }
  let data = null;
  try { data = await r.json(); } catch { /* empty body, e.g. 204 */ }
  return { ok: r.ok, status: r.status, data };
}

async function get(path) {
  const headers = authToken ? { Authorization: `Token ${authToken}` } : {};
  try {
    const r = await fetch(API + path, { headers });
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => null) };
  } catch {
    return { ok: false, status: 0, data: { error: "Can't reach the server. Is Django running?" } };
  }
}
export const myGroups = () => get("/groups/mine/");


// Turn a DRF error body ({error}, {detail} or {field: [messages]}) into one readable line
export function errorText(res, fallback = "Something went wrong") {
  const d = res.data;
  if (!d) return `${fallback} (${res.status})`;
  if (typeof d.error === "string") return d.error;
  if (typeof d.detail === "string") return d.detail;
  const parts = Object.values(d).flat().filter((x) => typeof x === "string");
  return parts.length ? parts.join(" ") : `${fallback} (${res.status})`;
}

export const signup = (username, password) => post("/auth/signup/", { username, password });
export const login = (username, password) => post("/auth/login/", { username, password });
export const logout = () => post("/auth/logout/");
export const getChatToken = () => post("/chat-token/");
export const createGroup = (groupName) => post("/groups/", { groupName });
// Ask Django's order bot to post the "target reached" summary into the room (once per card)
export const targetReached = (groupId, payload) =>
  post(`/groups/${encodeURIComponent(groupId)}/target-reached/`, payload);
export const joinGroupByName = (name) => post("/groups/join-by-name/", { name });
export const joinGroup = (groupId) => post(`/groups/${encodeURIComponent(groupId)}/join/`);
