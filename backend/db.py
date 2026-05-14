import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from dotenv import load_dotenv
load_dotenv()
MONGODB_URL = os.environ.get("MONGODB_URL", "")

db: AsyncIOMotorDatabase | None = None
_client: AsyncIOMotorClient | None = None


async def get_db() -> AsyncIOMotorDatabase | None:
    global db, _client
    if db is not None:
        return db
    if not MONGODB_URL:
        print("[DB] MONGODB_URL 未配置，跳过数据库连接")
        return None
    try:
        _client = AsyncIOMotorClient(MONGODB_URL)
        db = _client.get_default_database()
        await _client.admin.command("ping")
        print("[DB] MongoDB 连接成功")
        return db
    except Exception as e:
        print(f"[DB] MongoDB 连接失败: {e}")
        db = None
        _client = None
        return None


async def init_db(database: AsyncIOMotorDatabase) -> None:
    await database.users.create_index("email", unique=True)

    await database.verification_codes.create_index("email")
    await database.verification_codes.create_index("expires_at", expireAfterSeconds=300)

    await database.photos.create_index("user_email")
    await database.photos.create_index([("user_email", 1), ("collection_date", 1)])

    print("[DB] 索引初始化完成")