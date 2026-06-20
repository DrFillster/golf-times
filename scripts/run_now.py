#!/usr/bin/env python3
"""
tee-times on-demand runner.

Run from anywhere: `python3 ~/tee-times/scripts/run_now.py [days]`

Outputs the Markdown digest to stdout (handy when called manually) and ALSO
saves it to ~/tee-times/output/digest-LATEST.md for posting/sharing.

If $DISCORD_WEBHOOK_URL is set, posts to Discord via webhook.
If $IMSG_TO is set, sends the digest via iMessage (uses `imsg` CLI).
Otherwise just prints to stdout.
"""

import os
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CHECK_SCRIPT = os.path.join(SCRIPT_DIR, "check_teetimes.py")
OUTPUT_DIR = os.path.expanduser("~/tee-times/output")
LATEST = os.path.join(OUTPUT_DIR, "digest-LATEST.md")


def post_discord(content: str) -> bool:
    import json
    import urllib.request

    webhook = os.environ.get("DISCORD_WEBHOOK_URL")
    if not webhook:
        return False
    # Discord webhook limit is 2000 chars. If digest is longer, truncate with a note.
    if len(content) > 1900:
        # Send header + first 1800 chars + note
        truncated = content[:1800] + "\n…(truncated, full digest in /tmp/tee-times-digest.md)"
        content = truncated
    payload = json.dumps({"content": content}).encode()
    req = urllib.request.Request(
        webhook, data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "tee-times/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return 200 <= r.status < 300
    except Exception as e:
        print(f"[discord post failed: {e}]", file=sys.stderr)
        return False


def post_imessage(content: str) -> bool:
    """Send via `imsg` CLI (macOS Messages)."""
    to = os.environ.get("IMSG_TO")
    if not to:
        return False
    # imsg expects a file or stdin — pipe the digest in
    try:
        result = subprocess.run(
            ["imsg", "send", "--to", to, "--text", content],
            capture_output=True, text=True, timeout=20,
        )
        return result.returncode == 0
    except FileNotFoundError:
        print("[imsg CLI not installed — skipping]", file=sys.stderr)
        return False
    except Exception as e:
        print(f"[imessage send failed: {e}]", file=sys.stderr)
        return False


def main() -> int:
    days = sys.argv[1] if len(sys.argv) > 1 else "3"
    result = subprocess.run(
        ["python3", CHECK_SCRIPT, days],
        capture_output=True, text=True, timeout=60,
    )
    if result.returncode != 0:
        print(f"check_teetimes.py failed:\n{result.stderr}", file=sys.stderr)
        return result.returncode

    digest = result.stdout
    # Always save the latest digest locally
    with open(LATEST, "w") as f:
        f.write(digest)
    print(f"[saved to {LATEST}]", file=sys.stderr)

    # Always print to stdout
    print(digest)

    # Try delivery channels
    sent_discord = post_discord(digest)
    sent_imessage = post_imessage(digest)
    if sent_discord:
        print("[posted to Discord]", file=sys.stderr)
    if sent_imessage:
        print("[sent via iMessage]", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())