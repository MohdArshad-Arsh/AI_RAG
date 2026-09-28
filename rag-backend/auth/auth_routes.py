from fastapi import HTTPException, APIRouter, Depends, BackgroundTasks, Header
from passlib.context import CryptContext
from auth.jwt_handler import create_access_token, create_refresh_token, verify_token
from auth.dependencies import get_current_user, require_role
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from typing import Literal
import re, random, time, smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from db import get_connection
from config import MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM, MAIL_SERVER, MAIL_PORT, ADMIN_CREATE_KEY

router = APIRouter(tags=["Auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── In-memory OTP store: email -> {otp, expires_at, data} ────
_otp_store: dict = {}
OTP_TTL = 600  # 10 minutes

# ── Password strength ─────────────────────────────────────────
_PASS_RE = re.compile(r'^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$')

def _check_password(v: str) -> str:
    if not _PASS_RE.match(v):
        raise ValueError(
            "Password must be at least 8 characters and include "
            "an uppercase letter, a number, and a special character."
        )
    return v

# ── Email sender ──────────────────────────────────────────────
def _send_otp_email(to_email: str, otp: str, username: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your RAG AI Verification Code"
    msg["From"]    = MAIL_FROM
    msg["To"]      = to_email

    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;
                background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb">
      <h2 style="margin:0 0 8px;color:#111827">Verify your email</h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px">
        Hi <strong>{username}</strong>, use the code below to complete your sign-up.
        It expires in <strong>10 minutes</strong>.
      </p>
      <div style="letter-spacing:10px;font-size:36px;font-weight:700;
                  color:#2563eb;text-align:center;padding:20px;
                  background:#eff6ff;border-radius:8px;margin-bottom:24px">
        {otp}
      </div>
      <p style="color:#9ca3af;font-size:12px;margin:0">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    """
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(MAIL_SERVER, MAIL_PORT) as s:
        s.starttls()
        s.login(MAIL_USERNAME, MAIL_PASSWORD)
        s.sendmail(MAIL_FROM, to_email, msg.as_string())

# ── Models ────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str

class SignupOTPRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    confirm_password: str
    role: Literal["user", "admin"] = "user"

    @field_validator("username")
    @classmethod
    def normalize_username(cls, v: str) -> str:
        v = v.strip().lower()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters.")
        if not re.match(r'^[a-z0-9_.\-]+$', v):
            raise ValueError("Username may only contain letters, numbers, _ . -")
        return v

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        return _check_password(v)

    @model_validator(mode="after")
    def passwords_match(self) -> "SignupOTPRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self

class VerifySignupOTPRequest(BaseModel):
    email: EmailStr
    otp: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

# ── SIGNUP: Step 1 — validate + send OTP ─────────────────────
@router.post("/signup/send-otp")
def signup_send_otp(
    req: SignupOTPRequest,
    bg: BackgroundTasks,
    x_admin_create_key: str | None = Header(default=None, alias="X-Admin-Create-Key")
):
    role = req.role or "user"
    if role == "admin":
        if not ADMIN_CREATE_KEY:
            raise HTTPException(status_code=403, detail="Admin creation is not configured.")
        if x_admin_create_key != ADMIN_CREATE_KEY:
            raise HTTPException(status_code=403, detail="Invalid admin creation key.")

    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id FROM users WHERE username=%s", (req.username,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Username already taken.")
        cursor.execute("SELECT id FROM users WHERE email=%s", (req.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="An account with this email already exists.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try: cursor.close(); conn.close()
        except: pass

    otp = str(random.randint(100000, 999999))
    _otp_store[req.email] = {
        "otp": otp,
        "expires_at": time.time() + OTP_TTL,
        "username": req.username,
        "password": pwd_context.hash(req.password),
        "role": role,
    }

    try:
        bg.add_task(_send_otp_email, req.email, otp, req.username)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send OTP email: {e}")

    return {"message": f"OTP sent to {req.email}. Valid for 10 minutes."}

# ── SIGNUP: Step 2 — verify OTP + create account ─────────────
@router.post("/signup/verify-otp")
def signup_verify_otp(req: VerifySignupOTPRequest):
    email = req.email.strip().lower()
    entry = _otp_store.get(email)

    if not entry:
        raise HTTPException(status_code=400, detail="No OTP found for this email. Please request a new one.")
    if time.time() > entry["expires_at"]:
        _otp_store.pop(email, None)
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")
    if entry["otp"] != req.otp.strip():
        raise HTTPException(status_code=400, detail="Invalid OTP.")

    # OTP valid — create the user
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        # Double-check uniqueness (race condition guard)
        cursor.execute("SELECT id FROM users WHERE username=%s OR email=%s", (entry["username"], email))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Username or email already registered.")

        cursor.execute(
            "INSERT INTO users (username, email, password, role) VALUES (%s, %s, %s, %s)",
            (entry["username"], email, entry["password"], entry.get("role", "user"))
        )
        conn.commit()
        cursor.execute("SELECT id, username, email, role FROM users WHERE email=%s", (email,))
        user = cursor.fetchone()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try: cursor.close(); conn.close()
        except: pass

    _otp_store.pop(email, None)

    access_token  = create_access_token({"sub": user["username"], "role": user["role"], "user_id": user["id"]})
    refresh_token = create_refresh_token({"sub": user["username"], "role": user["role"], "user_id": user["id"]})
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {"id": user["id"], "username": user["username"], "email": user["email"], "role": user["role"]},
    }

def _verify_password(plain_password: str, stored_password: str) -> bool:
    try:
        # Legacy support: if the stored password is not a recognized hash,
        # compare directly and upgrade it after successful login.
        if pwd_context.identify(stored_password) is None:
            return plain_password == stored_password
        return pwd_context.verify(plain_password, stored_password)
    except Exception:
        return False

# ── LOGIN ─────────────────────────────────────────────────────
@router.post("/login")
def login(req: LoginRequest):
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE username=%s", (req.username,))
        user = cursor.fetchone()
        if not user or not _verify_password(req.password, user["password"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        if pwd_context.identify(user["password"]) is None:
            hashed = pwd_context.hash(req.password)
            cursor.execute("UPDATE users SET password=%s WHERE id=%s", (hashed, user["id"]))
            conn.commit()

        access_token  = create_access_token({"sub": user["username"], "role": user["role"], "user_id": user["id"]})
        refresh_token = create_refresh_token({"sub": user["username"], "role": user["role"], "user_id": user["id"]})
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {"id": user["id"], "username": user["username"], "role": user["role"]}
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try: cursor.close(); conn.close()
        except: pass

# ── REFRESH ───────────────────────────────────────────────────
@router.post("/refresh")
def refresh(req: RefreshTokenRequest):
    payload = verify_token(req.refresh_token, token_type="refresh")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    access_token  = create_access_token({"sub": payload.get("sub"), "role": payload.get("role"), "user_id": payload.get("user_id")})
    refresh_token = create_refresh_token({"sub": payload.get("sub"), "role": payload.get("role"), "user_id": payload.get("user_id")})
    return {"access_token": access_token, "refresh_token": refresh_token}

# ── ME / LOGOUT ───────────────────────────────────────────────
@router.get("/me")
def me(user=Depends(get_current_user)):
    return {"id": user.get("user_id"), "username": user.get("sub"), "role": user.get("role")}

@router.post("/logout")
def logout(user=Depends(get_current_user)):
    return {"message": "Logged out"}

# ── ADMIN USER MANAGEMENT ─────────────────────────────────────
@router.get("/users")
def list_users(admin_user=Depends(require_role("admin"))):
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, username, role, created_at FROM users ORDER BY created_at DESC")
        return {"users": cursor.fetchall()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try: cursor.close(); conn.close()
        except: pass

@router.delete("/users/{user_id}")
def delete_user(user_id: int, admin_user=Depends(require_role("admin"))):
    if admin_user.get("user_id") == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE id=%s", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found")
        cursor.execute("DELETE FROM users WHERE id=%s", (user_id,))
        conn.commit()
        return {"message": "User deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try: cursor.close(); conn.close()
        except: pass

def _mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if len(local) <= 2:
        masked_local = local[:1] + "*"
    else:
        masked_local = local[:2] + "*" * max(1, len(local) - 2)
    return f"{masked_local}@{domain}"

def _find_reset_user(cursor, username: str | None = None, email: str | None = None):
    if username:
        cursor.execute(
            "SELECT id, username, email FROM users WHERE username=%s",
            (username.strip().lower(),)
        )
    else:
        cursor.execute(
            "SELECT id, username, email FROM users WHERE email=%s",
            (email.strip().lower(),)
        )
    return cursor.fetchone()

class ForgotPasswordRequest(BaseModel):
    username: str | None = None
    email: EmailStr | None = None

    @model_validator(mode="after")
    def has_identifier(self) -> "ForgotPasswordRequest":
        if not self.username and not self.email:
            raise ValueError("Enter your username to reset your password.")
        return self

class ForgotPasswordOTPVerifyRequest(BaseModel):
    username: str | None = None
    email: EmailStr | None = None
    otp: str

    @model_validator(mode="after")
    def has_identifier(self) -> "ForgotPasswordOTPVerifyRequest":
        if not self.username and not self.email:
            raise ValueError("Enter your username to reset your password.")
        return self

class ForgotPasswordResetRequest(BaseModel):
    username: str | None = None
    email: EmailStr | None = None
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        return _check_password(v)

    @model_validator(mode="after")
    def passwords_match(self) -> "ForgotPasswordResetRequest":
        if not self.username and not self.email:
            raise ValueError("Enter your username to reset your password.")
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self

class ForgotPasswordVerifyRequest(ForgotPasswordResetRequest):
    otp: str

def _get_reset_email(req):
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        user = _find_reset_user(cursor, req.username, str(req.email) if req.email else None)
        if not user or not user.get("email"):
            raise HTTPException(status_code=404, detail="No account found for this username.")
        return user["email"].strip().lower()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try: cursor.close(); conn.close()
        except: pass

def _require_valid_reset_entry(email: str, otp: str | None = None, require_verified: bool = False):
    entry = _otp_store.get(email)
    if not entry or not entry.get("reset"):
        raise HTTPException(status_code=400, detail="No password reset OTP found for this email. Please request a new one.")
    if time.time() > entry["expires_at"]:
        _otp_store.pop(email, None)
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")
    if otp is not None and entry["otp"] != otp.strip():
        raise HTTPException(status_code=400, detail="Invalid OTP.")
    if require_verified and not entry.get("verified"):
        raise HTTPException(status_code=400, detail="Please verify the OTP before changing your password.")
    return entry

# ── FORGOT PASSWORD: Step 1 — request OTP ─────────────
@router.post("/forgot-password/request")
def forgot_password_request(req: ForgotPasswordRequest, bg: BackgroundTasks):
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        user = _find_reset_user(cursor, req.username, str(req.email) if req.email else None)
        if not user:
            raise HTTPException(status_code=404, detail="No account found for this username.")
        if not user.get("email"):
            raise HTTPException(status_code=400, detail="No email is saved for this account.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try: cursor.close(); conn.close()
        except: pass

    email = user["email"].strip().lower()
    otp = str(random.randint(100000, 999999))
    _otp_store[email] = {
        "otp": otp,
        "expires_at": time.time() + OTP_TTL,
        "username": user["username"],
        "reset": True,
        "verified": False,
    }
    try:
        bg.add_task(_send_otp_email, email, otp, user["username"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send OTP email: {e}")
    return {
        "message": f"OTP sent to {_mask_email(email)}. Valid for 10 minutes.",
        "masked_email": _mask_email(email),
    }

# ── FORGOT PASSWORD: Step 2 — verify OTP & reset ───────
@router.post("/forgot-password/verify-otp")
def forgot_password_verify_otp(req: ForgotPasswordOTPVerifyRequest):
    email = _get_reset_email(req)
    entry = _require_valid_reset_entry(email, req.otp)
    entry["verified"] = True
    return {"message": "OTP verified. You can now change your password."}

@router.post("/forgot-password/reset")
def forgot_password_reset(req: ForgotPasswordResetRequest):
    email = _get_reset_email(req)
    _require_valid_reset_entry(email, require_verified=True)

    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET password=%s WHERE email=%s", (pwd_context.hash(req.new_password), email))
        conn.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try: cursor.close(); conn.close()
        except: pass
    _otp_store.pop(email, None)
    return {"message": "Password changed successfully. Please log in with your new password."}

@router.post("/forgot-password/verify")
def forgot_password_verify(req: ForgotPasswordVerifyRequest):
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        user = _find_reset_user(cursor, req.username, str(req.email) if req.email else None)
        if not user or not user.get("email"):
            raise HTTPException(status_code=404, detail="No account found for this username.")
        email = user["email"].strip().lower()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try: cursor.close(); conn.close()
        except: pass

    entry = _otp_store.get(email)
    if not entry or not entry.get("reset"):
        raise HTTPException(status_code=400, detail="No password reset OTP found for this email. Please request a new one.")
    if time.time() > entry["expires_at"]:
        _otp_store.pop(email, None)
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")
    if entry["otp"] != req.otp.strip():
        raise HTTPException(status_code=400, detail="Invalid OTP.")

    # OTP valid — update the user's password
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET password=%s WHERE email=%s", (pwd_context.hash(req.new_password), email))
        conn.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try: cursor.close(); conn.close()
        except: pass
    _otp_store.pop(email, None)
    return {"message": "Password reset successful. You can now log in with your new password."}
