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

from bson import ObjectId

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
    "th": "Thai", "fa": "Persian", "vi": "Vietnamese", "my": "Burmese",
    "it": "Italian", "nl": "Dutch", "pl": "Polish", "tr": "Turkish",
    "hi": "Hindi", "id": "Indonesian", "ms": "Malay", "sv": "Swedish",
    "uk": "Ukrainian", "he": "Hebrew", "cs": "Czech", "el": "Greek",
    "ro": "Romanian", "hu": "Hungarian", "da": "Danish", "fi": "Finnish",
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
    "th": "the Romanized transcription (Paiboon system) of the word",
    "fa": "the Romanized transliteration of the word",
    "vi": "the IPA phonetic transcription with tone marks of the word",
    "my": "the Romanized transliteration of the word",
    "it": "the IPA phonetic transcription of the word",
    "nl": "the IPA phonetic transcription of the word",
    "pl": "the IPA phonetic transcription of the word",
    "tr": "the IPA phonetic transcription of the word",
    "hi": "the Romanized transliteration (IAST) of the word",
    "id": "the IPA phonetic transcription of the word",
    "ms": "the IPA phonetic transcription of the word",
    "sv": "the IPA phonetic transcription of the word",
    "uk": "the IPA phonetic transcription of the word",
    "he": "the Romanized transliteration of the word",
    "cs": "the IPA phonetic transcription of the word",
    "el": "the IPA phonetic transcription of the word",
    "ro": "the IPA phonetic transcription of the word",
    "hu": "the IPA phonetic transcription of the word",
    "da": "the IPA phonetic transcription of the word",
    "fi": "the IPA phonetic transcription of the word",
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
        f"Please identify the obvious objects and the main action in the image.\n"
        f"\n"
        f"Objects (nouns): Identify the prominent physical objects. Each object should have:\n"
        f"- name: object name in {target_name}\n"
        f"- phonetic: {phonetic_desc}{extra_fields}\n"
        f"- chinese: {native_name} translation\n"
        f"- bbox: bounding box [x1, y1, x2, y2] normalized to 0-1000\n"
        f"- examples: 2 simple {target_name} example sentences\n"
        f"\n"
        f"Actions (verbs): Identify the single most prominent action being performed in the image. "
        f"Return only ONE main action. If there is no clear action (e.g. just objects sitting still), "
        f"return an empty actions array. Each action should have:\n"
        f"- name: the main verb/action word in {target_name} (e.g. running, eating, jumping)\n"
        f"- phonetic: {phonetic_desc}{extra_fields}\n"
        f"- chinese: {native_name} translation\n"
        f"- examples: 2 simple {target_name} example sentences using the action word\n"
        f"\n"
        f"Return ONLY a JSON object with two arrays, no other text:\n"
        f'{{"objects": [{{"name": "apple", "phonetic": "/ˈæp.l/"{extra_example}, "chinese": "苹果", "bbox": [100, 200, 300, 400], "examples": ["I ate a red apple.", "The apple fell from the tree."]}}], '
        f'"actions": [{{"name": "running", "phonetic": "/ˈrʌn.ɪŋ/"{extra_example}, "chinese": "跑步", "examples": ["She is running in the park.", "I like running every morning."]}}]}}'
    )


def deduplicate_objects(objects: list) -> list:
    """对识别结果去重，相同单词只保留第一个"""
    seen = set()
    result = []
    for obj in objects:
        name = obj.get("name", "").lower()
        if name and name not in seen:
            seen.add(name)
            result.append(obj)
    return result


def parse_ai_response(text: str) -> dict:
    """解析AI返回，支持新旧两种格式，返回 {"objects": [], "actions": []}"""
    text = re.sub(r'```json\s*', '', text)
    text = re.sub(r'\s*```\s*$', '', text)

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group())
            except json.JSONDecodeError:
                arr_match = re.search(r'\[.*\]', text, re.DOTALL)
                if arr_match:
                    try:
                        data = json.loads(arr_match.group())
                    except json.JSONDecodeError:
                        return {"objects": [], "actions": []}
                else:
                    return {"objects": [], "actions": []}
        else:
            return {"objects": [], "actions": []}

    if isinstance(data, dict):
        return {
            "objects": data.get("objects", []),
            "actions": data.get("actions", []),
        }

    if isinstance(data, list):
        return {"objects": data, "actions": []}

    return {"objects": [], "actions": []}



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
