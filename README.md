# Order Share

Group buying inside a chat room. Friends create a room, someone posts an item with a price and a target quantity, everyone joins with how many they want, and the room shows a live tally of each person's share until the target is reached.

Built on the **Nexconn Chat SDK** (Web) and the **Nexconn Server API**, with a Django backend and a React frontend.

---

## Features

- **Accounts:** sign up and log in with a username and password. Django issues an auth token. Refreshing the page keeps you logged in for that tab.
- **Group rooms:** create a room with a unique name. Others join by typing the name (case-insensitive). The sidebar lists the rooms you created and the rooms you joined.
- **Room chat:** real-time text messages in the room. Past messages load from Nexconn when you open a room.
- **Item cards:** post an item with a name, price each and target quantity as a custom Nexconn message type.
- **Join with a quantity:** everyone picks how many they want. A join can't push the total past the target; the button shows how many are left.
- **Live tally:** each card shows total / target, a progress bar, and each person's quantity × price. When the target is met it shows **"Target reached!"** with what everyone pays.
- **Order summary:** a side panel with progress for every item in the room and your own total to pay.
- **Direct messages** between users.

---

## How it works

```
 Browser (React + Nexconn Web SDK)            Django (DRF)                 Nexconn
 ─────────────────────────────────            ────────────                 ───────
 Sign up / log in  ─────────────────────────▶ users + auth token
 Get chat token    ─────────────────────────▶ /v4/auth/access-token/issue ─▶ token
 Connect           ───────────────────────────────────────────────────────▶ (SDK)
 Create / join room ────────────────────────▶ Room + Membership rows
                                              /v4/group-channel/create|join ▶
 Messages, item cards, joins ─────────────────────────────────────────────▶ group channel
 Tally ◀── computed in each browser from the card and join messages
```

- **Django** owns accounts, room names and room membership. It signs every Nexconn Server API call (App-Key, Nonce, Timestamp, SHA-1 Signature) so the App Secret never reaches the browser.
- **Nexconn** carries and stores every message.
- **The tally** is worked out in React from two custom message types:

| Message type | Content | Meaning |
|---|---|---|
| `app:card` | `{ cardId, item, price, target }` | A new item card |
| `app:join` | `{ cardId, qty }` | A user's quantity for a card (their latest one counts) |

---

## Tech stack

| Part | Stack |
|---|---|
| Frontend | React 19, Vite, `@nexconn/chat` Web SDK |
| Backend | Python 3.12, Django 6.1, Django REST Framework (token auth), django-cors-headers |
| Database | SQLite (users, auth tokens, rooms, memberships) |
| Chat | Nexconn Chat SDK + Server API v4 |

---

## Project structure

```
backend/
  order_share/
    .env                    # Nexconn keys (not committed)
    manage.py
    order_share/settings.py
    chat/
      models.py             # User, Room, Membership
      serializers.py
      views.py              # auth, chat token, rooms
      urls.py
      nexconn.py            # signed Nexconn Server API calls
frontend/
  .env                      # VITE_NEXCONN_APP_KEY (not committed)
  src/
    App.jsx                 # state, Nexconn messaging, page switching
    api.js                  # calls to Django
    chatClient.js           # Nexconn SDK setup + custom message types
    Pages/                  # Login, Signin (sign up), Chat
    Components/             # Card (item + tally), Header, Footer (composer), Button, Input
    index.css               # Solarized Light theme
```

---

## Setup

### Prerequisites

- Python 3.12+ and Node.js 20+
- A Nexconn app: **App Key**, **App Secret**, and your region's **Server API host** (from the Nexconn Console)

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install django djangorestframework django-cors-headers python-dotenv requests
```

Create `backend/order_share/.env`:

```env
NEXCONN_APP_KEY=your_app_key
NEXCONN_APP_SECRET=your_app_secret
NEXCONN_API_HOST=https://your-nexconn-api-host
```

Create the database and start the server:

```bash
cd order_share
python manage.py migrate
python manage.py runserver        # http://localhost:8000
```

### 2. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_NEXCONN_APP_KEY=your_app_key
# Optional, defaults to http://localhost:8000/api
# VITE_API_URL=http://localhost:8000/api
```

```bash
npm run dev                       # http://localhost:5173
```

### 3. Nexconn Console (recommended)

Turn on **Enable pre-join history access by new member** (Chat → Chat settings → Group Channels), so people who join a room late can still see item cards posted before they joined.

---

## Try it (three browser tabs)

1. In three tabs, sign up as `alice`, `bob` and `carol` (passwords need 8+ characters).
2. **alice** creates a room called `Diwali Sweets`.
3. **bob** and **carol** type `diwali sweets` in **Join room**.
4. alice clicks **+ Item** and posts `Kaju katli`, price `450`, target `5`.
5. bob joins with `2`, carol with `3`. All three tabs show the tally climb to 5/5, then **Target reached!** with what each person pays.
6. Refresh a tab: you stay logged in. Open the room from **My rooms** and its history loads.

---

## API (Django)

All endpoints are under `/api/`. Everything except sign up and log in needs `Authorization: Token <token>`.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `auth/signup/` | `{ username, password }` | `201 { userId, token }` |
| POST | `auth/login/` | `{ username, password }` | `{ userId, token }` · `401` on a wrong password |
| POST | `auth/logout/` | (none) | `204`; deletes the token |
| POST | `chat-token/` | (none) | `{ userId, token }` (Nexconn access token) |
| POST | `groups/` | `{ groupName }` | `201 { groupId }` · `400` if the name is taken |
| POST | `groups/join-by-name/` | `{ name }` | `{ groupId, name }` · `404` if there's no such room |
| GET | `groups/mine/` | (none) | `[{ groupId, name, isCreator, joinedAt }]` |

Rules:
- Usernames: 3–20 lowercase letters or digits (the username is also the Nexconn user ID).
- Passwords: Django's default rules (8+ characters, not common, not all digits).
- Room names: up to 64 characters, unique ignoring case.

---

## Known limitations

- **The tally is computed in the browser.** Two people joining in the same second could push a total past its target.
- **Joining by name** only finds rooms Django knows about. Rooms created before room names were stored can't be found by name.
- **Login lasts for the browser tab** (`sessionStorage`). Closing the tab logs you out.
- **Custom message types** are registered from the SDK's TypeScript definitions (`NCEngine.registerCustomMessages`).
- **Development settings:** `DEBUG = True`, SQLite, and CORS allows only `http://localhost:5173`. Change these before deploying.

---

## Possible next steps

- An "order bot": a system user, run from Django, that posts a summary message into the room when a target is reached.
- A WhatsApp share link that invites friends to a room by name.
- Keeping the tally on the server so the target cap can't be beaten by simultaneous joins.
