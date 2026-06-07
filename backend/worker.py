import os
import re
import json
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

from openai import OpenAI
from PIL import Image

from auth import claim_pending_photo, complete_photo, reset_photo_to_pending, get_user_language
from db import get_db


def get_client():
    api_key = os.environ.get("DASHSCOPE_API_KEY", "")
    if not api_key:
        raise Exception("DASHSCOPE_API_KEY environment variable is not set")
    return OpenAI(
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        api_key=api_key,
    )


LANG_NAMES = {
    "zh": "Chinese", "en": "English", "ja": "Japanese", "ko": "Korean",
    "fr": "French", "de": "German", "es": "Spanish", "pt": "Portuguese",
    "ru": "Russian", "ar": "Arabic",
}

PHONETIC_DESCS = {
    "zh": "the Pinyin of the word",
    "en": 'the English phonetic transcription of the word, e.g. "/ˈæp.l/"',
    "ja": "the Hiragana reading of the word",
    "ko": "the Romanized reading of the word",
    "fr": "the IPA phonetic transcription of the word",
    "de": "the IPA phonetic transcription of the word",
    "es": "the IPA phonetic transcription of the word",
    "pt": "the IPA phonetic transcription of the word",
    "ru": "the Cyrillic pronunciation with stress mark",
    "ar": "the Romanized transliteration of the word",
}


def build_prompt(nativeLang: str, targetLang: str) -> str:
    native_name = LANG_NAMES.get(nativeLang, nativeLang)
    target_name = LANG_NAMES.get(targetLang, targetLang)
    phonetic_desc = PHONETIC_DESCS.get(targetLang, "the phonetic transcription of the word")

    extra_fields = ""
    extra_example = ""
    if targetLang == "ja":
        extra_fields = ', romaji (the Romaji reading of the word)'
        extra_example = ', "romaji": "ringo"'

    return (
        f"Please identify only the obvious and prominent objects in the image. "
        f"Each object should contain name (object name in {target_name}), "
        f"phonetic ({phonetic_desc}){extra_fields}, "
        f"chinese (the {native_name} translation of the word), "
        f"bbox (bounding box coordinates), "
        f"and examples (an array of 2 simple {target_name} example sentences using the word). "
        f"The bbox format is [x1, y1, x2, y2], with coordinate values normalized to the 0-1000 range. "
        f"Return only a JSON array with no other text. "
        f'Format example: [{{"name": "apple", "phonetic": "/ˈæp.l/"{extra_example}, "chinese": "苹果", "bbox": [100, 200, 300, 400], "examples": ["I ate a red apple.", "The apple fell from the tree."]}}]'
    )



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
            user_email = doc["user_email"]
            original_url = doc["original_url"]
            logger.info(f"开始处理照片 user_email={user_email} photo_id={photo_id}")

            # 获取用户的语言偏好
            user_lang = await get_user_language(user_email)
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

            text = re.sub(r'```json\s*', '', text)
            text = re.sub(r'\s*```\s*$', '', text)
            json_match = re.search(r'\[.*\]', text, re.DOTALL)
            objects = []
            if json_match:
                json_str = json_match.group()
                json_str = re.sub(r'(\d+)"(\s*\])', r'"\1"\2', json_str)
                try:
                    objects = json.loads(json_str)
                except json.JSONDecodeError:
                    pass
            if not objects:
                try:
                    objects = json.loads(text)
                except json.JSONDecodeError:
                    logger.warning(f"JSON 解析失败: {text[:200]}")

            if objects:
                await complete_photo(photo_id, objects)
                logger.info(f"照片处理完成 photo_id={photo_id}, 识别到 {len(objects)} 个物体")
            else:
                await reset_photo_to_pending(photo_id)
                logger.warning(f"照片识别无结果，重置为 pending photo_id={photo_id}")

        except Exception as e:
            logger.error(f"Worker 处理异常: {e}")
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main())
