import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from loguru import logger

from dotenv import load_dotenv
load_dotenv()
MONGODB_URL = os.environ.get("MONGODB_URL", "")
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "scenelingo")

db: AsyncIOMotorDatabase | None = None
_client: AsyncIOMotorClient | None = None


async def get_db() -> AsyncIOMotorDatabase | None:
    global db, _client
    if db is not None:
        return db
    if not MONGODB_URL:
        logger.warning("[DB] MONGODB_URL 未配置，跳过数据库连接")
        return None
    try:
        _client = AsyncIOMotorClient(MONGODB_URL)
        db = _client[MONGODB_DB_NAME]
        await _client.admin.command("ping")
        logger.info("[DB] MongoDB 连接成功")
        return db
    except Exception as e:
        logger.error(f"[DB] MongoDB 连接失败: {e}")
        db = None
        _client = None
        return None


async def init_db(database: AsyncIOMotorDatabase) -> None:
    await database.users.create_index("email", unique=True)

    await database.verification_codes.create_index("email")
    await database.verification_codes.create_index("expires_at", expireAfterSeconds=300)

    await database.photos.create_index("user_email")
    await database.photos.create_index([("user_email", 1), ("collection_date", 1)])
    await database.photos.create_index([("user_email", 1), ("status", 1)])
    await database.photos.create_index("status")

    await database.wordbooks.create_index("user_email", unique=True)

    logger.info("[DB] 索引初始化完成")