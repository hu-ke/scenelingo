import os
import time
import random
import smtplib
import jwt
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta

CODE_EXPIRE_SECONDS = 300
CODE_RESEND_SECONDS = 60
JWT_SECRET = os.environ.get("JWT_SECRET", "scene-lingo-dev-secret-key-2025!")
JWT_EXPIRE_DAYS = 30

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER)

_memory_codes: dict[str, dict] = {}
_use_memory = False

def set_memory_mode():
    global _use_memory
    _use_memory = True

# ---- MongoDB-based code generation ----
async def generate_code(email: str) -> str | None:
    from db import db
    if db is None or _use_memory:
        return _generate_code_memory(email)
    
    now = time.time()
    resend_deadline = now - CODE_RESEND_SECONDS
    
    existing = await db.verification_codes.find_one({
        "email": email,
        "expires_at": {"$gt": datetime.utcnow()},
        "created_at": {"$gte": datetime.utcfromtimestamp(resend_deadline)}
    })
    if existing:
        return None
    
    code = str(random.randint(100000, 999999))
    now_dt = datetime.utcnow()
    await db.verification_codes.insert_one({
        "email": email,
        "code": code,
        "created_at": now_dt,
        "expires_at": now_dt + timedelta(seconds=CODE_EXPIRE_SECONDS),
        "used": False,
    })
    return code

def _generate_code_memory(email: str) -> str | None:
    existing = _memory_codes.get(email)
    if existing and time.time() - existing["created_at"] < CODE_RESEND_SECONDS:
        return None
    code = str(random.randint(100000, 999999))
    _memory_codes[email] = {
        "code": code,
        "created_at": time.time(),
        "expires_at": time.time() + CODE_EXPIRE_SECONDS,
    }
    return code

# ---- MongoDB-based code verification ----
async def verify_code(email: str, code: str) -> bool:
    from db import db
    if db is None or _use_memory:
        return _verify_code_memory(email, code)
    
    record = await db.verification_codes.find_one({
        "email": email,
        "code": code,
        "expires_at": {"$gt": datetime.utcnow()},
        "used": False,
    })
    if not record:
        return False
    
    await db.verification_codes.update_one(
        {"_id": record["_id"]},
        {"$set": {"used": True}}
    )
    return True

def _verify_code_memory(email: str, code: str) -> bool:
    stored = _memory_codes.get(email)
    if not stored:
        return False
    if time.time() > stored["expires_at"]:
        del _memory_codes[email]
        return False
    if stored["code"] != code:
        return False
    del _memory_codes[email]
    return True

# ---- Email sending via SMTP ----
def send_email(to_email: str, code: str) -> bool:
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        print(f"[DEV EMAIL] 验证码 [{code}] 已发送到邮箱 {to_email}")
        return False
    
    msg = MIMEMultipart()
    msg["From"] = SMTP_FROM or SMTP_USER
    msg["To"] = to_email
    msg["Subject"] = "场景英语 - 登录验证码"
    
    body = f"您的登录验证码是：{code}\n\n验证码5分钟内有效，请勿泄露给他人。\n\n—— 场景英语团队"
    msg.attach(MIMEText(body, "plain", "utf-8"))
    
    try:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(msg["From"], to_email, msg.as_string())
        server.quit()
        print(f"[SMTP] 验证码已发送到 {to_email}")
        return True
    except Exception as e:
        print(f"[SMTP] 邮件发送失败: {e}")
        return False

# ---- User management (MongoDB) ----
async def get_or_create_user(email: str) -> dict:
    from db import db
    if db is None:
        return {"email": email}
    
    user = await db.users.find_one({"email": email})
    now = datetime.utcnow()
    if user:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"last_login_at": now, "updated_at": now}}
        )
    else:
        await db.users.insert_one({
            "email": email,
            "created_at": now,
            "updated_at": now,
            "last_login_at": now,
        })
    return {"email": email}

# ---- JWT Token ----
def generate_token(email: str) -> str:
    payload = {
        "email": email,
        "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRE_DAYS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload.get("email")
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

# ---- Photo operations (MongoDB) ----
async def save_photo_record(user_email: str, photo_id: str, metadata: dict) -> bool:
    from db import db
    if db is None:
        return False
    bucket = os.environ.get("OSS_BUCKET_NAME", "scenelingo")
    endpoint = os.environ.get("OSS_ENDPOINT", "oss-cn-hangzhou.aliyuncs.com")
    base_url = f"https://{bucket}.{endpoint}"
    
    await db.photos.insert_one({
        "photo_id": photo_id,
        "user_email": user_email,
        "collection_date": metadata.get("collectionDate", ""),
        "original_url": f"{base_url}/photos/{user_email}/{photo_id}/original.jpg",
        "annotated_url": f"{base_url}/photos/{user_email}/{photo_id}/annotated.jpg",
        "objects": metadata.get("objects", []),
        "created_at": datetime.utcnow(),
    })
    return True

async def list_user_photos_mongo(user_email: str) -> list[dict]:
    from db import db
    if db is None:
        return None
    cursor = db.photos.find({"user_email": user_email}).sort("collection_date", -1)
    photos = []
    async for doc in cursor:
        photos.append({
            "id": doc["photo_id"],
            "originalUrl": doc["original_url"],
            "annotatedUrl": doc["annotated_url"],
            "objects": doc.get("objects", []),
            "collectionDate": doc["collection_date"],
            "createdAt": doc["created_at"].timestamp() if doc.get("created_at") else 0,
        })
    return photos

async def delete_photo_record(user_email: str, photo_id: str) -> bool:
    from db import db
    if db is None:
        return False
    await db.photos.delete_one({"user_email": user_email, "photo_id": photo_id})
    return True