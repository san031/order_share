"""Order bot: a system user that posts summary messages into rooms via the Nexconn Server API.

Send API: POST /v4/group-channel/message/send
(docs.nexconn.ai/platform-chat-api/message/send-group). The sender doesn't have to be a
group member; the docs say the sender should have been issued an access token so push
notifications can show its name, so we issue one once per server run.
"""
import json

from .nexconn import nexconn_post

BOT_USER_ID = "orderbot"   # also reserved at sign-up so nobody can impersonate it
BOT_NAME = "Order Bot"

_registered = False


def _ensure_registered():
    global _registered
    if not _registered:
        nexconn_post("/v4/auth/access-token/issue", {"userId": BOT_USER_ID, "name": BOT_NAME})
        _registered = True


def post_to_room(group_id, text):
    """Send a plain text message from the bot into one group channel. Raises NexconnError."""
    _ensure_registered()
    return nexconn_post("/v4/group-channel/message/send", {
        "fromUserId": BOT_USER_ID,
        "toChannelIds": [group_id],
        "messageType": "RC:TxtMsg",
        "content": json.dumps({"content": text}),  # docs: content is a JSON string
        "shouldPersist": 1,                         # keep it in room history
    })


def summary_text(item, price, target, shares):
    """e.g. '✅ Target reached: Kaju katli (5/5). alice pays 900, bob pays 1350. Total 2250.'"""
    total_qty = sum(shares.values())
    parts = ", ".join(f"{u} pays {fmt(q * price)}" for u, q in shares.items())
    total_cost = sum(q * price for q in shares.values())
    return f"✅ Target reached: {item} ({total_qty}/{target}). {parts}. Total {fmt(total_cost)}."


def fmt(n):
    """Show 450.0 as 450 and 12.5 as 12.5."""
    return str(int(n)) if float(n).is_integer() else f"{n:.2f}".rstrip("0").rstrip(".")
