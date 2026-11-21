"""Signed calls to the Nexconn Server API (v4, JSON body, code 0 = success).

Used by the group endpoints. The Hour 1 token view keeps its own copy of the
signing code on purpose (it is verified working and left untouched).
"""
import hashlib, os, random, time
import requests


class NexconnError(Exception):
    """Network failure, non-JSON reply, or a Nexconn code other than 0."""
    def __init__(self, detail):
        super().__init__(str(detail))
        self.detail = detail


def nexconn_post(path, data):
    nonce = str(random.randint(10**8, 10**9))
    ts = str(int(time.time() * 1000))
    sig = hashlib.sha1(
        (os.environ["NEXCONN_APP_SECRET"] + nonce + ts).encode()
    ).hexdigest()

    try:
        r = requests.post(
            os.environ["NEXCONN_API_HOST"].rstrip("/") + path,
            headers={
                "App-Key": os.environ["NEXCONN_APP_KEY"],
                "Nonce": nonce,
                "Timestamp": ts,
                "Signature": sig,
            },
            json=data,
            timeout=10,
        )
        body = r.json()
    except (requests.RequestException, ValueError) as e:
        raise NexconnError(str(e))

    if body.get("code") != 0:
        raise NexconnError(body)
    return body
