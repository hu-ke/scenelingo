import base64
import asyncio
from io import BytesIO
from urllib.request import urlopen

from dotenv import load_dotenv
load_dotenv()

from loguru import logger

logger.remove()
logger.add(
    lambda msg: print(msg, end=""),
    format="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <level>{message}</level>",
    level="DEBUG",
    colorize=True,
)

from shared.client import get_client
from shared.recognition import build_prompt, deduplicate_objects, parse_ai_response
from PIL import Image

from auth import claim_pending_photo, complete_photo, reset_photo_to_pending, get_user_language
from db import get_db


async def main():
    await get_db()
    logger.info("Worker 启动，开始轮询 pending 照片...")

    while True:
        try:
            doc = await claim_pending_photo()
            if doc is None:
                await asyncio.sleep(1)
                continue

            photo_id = doc["photo_id"]
            user_id = doc["user_id"]
            original_url = doc["original_url"]
            logger.info(f"开始处理照片 user_id={user_id} photo_id={photo_id}")

            # 获取用户的语言偏好
            user_lang = await get_user_language(user_id)
            native_lang = user_lang["nativeLang"]
            target_lang = user_lang["targetLang"]
            logger.info(f"用户语言偏好: native_lang={native_lang}, target_lang={target_lang}")

            with urlopen(original_url, timeout=30) as resp:
                img_bytes = resp.read()

            img = Image.open(BytesIO(img_bytes))
            max_size = 1024
            scale = min(1, max_size / max(img.size[0], img.size[1]))
            if scale < 1:
                new_size = (int(img.size[0] * scale), int(img.size[1] * scale))
                img = img.resize(new_size, Image.LANCZOS)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            buf = BytesIO()
            img.save(buf, format="JPEG", quality=80)
            compressed = buf.getvalue()
            b64 = base64.b64encode(compressed).decode("utf-8")
            data_url = "data:image/jpeg;base64," + b64

            prompt = build_prompt(native_lang, target_lang)
            client = get_client()
            response = client.chat.completions.create(
                model="qwen3-vl-plus",
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": data_url}},
                        {"type": "text", "text": prompt},
                    ],
                }],
            )

            text = response.choices[0].message.content.strip()

            result = parse_ai_response(text)
            objects = deduplicate_objects(result["objects"])
            actions = result["actions"]

            if objects or actions:
                await complete_photo(photo_id, objects, actions)
                logger.info(f"照片处理完成 photo_id={photo_id}, 识别到 {len(objects)} 个物体, {len(actions)} 个动作")
            else:
                await reset_photo_to_pending(photo_id)
                logger.warning(f"照片识别无结果，重置为 pending photo_id={photo_id}")

        except Exception as e:
            logger.error(f"Worker 处理异常: {e}")
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main())
