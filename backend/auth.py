import os
import time
import random
import smtplib
import jwt
import uuid
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone
from loguru import logger

# 中国时区 (UTC+8)
CHINA_TZ = timezone(timedelta(hours=8))

def china_now_str() -> str:
    """返回中国时区的当前时间，格式 yyyy-mm-dd hh:mm:ss"""
    return datetime.now(CHINA_TZ).strftime('%Y-%m-%d %H:%M:%S')

def china_now() -> datetime:
    """返回中国时区的当前 datetime"""
    return datetime.now(CHINA_TZ)
from bson import ObjectId
from fastapi import HTTPException

CODE_EXPIRE_SECONDS = 300
CODE_RESEND_SECONDS = 60
JWT_SECRET = os.environ.get("JWT_SECRET", "scene-lingo-dev-secret-key-2025!")
JWT_EXPIRE_DAYS = 30
WECHAT_APPID = os.environ.get("WECHAT_APPID", "")
WECHAT_SECRET = os.environ.get("WECHAT_SECRET", "")

DEFAULT_RECOGNITION_QUOTA = 10
SHARE_REWARD_QUOTA = 10

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
        logger.info(f"[DEV EMAIL] 验证码 [{code}] 已发送到邮箱 {to_email}")
        return False
    
    msg = MIMEMultipart()
    msg["From"] = SMTP_FROM or SMTP_USER
    msg["To"] = to_email
    msg["Subject"] = "场景外语 - 登录验证码"
    
    body = f"您的登录验证码是：{code}\n\n验证码5分钟内有效，请勿泄露给他人。\n\n—— Scene Lingo"
    msg.attach(MIMEText(body, "plain", "utf-8"))
    
    try:
        if SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT)
        else:
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
            server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(msg["From"], to_email, msg.as_string())
        server.quit()
        logger.info(f"[SMTP] 验证码已发送到 {to_email}")
        return True
    except Exception as e:
        logger.error(f"[SMTP] 邮件发送失败: {e}")
        return False

# ---- User management (MongoDB) ----
async def get_or_create_user(email: str) -> dict:
    from db import db
    if db is None:
        return {"user_id": "", "email": email, "nativeLang": "zh", "targetLang": "en"}

    user = await db.users.find_one({"email": email})
    now = datetime.utcnow()
    if user:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"last_login_at": now, "updated_at": now}}
        )
        native_lang = user.get("native_lang", "zh")
        target_lang = user.get("target_lang", "en")
        theme = user.get("theme", "warm-orange")
    else:
        native_lang = "zh"
        target_lang = "en"
        theme = "warm-orange"
        result = await db.users.insert_one({
            "email": email,
            "native_lang": native_lang,
            "target_lang": target_lang,
            "theme": theme,
            "recognition_quota": DEFAULT_RECOGNITION_QUOTA,
            "created_at": now,
            "updated_at": now,
            "last_login_at": now,
        })
        user = {"_id": result.inserted_id}
        logger.info(f"[get_or_create_user] 新建用户 {email}, native_lang={native_lang}, target_lang={target_lang}, theme={theme}")

    return {"user_id": str(user["_id"]), "email": email, "nativeLang": native_lang, "targetLang": target_lang, "theme": theme}

async def get_or_create_user_by_openid(openid: str) -> dict:
    from db import db
    if db is None:
        logger.warning("[get_or_create_user_by_openid] db 为 None")
        return {"user_id": "", "email": "", "nativeLang": "zh", "targetLang": "en", "theme": "warm-orange"}

    try:
        user = await db.users.find_one({"openid": openid})
        now = datetime.utcnow()
        if user:
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"last_login_at": now, "updated_at": now}}
            )
            user_id = str(user["_id"])
            native_lang = user.get("native_lang", "zh")
            target_lang = user.get("target_lang", "en")
            theme = user.get("theme", "warm-orange")
            logger.info(f"[get_or_create_user_by_openid] 已有用户 openid={openid} user_id={user_id}")
        else:
            native_lang = "zh"
            target_lang = "en"
            theme = "warm-orange"
            result = await db.users.insert_one({
                "openid": openid,
                "native_lang": native_lang,
                "target_lang": target_lang,
                "theme": theme,
                "recognition_quota": DEFAULT_RECOGNITION_QUOTA,
                "created_at": now,
                "updated_at": now,
                "last_login_at": now,
            })
            user_id = str(result.inserted_id)
            logger.info(f"[get_or_create_user_by_openid] 新建用户 openid={openid} user_id={user_id}")

        return {"user_id": user_id, "email": "", "nativeLang": native_lang, "targetLang": target_lang, "theme": theme}
    except Exception as e:
        logger.error(f"[get_or_create_user_by_openid] 操作失败 openid={openid}: {e}")
        raise

async def wechat_login(code: str, email: str = "") -> dict | None:
    import urllib.request
    import json as json_mod
    
    if not WECHAT_APPID or not WECHAT_SECRET:
        logger.error("[wechat_login] WECHAT_APPID 或 WECHAT_SECRET 未配置")
        return None
    
    url = f"https://api.weixin.qq.com/sns/jscode2session?appid={WECHAT_APPID}&secret={WECHAT_SECRET}&js_code={code}&grant_type=authorization_code"
    
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json_mod.loads(resp.read().decode("utf-8"))
    except Exception as e:
        logger.error(f"[wechat_login] 微信 code2Session 请求失败: {e}")
        return None
    
    openid = data.get("openid")
    if not openid:
        logger.error(f"[wechat_login] 微信返回错误: {data}")
        return None
    
    logger.info(f"[wechat_login] 获取到 openid={openid}")
    
    try:
        # 如果客户端传了旧邮箱，尝试绑定到已有账号
        from db import db
        if email and db is not None:
            existing_user = await db.users.find_one({"email": email})
            if existing_user:
                # 已有邮箱用户，将 openid 绑定到该用户
                user_id = str(existing_user["_id"])
                await db.users.update_one(
                    {"_id": existing_user["_id"]},
                    {"$set": {"openid": openid, "updated_at": datetime.utcnow(), "last_login_at": datetime.utcnow()}}
                )
                native_lang = existing_user.get("native_lang", "zh")
                target_lang = existing_user.get("target_lang", "en")
                theme = existing_user.get("theme", "warm-orange")
                logger.info(f"[wechat_login] 已将 openid={openid} 绑定到已有邮箱用户 {email} user_id={user_id}")
                token = generate_token(user_id)
                return {
                    "token": token,
                    "user_id": user_id,
                    "email": email,
                    "nativeLang": native_lang,
                    "targetLang": target_lang,
                    "theme": theme,
                }
        
        user_info = await get_or_create_user_by_openid(openid)
        token = generate_token(user_info["user_id"])
        
        return {
            "token": token,
            **user_info,
        }
    except Exception as e:
        logger.error(f"[wechat_login] 登录处理异常 openid={openid}: {e}")
        raise HTTPException(status_code=500, detail="登录处理失败，请稍后重试")

async def update_user_language(user_id: str, nativeLang: str, targetLang: str) -> bool:
    from db import db
    if db is None:
        logger.warning("[update_user_language] db 为 None, 无法更新语言偏好")
        return False

    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"native_lang": nativeLang, "target_lang": targetLang, "updated_at": datetime.utcnow()}}
    )
    if result.matched_count > 0:
        logger.info(f"[update_user_language] 用户 {user_id} 语言偏好已更新: native_lang={nativeLang}, target_lang={targetLang}")
    else:
        logger.warning(f"[update_user_language] 未找到用户 {user_id}")
    return result.matched_count > 0

async def update_user_theme(user_id: str, themeId: str) -> bool:
    from db import db
    if db is None:
        logger.warning("[update_user_theme] db 为 None, 无法更新主题")
        return False

    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"theme": themeId, "updated_at": datetime.utcnow()}}
    )
    if result.matched_count > 0:
        logger.info(f"[update_user_theme] 用户 {user_id} 主题已更新: theme={themeId}")
    else:
        logger.warning(f"[update_user_theme] 未找到用户 {user_id}")
    return result.matched_count > 0

async def get_user_language(user_id: str) -> dict:
    """获取用户的语言偏好设置。如果用户不存在或未设置，返回默认值。"""
    from db import db
    default_prefs = {"nativeLang": "zh", "targetLang": "en"}
    
    if db is None:
        logger.warning("[get_user_language] db 为 None, 返回默认语言偏好")
        return default_prefs

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user:
        native_lang = user.get("native_lang", "zh")
        target_lang = user.get("target_lang", "en")
        logger.info(f"[get_user_language] 用户 {user_id} 语言偏好: native_lang={native_lang}, target_lang={target_lang}")
        return {"nativeLang": native_lang, "targetLang": target_lang}
    else:
        logger.warning(f"[get_user_language] 未找到用户 {user_id}, 返回默认语言偏好")
        return default_prefs

async def get_user_id_by_email(email: str) -> str | None:
    """通过 email 查找用户的 _id"""
    from db import db
    if db is None:
        logger.warning("[get_user_id_by_email] db 为 None")
        return None
    
    user = await db.users.find_one({"email": email})
    if user:
        return str(user["_id"])
    logger.warning(f"[get_user_id_by_email] 未找到用户 {email}")
    return None

# ---- Wordbook operations (MongoDB) ----
async def get_user_wordbook(user_id: str) -> list[str]:
    from db import db
    if db is None:
        return []
    doc = await db.wordbooks.find_one({"user_id": user_id})
    if doc:
        return doc.get("words", [])
    return []

async def sync_user_wordbook(user_id: str, words: list[str]) -> bool:
    from db import db
    if db is None:
        logger.warning("[sync_user_wordbook] db 为 None")
        return False
    normalized = [w.lower() for w in words]
    await db.wordbooks.update_one(
        {"user_id": user_id},
        {"$set": {"words": normalized, "updated_at": datetime.utcnow()}},
        upsert=True,
    )
    logger.info(f"[sync_user_wordbook] 用户 {user_id} 生词本已同步, {len(normalized)} 个单词")
    return True

async def add_wordbook_word(user_id: str, word: str) -> bool:
    from db import db
    if db is None:
        logger.warning("[add_wordbook_word] db 为 None")
        return False
    normalized = word.lower()
    await db.wordbooks.update_one(
        {"user_id": user_id},
        {"$addToSet": {"words": normalized}, "$set": {"updated_at": datetime.utcnow()}},
        upsert=True,
    )
    logger.info(f"[add_wordbook_word] 用户 {user_id} 添加生词: {normalized}")
    return True

async def remove_wordbook_word(user_id: str, word: str) -> bool:
    from db import db
    if db is None:
        logger.warning("[remove_wordbook_word] db 为 None")
        return False
    normalized = word.lower()
    await db.wordbooks.update_one(
        {"user_id": user_id},
        {"$pull": {"words": normalized}, "$set": {"updated_at": datetime.utcnow()}},
    )
    logger.info(f"[remove_wordbook_word] 用户 {user_id} 移除生词: {normalized}")
    return True

# ---- JWT Token ----
def generate_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRE_DAYS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload.get("user_id")
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

# ---- Photo operations (MongoDB) ----
async def save_photo_record(user_id: str, photo_id: str, metadata: dict) -> bool:
    from db import db
    if db is None:
        logger.warning("[save_photo_record] db 为 None, 无法保存")
        return False
    bucket = os.environ.get("OSS_BUCKET_NAME", "scenelingo")
    endpoint = os.environ.get("OSS_ENDPOINT", "oss-cn-hangzhou.aliyuncs.com")
    base_url = f"https://{bucket}.{endpoint}"
    
    await db.photos.insert_one({
        "photo_id": photo_id,
        "user_id": user_id,
        "collection_date": metadata.get("collectionDate", ""),
        "original_url": f"{base_url}/photos/{user_id}/{photo_id}/original.jpg",
        "annotated_url": f"{base_url}/photos/{user_id}/{photo_id}/annotated.jpg",
        "objects": metadata.get("objects", []),
        "actions": metadata.get("actions", []),
        "created_at": datetime.utcnow(),
    })
    logger.info(f"[save_photo_record] 照片已保存 user_id={user_id} photo_id={photo_id}")
    return True

async def save_pending_photo_record(user_id: str, photo_id: str) -> bool:
    from db import db
    if db is None:
        logger.warning("[save_pending_photo_record] db 为 None, 无法保存")
        return False
    bucket = os.environ.get("OSS_BUCKET_NAME", "scenelingo")
    endpoint = os.environ.get("OSS_ENDPOINT", "oss-cn-hangzhou.aliyuncs.com")
    base_url = f"https://{bucket}.{endpoint}"

    await db.photos.insert_one({
        "photo_id": photo_id,
        "user_id": user_id,
        "collection_date": china_now_str(),
        "original_url": f"{base_url}/photos/{user_id}/{photo_id}/original.jpg",
        "annotated_url": "",
        "objects": [],
        "status": "pending",
        "created_at": datetime.utcnow(),
    })
    logger.info(f"[save_pending_photo_record] 待处理照片已保存 user_id={user_id} photo_id={photo_id}")
    return True

async def claim_pending_photo() -> dict | None:
    from db import db
    if db is None:
        # logger.warning("[claim_pending_photo] db 为 None")
        return None

    doc = await db.photos.find_one_and_update(
        {"status": "pending"},
        {"$set": {"status": "processing"}},
        sort=[("created_at", 1)],
    )
    if doc:
        logger.info(f"[claim_pending_photo] 认领照片 photo_id={doc.get('photo_id')} user_id={doc.get('user_id')}")
        return doc
    # logger.info("[claim_pending_photo] 无待处理照片")
    return None

async def complete_photo(photo_id: str, objects: list, actions: list = None) -> bool:
    from db import db
    if db is None:
        logger.warning("[complete_photo] db 为 None")
        return False

    update_fields = {"status": "completed", "objects": objects}
    if actions is not None:
        update_fields["actions"] = actions

    result = await db.photos.update_one(
        {"photo_id": photo_id},
        {"$set": update_fields},
    )
    if result.matched_count > 0:
        logger.info(f"[complete_photo] 照片处理完成 photo_id={photo_id}")
    else:
        logger.warning(f"[complete_photo] 未找到照片 photo_id={photo_id}")
    return result.matched_count > 0

async def set_annotated_url(photo_id: str, annotated_url: str) -> bool:
    from db import db
    if db is None:
        logger.warning("[set_annotated_url] db 为 None")
        return False

    result = await db.photos.update_one(
        {"photo_id": photo_id},
        {"$set": {"annotated_url": annotated_url}},
    )
    if result.matched_count > 0:
        logger.info(f"[set_annotated_url] 标注图已更新 photo_id={photo_id}")
    return result.matched_count > 0

async def reset_photo_to_pending(photo_id: str) -> bool:
    from db import db
    if db is None:
        logger.warning("[reset_photo_to_pending] db 为 None")
        return False

    result = await db.photos.update_one(
        {"photo_id": photo_id},
        {"$set": {"status": "pending"}},
    )
    if result.matched_count > 0:
        logger.info(f"[reset_photo_to_pending] 照片重置为待处理 photo_id={photo_id}")
    else:
        logger.warning(f"[reset_photo_to_pending] 未找到照片 photo_id={photo_id}")
    return result.matched_count > 0

async def list_user_photos_mongo(user_id: str, start_date: str = None, end_date: str = None, words: list[str] = None) -> dict:
    from db import db
    if db is None:
        logger.warning("[list_user_photos_mongo] db 为 None, 无法查询 MongoDB")
        return None
    logger.info(f"[list_user_photos_mongo] 查询 user_id={user_id}, start_date={start_date}, end_date={end_date}, words={words}")
    
    query = {"user_id": user_id}
    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        query["collection_date"] = date_filter
    if words:
        # 只返回 objects.name 在指定单词列表中的照片
        query["objects.name"] = {"$in": [w.lower() for w in words]}
    
    cursor = db.photos.find(query).sort("collection_date", -1)
    photos = []
    async for doc in cursor:
        photos.append({
            "id": doc["photo_id"],
            "originalUrl": doc["original_url"],
            "annotatedUrl": doc["annotated_url"],
            "objects": doc.get("objects", []),
            "actions": doc.get("actions", []),
            "collectionDate": doc["collection_date"],
            "createdAt": doc["created_at"].timestamp() if doc.get("created_at") else 0,
            "status": doc.get("status", "completed"),
        })
    logger.info(f"[list_user_photos_mongo] 找到 {len(photos)} 张照片 user_id={user_id}")

    if len(photos) == 0:
        total = await db.photos.count_documents({})
        logger.warning(f"[list_user_photos_mongo] 查询为空! photos 集合总数={total}")
        if total > 0:
            sample = await db.photos.find_one()
            logger.warning(f"[list_user_photos_mongo] 样例文档 user_id={sample.get('user_id')} photo_id={sample.get('photo_id')}")

    # 查询该用户最早的照片日期（用于前端判断是否还有更多）
    oldest_doc = await db.photos.find_one(
        {"user_id": user_id},
        sort=[("collection_date", 1)],
        projection={"collection_date": 1}
    )
    oldest_date = oldest_doc.get("collection_date") if oldest_doc else None

    return {"photos": photos, "oldest_date": oldest_date}


async def get_user_stats(user_id: str) -> dict:
    """获取用户照片总统计（不受日期过滤影响）"""
    from db import db
    if db is None:
        return {"total_count": 0, "total_days": 0, "oldest_date": None, "all_words": []}

    user_query = {"user_id": user_id}
    total_count = await db.photos.count_documents(user_query)
    distinct_dates = await db.photos.distinct("collection_date", user_query)
    total_days = len(distinct_dates)

    oldest_doc = await db.photos.find_one(
        user_query,
        sort=[("collection_date", 1)],
        projection={"collection_date": 1}
    )
    oldest_date = oldest_doc.get("collection_date") if oldest_doc else None

    all_words = await db.photos.distinct("objects.name", user_query)

    return {
        "total_count": total_count,
        "total_days": total_days,
        "oldest_date": oldest_date,
        "all_words": all_words,
    }

async def delete_photo_record(user_id: str, photo_id: str) -> bool:
    from db import db
    if db is None:
        return False
    await db.photos.delete_one({"user_id": user_id, "photo_id": photo_id})
    return True


async def get_user_quota(user_id: str) -> int:
    """查询用户剩余识图配额，默认返回 10"""
    from db import db
    if db is None:
        return 10
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user:
        return user.get("recognition_quota", 10)
    return 10


async def decrement_user_quota(user_id: str) -> bool:
    """原子扣减配额，仅当 quota > 0 时扣减。返回是否成功扣减。"""
    from db import db
    if db is None:
        return True
    result = await db.users.update_one(
        {"_id": ObjectId(user_id), "recognition_quota": {"$gt": 0}},
        {"$inc": {"recognition_quota": -1}}
    )
    return result.modified_count > 0


async def add_user_quota(user_id: str, amount: int) -> bool:
    """增加用户配额"""
    from db import db
    if db is None:
        return True
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {"recognition_quota": amount}}
    )
    return result.matched_count > 0


async def record_share_invite(inviter_id: str, new_user_id: str) -> bool:
    """记录邀请关系，返回 True 表示新记录，False 表示已存在"""
    from db import db
    if db is None:
        return True
    existing = await db.share_invites.find_one({
        "inviter_id": inviter_id,
        "new_user_id": new_user_id,
    })
    if existing:
        return False
    await db.share_invites.insert_one({
        "inviter_id": inviter_id,
        "new_user_id": new_user_id,
        "created_at": datetime.utcnow(),
    })
    return True


# ---- Favorites operations (MongoDB) ----
async def _collect_descendant_folder_ids(user_id: str, parent_id: str) -> list[str]:
    """Recursively collect all descendant folder_ids for a given parent_id."""
    from db import db
    if db is None:
        return []

    direct_children = await db.favorite_folders.find(
        {"user_id": user_id, "parent_id": parent_id}
    ).to_list(length=None)

    all_ids = []
    for child in direct_children:
        child_id = child["folder_id"]
        all_ids.append(child_id)
        descendants = await _collect_descendant_folder_ids(user_id, child_id)
        all_ids.extend(descendants)

    return all_ids


async def create_favorite_folder(user_id: str, name: str, parent_id: str = None) -> dict | None:
    from db import db
    if db is None:
        logger.warning("[create_favorite_folder] db 为 None")
        return None

    folder_id = uuid.uuid4().hex[:16]
    now = datetime.utcnow()
    await db.favorite_folders.insert_one({
        "folder_id": folder_id,
        "user_id": user_id,
        "name": name,
        "parent_id": parent_id,
        "sort_order": 0,
        "created_at": now,
        "updated_at": now,
    })
    logger.info(f"[create_favorite_folder] 文件夹已创建 folder_id={folder_id} name={name} user_id={user_id}")
    return {"folder_id": folder_id, "name": name, "parent_id": parent_id, "created_at": now}


async def list_favorite_folders(user_id: str, parent_id: str = None) -> list:
    from db import db
    if db is None:
        logger.warning("[list_favorite_folders] db 为 None")
        return []

    query = {"user_id": user_id, "parent_id": parent_id}
    cursor = db.favorite_folders.find(query).sort([
        ("sort_order", 1),
        ("created_at", 1),
    ])
    folders = []
    async for doc in cursor:
        folders.append({
            "folder_id": doc["folder_id"],
            "name": doc["name"],
            "parent_id": doc.get("parent_id"),
            "created_at": doc["created_at"],
            "updated_at": doc["updated_at"],
        })
    logger.info(f"[list_favorite_folders] 找到 {len(folders)} 个文件夹 user_id={user_id} parent_id={parent_id}")
    return folders


async def rename_favorite_folder(user_id: str, folder_id: str, name: str) -> bool:
    from db import db
    if db is None:
        logger.warning("[rename_favorite_folder] db 为 None")
        return False

    result = await db.favorite_folders.update_one(
        {"user_id": user_id, "folder_id": folder_id},
        {"$set": {"name": name, "updated_at": datetime.utcnow()}},
    )
    if result.matched_count > 0:
        logger.info(f"[rename_favorite_folder] 文件夹已重命名 folder_id={folder_id} name={name}")
    else:
        logger.warning(f"[rename_favorite_folder] 未找到文件夹 folder_id={folder_id}")
    return result.matched_count > 0


async def delete_favorite_folder(user_id: str, folder_id: str) -> bool:
    from db import db
    if db is None:
        logger.warning("[delete_favorite_folder] db 为 None")
        return False

    # Collect the target folder and all its descendants
    ids_to_delete = [folder_id]
    descendant_ids = await _collect_descendant_folder_ids(user_id, folder_id)
    ids_to_delete.extend(descendant_ids)

    logger.info(f"[delete_favorite_folder] 将删除 {len(ids_to_delete)} 个文件夹 folder_id={folder_id} user_id={user_id}")

    # Delete all favorite_photos entries in those folders
    await db.favorite_photos.delete_many({
        "user_id": user_id,
        "folder_id": {"$in": ids_to_delete},
    })

    # Delete all folders
    await db.favorite_folders.delete_many({
        "user_id": user_id,
        "folder_id": {"$in": ids_to_delete},
    })

    logger.info(f"[delete_favorite_folder] 已删除文件夹及其子内容 folder_id={folder_id}")
    return True


async def add_favorite_item(user_id: str, folder_id: str, photo_id: str) -> dict | None:
    from db import db
    if db is None:
        logger.warning("[add_favorite_item] db 为 None")
        return None

    # Check for duplicate
    existing = await db.favorite_photos.find_one({
        "user_id": user_id,
        "folder_id": folder_id,
        "photo_id": photo_id,
    })
    if existing:
        logger.warning(f"[add_favorite_item] 重复收藏 user_id={user_id} folder_id={folder_id} photo_id={photo_id}")
        return None

    now = datetime.utcnow()
    await db.favorite_photos.insert_one({
        "user_id": user_id,
        "folder_id": folder_id,
        "photo_id": photo_id,
        "created_at": now,
    })
    logger.info(f"[add_favorite_item] 收藏已添加 user_id={user_id} folder_id={folder_id} photo_id={photo_id}")
    return {"user_id": user_id, "folder_id": folder_id, "photo_id": photo_id, "created_at": now}


async def list_favorite_items(user_id: str, folder_id: str) -> list:
    from db import db
    if db is None:
        logger.warning("[list_favorite_items] db 为 None")
        return []

    cursor = db.favorite_photos.find(
        {"user_id": user_id, "folder_id": folder_id}
    ).sort("created_at", -1)

    items = []
    async for fav in cursor:
        photo = await db.photos.find_one({"photo_id": fav["photo_id"]})
        if photo:
            items.append({
                "photo_id": fav["photo_id"],
                "original_url": photo.get("original_url", ""),
                "annotated_url": photo.get("annotated_url", ""),
                "collection_date": photo.get("collection_date", ""),
                "created_at": fav["created_at"],
                "objects_count": len(photo.get("objects", [])),
            })

    logger.info(f"[list_favorite_items] 找到 {len(items)} 个收藏项 user_id={user_id} folder_id={folder_id}")
    return items


async def remove_favorite_item(user_id: str, folder_id: str, photo_id: str) -> bool:
    from db import db
    if db is None:
        logger.warning("[remove_favorite_item] db 为 None")
        return False

    result = await db.favorite_photos.delete_one({
        "user_id": user_id,
        "folder_id": folder_id,
        "photo_id": photo_id,
    })
    if result.deleted_count > 0:
        logger.info(f"[remove_favorite_item] 收藏已移除 user_id={user_id} folder_id={folder_id} photo_id={photo_id}")
    else:
        logger.warning(f"[remove_favorite_item] 未找到收藏项 user_id={user_id} folder_id={folder_id} photo_id={photo_id}")
    return result.deleted_count > 0


async def is_new_user(user_id: str) -> bool:
    """判断用户是否为新用户（没有任何照片记录）"""
    from db import db
    if db is None:
        return True
    count = await db.photos.count_documents({"user_id": user_id})
    return count == 0

