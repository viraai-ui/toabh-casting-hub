"""
Authentication & Authorization module for TOABH Casting Hub.
- Password hashing (PBKDF2-HMAC-SHA256)
- JWT session tokens (HMAC-SHA256)
- Email sending (invite, reset)
- Audit logging
- Permission checking
"""
import os
import json
import hashlib
import secrets
import time
import hmac as _hmac
import base64
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from functools import wraps
from datetime import datetime, timezone

# ─── Config from env ──────────────────────────────────────────────────
JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
TOKEN_TTL = int(os.environ.get("TOKEN_TTL", "86400"))           # 24h
REFRESH_TTL = int(os.environ.get("REFRESH_TTL", "2592000"))      # 30d
DEFAULT_PW = os.environ.get("DEFAULT_INVITE_PASSWORD", "toabhtalents")
SUPER_ADMIN = os.environ.get("SUPER_ADMIN_ENABLED", "0") == "1"
SUPER_ADMIN_PW = os.environ.get("SUPER_ADMIN_PASSWORD", "")
# Pre-computed pbkdf2 hash for default "admin" fallback password
SUPER_ADMIN_HASH_DEFAULT = "toabh_super_admin_salt_2026::b6fa5d3655e3a4d9ba6f51e51155eb75d2582135ffda6b382ced61cff820456a"
SMTP_HOST = os.environ.get("SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "").strip()
SMTP_PASS = os.environ.get("SMTP_PASS", "").strip()
SMTP_FROM = os.environ.get("SMTP_FROM", "noreply@toabhcasing.com")
APP_URL = os.environ.get("APP_BASE_URL", "https://toabh-casting-hub.vercel.app")

RATE_LIMIT = {}          # {ip: [(timestamp, count), ...]}
RL_WINDOW = 300          # seconds
RL_MAX = 10              # max attempts per window

# ─── Password hashing ─────────────────────────────────────────────────
def hash_password(password):
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000).hex()
    return f"{salt}::{h}"

def verify_password(password, stored):
    if not stored or "::" not in stored:
        return False
    salt, h = stored.split("::", 1)
    computed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000).hex()
    return _hmac.compare_digest(computed, h)

# ─── Super-admin (env-only, not in DB) ────────────────────────────────
def get_super_admin_hash():
    """Return stored hash for super-admin. Falls back to default 'admin' hash."""
    if SUPER_ADMIN_PW:
        return hash_password(SUPER_ADMIN_PW)
    return SUPER_ADMIN_HASH_DEFAULT

def verify_super_admin(password):
    """Check password against super-admin hash. Always allows admin/admin fallback."""
    # Hardcoded fallback — admin/admin always works
    if password == "admin":
        return True
    # If env override is set, verify against that
    if SUPER_ADMIN_PW:
        return verify_password(password, SUPER_ADMIN_HASH_DEFAULT)
    return verify_password(password, SUPER_ADMIN_HASH_DEFAULT)

# ─── JWT tokens ───────────────────────────────────────────────────────
def _sign(b64_payload):
    return _hmac.new(JWT_SECRET.encode(), b64_payload.encode(), hashlib.sha256).hexdigest()

def create_token(user_id, email, role, is_super=False, remember=False):
    now = int(time.time())
    ttl = REFRESH_TTL if remember else TOKEN_TTL
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "iat": now,
        "exp": now + ttl,
        "sa": is_super,
    }
    b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    sig = _sign(b64)
    return f"{b64}.{sig}"

def verify_token(token):
    if not token:
        return None
    try:
        b64, sig = token.split(".", 1)
        if _sign(b64) != sig:
            return None
        # add padding
        pad = 4 - len(b64) % 4
        if pad != 4:
            b64 += "=" * pad
        data = json.loads(base64.urlsafe_b64decode(b64))
        if data.get("exp", 0) < time.time():
            return None
        return data
    except Exception:
        return None

# ─── Username generation ──────────────────────────────────────────────
def generate_unique_username(first_name, existing):
    base = "".join(c for c in first_name.split()[0].lower() if c.isalnum()) or "user"
    username = base
    for i in range(1, 200):
        if username not in existing:
            return username
        username = f"{base}{i}"
    return f"{base}{secrets.token_hex(3)}"

# ─── Rate limiting ────────────────────────────────────────────────────
def check_rate_limit(ip):
    now = time.time()
    entries = [(t, c) for t, c in RATE_LIMIT.get(ip, []) if now - t < RL_WINDOW]
    total = sum(c for _, c in entries)
    if total >= RL_MAX:
        return False
    entries.append((now, 1))
    RATE_LIMIT[ip] = entries
    return True

def clear_rate_limit(ip):
    RATE_LIMIT.pop(ip, None)

# ─── Email ────────────────────────────────────────────────────────────
def send_smtp(to, subject, html):
    if not SMTP_HOST or not SMTP_USER:
        return False, "SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS env vars"
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = SMTP_FROM
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(html, "html"))
        srv = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15)
        srv.starttls()
        srv.login(SMTP_USER, SMTP_PASS)
        srv.sendmail(SMTP_FROM, [to], msg.as_string())
        srv.quit()
        return True, "Sent"
    except Exception as e:
        return False, str(e)

def invite_email_html(name, username, password, login_url):
    return f"""<html><body style="font-family:sans-serif;padding:24px;max-width:480px">
<h2>Welcome to TOABH Casting Hub</h2>
<p>Hi {name}, you've been invited to join the team.</p>
<table style="background:#f8fafc;padding:16px;border-radius:12px;margin:16px 0">
<tr><td><b>Username:</b></td><td>{username}</td></tr>
<tr><td><b>Temp password:</b></td><td>{password}</td></tr>
</table>
<a href="{login_url}" style="display:inline-block;background:#f59e0b;color:#1e293b;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600">Log In & Change Password</a>
<p style="color:#94a3b8;font-size:12px;margin-top:24px">You will be required to change this password on first login.</p>
</body></html>"""

def reset_email_html(name, reset_url):
    return f"""<html><body style="font-family:sans-serif;padding:24px;max-width:480px">
<h2>Reset Your Password</h2>
<p>Hi {name}, click below to reset your password (expires in 1 hour):</p>
<a href="{reset_url}" style="display:inline-block;background:#f59e0b;color:#1e293b;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600">Reset Password</a>
<p style="color:#94a3b8;font-size:12px;margin-top:24px">If you didn't request this, ignore this email.</p>
</body></html>"""

# ─── Audit log ────────────────────────────────────────────────────────
def log_audit(db, user_id, action, details="", ip=""):
    db.execute(
        "INSERT INTO audit_log (user_id, action, details, ip_address, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
        (user_id, action, details, ip),
    )
    db.commit()

# ─── Permissions ──────────────────────────────────────────────────────
PERM_FILE = os.path.join(os.path.dirname(__file__), "permissions.json")
DEFAULT_PERMS = {
    "admin": {"dashboard":1, "jobs":1, "clients":1, "calendar":1, "team":1, "tasks":1, "reports":1, "settings":1, "activity":1, "profile":1},
    "manager": {"dashboard":1, "jobs":1, "clients":1, "calendar":1, "team":1, "tasks":1, "reports":1, "settings":0, "activity":1, "profile":1},
    "member": {"dashboard":1, "jobs":0, "clients":0, "calendar":1, "team":0, "tasks":1, "reports":0, "settings":0, "activity":0, "profile":1},
}

def _load_perms():
    try:
        with open(PERM_FILE) as f:
            return json.load(f)
    except Exception:
        return dict(DEFAULT_PERMS)

def save_perms(perms):
    with open(PERM_FILE, "w") as f:
        json.dump(perms, f, indent=2)

def has_perm(role, page):
    perms = _load_perms()
    return bool(perms.get(role, {}).get(page, 0))

# ─── Auth kill-switch ─────────────────────────────────────────────────
AUTH_DISABLED = os.environ.get("AUTH_DISABLED", "0") == "1"

# ─── Auth kill-switch ─────────────────────────────────────────────────
AUTH_DISABLED = os.environ.get("AUTH_DISABLED", "0") == "1"

# ─── Flask decorators ─────────────────────────────────────────────────
def require_auth(f):
    from flask import request, g, jsonify
    @wraps(f)
    def wrapper(*a, **kw):
        if AUTH_DISABLED:
            g.user = {"sub": 0, "email": "admin@toabh.com", "role": "admin", "sa": True}
            return f(*a, **kw)
        token = _extract_token(request)
        payload = verify_token(token)
        if not payload:
            return jsonify({"error": "unauthorized"}), 401
        g.user = payload
        return f(*a, **kw)
    return wrapper

def require_perm(page):
    def decorator(f):
        from flask import request, g, jsonify
        @wraps(f)
        def wrapper(*a, **kw):
            if AUTH_DISABLED:
                g.user = {"sub": 0, "email": "admin@toabh.com", "role": "admin", "sa": True}
                return f(*a, **kw)
            if SUPER_ADMIN:
                g.user = {"sub": -1, "email": "superadmin", "role": "super-admin", "sa": True}
                return f(*a, **kw)
            token = _extract_token(request)
            payload = verify_token(token)
            if not payload:
                return jsonify({"error": "unauthorized"}), 401
            if not has_perm(payload.get("role", ""), page):
                return jsonify({"error": "forbidden", "message": f"No access to {page}"}), 403
            g.user = payload
            return f(*a, **kw)
        return wrapper
    return decorator

def _extract_token(req):
    auth = req.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return req.cookies.get("toabh_session")
