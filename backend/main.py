import os
import base64
import json
import re
import uuid
from io import BytesIO
from urllib.request import urlopen
from urllib.parse import quote

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

from fastapi import FastAPI, UploadFile, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from openai import OpenAI
from PIL import Image
from pydantic import BaseModel

from auth import generate_code, verify_code, generate_token, verify_token, send_email, get_or_create_user
from auth import save_photo_record, list_user_photos_mongo, delete_photo_record, save_pending_photo_record
from auth import update_user_language
from auth import update_user_theme
from auth import set_annotated_url
from auth import get_user_wordbook, sync_user_wordbook, add_wordbook_word, remove_wordbook_word
from auth import wechat_login
from db import get_db, init_db, _client
from oss_client import upload_photo, upload_metadata, list_user_photos, delete_photo

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_client():
    api_key = os.environ.get("DASHSCOPE_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="DASHSCOPE_API_KEY environment variable is not set")
    return OpenAI(
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        api_key=api_key,
    )


class SendCodeRequest(BaseModel):
    email: str

class VerifyRequest(BaseModel):
    email: str
    code: str

class LanguageUpdateRequest(BaseModel):
    nativeLang: str
    targetLang: str

class ThemeUpdateRequest(BaseModel):
    theme: str

class WordbookSyncRequest(BaseModel):
    words: list[str]

class WordbookWordRequest(BaseModel):
    word: str

class PhotoListRequest(BaseModel):
    start_date: str | None = None
    end_date: str | None = None
    words: list[str] | None = None


def require_auth(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未登录")
    token = auth_header[7:]
    user_id = verify_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="token已过期，请重新登录")
    return user_id


@app.post("/scenelingo-service/api/auth/send-code")
async def send_code(req: SendCodeRequest):
    email = req.email.strip()
    if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
        raise HTTPException(status_code=400, detail="请输入正确的邮箱地址")

    code = await generate_code(email)
    if code is None:
        raise HTTPException(status_code=429, detail="验证码已发送，请60秒后再试")

    send_email(email, code)

    return {"success": True, "message": "验证码已发送"}


@app.post("/scenelingo-service/api/auth/verify")
async def verify(req: VerifyRequest):
    email = req.email.strip()
    if not await verify_code(email, req.code):
        raise HTTPException(status_code=400, detail="验证码错误或已过期")
    user_info = await get_or_create_user(email)
    token = generate_token(user_info["user_id"])
    return {"token": token, "email": email, "nativeLang": user_info["nativeLang"], "targetLang": user_info["targetLang"], "theme": user_info.get("theme", "warm-orange")}


class WechatLoginRequest(BaseModel):
    code: str
    email: str = ""

@app.post("/scenelingo-service/api/auth/wechat-login")
async def wechat_login_endpoint(req: WechatLoginRequest):
    result = await wechat_login(req.code, req.email)
    if result is None:
        raise HTTPException(status_code=400, detail="微信登录失败")
    return result


@app.post("/scenelingo-service/api/user/language")
async def update_language(request: Request, req: LanguageUpdateRequest):
    user_id = require_auth(request)
    success = await update_user_language(user_id, req.nativeLang, req.targetLang)
    if not success:
        raise HTTPException(status_code=500, detail="更新语言偏好失败")
    return {"success": True}


@app.post("/scenelingo-service/api/user/theme")
async def update_theme(request: Request, req: ThemeUpdateRequest):
    user_id = require_auth(request)
    success = await update_user_theme(user_id, req.theme)
    if not success:
        raise HTTPException(status_code=500, detail="更新主题失败")
    return {"success": True}


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

    # Try to parse as JSON
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Try to extract JSON from text
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group())
            except json.JSONDecodeError:
                # Try old array format
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

    # New format: {"objects": [...], "actions": [...]}
    if isinstance(data, dict):
        return {
            "objects": data.get("objects", []),
            "actions": data.get("actions", []),
        }

    # Old format: [...]  (array of objects)
    if isinstance(data, list):
        return {"objects": data, "actions": []}

    return {"objects": [], "actions": []}


@app.post("/scenelingo-service/api/recognize")
async def recognize(image: UploadFile = None, request: Request = None):
    logger.info("收到识别请求，开始处理...")
    try:
        if request is None:
            raise HTTPException(status_code=400, detail="缺少请求数据")
        form_data = await request.form()
        nativeLang = form_data.get("nativeLang", "zh")
        targetLang = form_data.get("targetLang", "en")
        hint = form_data.get("hint", "")

        logger.info(f"识别请求: nativeLang={nativeLang}, targetLang={targetLang}, hint={hint}")

        prompt = build_prompt(nativeLang, targetLang)
        
        # 如果用户提供了调整提示，追加到 prompt 中
        if hint and isinstance(hint, str) and hint.strip():
            prompt += f"\n\nAdditional user instructions: {hint.strip()}"

        photo_url = form_data.get("photo_url", None)
        if photo_url:
            logger.info(f"从远程URL获取图片: {photo_url}")
            with urlopen(str(photo_url), timeout=15) as resp:
                img_bytes = resp.read()
            logger.info(f"远程图片下载完成: {len(img_bytes) / 1024:.1f} KB")
        elif image is not None:
            logger.info("正在读取上传的图片...")
            img_bytes = await image.read()
            logger.info(f"图片读取完成: {len(img_bytes) / 1024:.1f} KB")
        else:
            raise HTTPException(status_code=400, detail="请提供图片或图片URL")
        img = Image.open(BytesIO(img_bytes))

        width, height = img.size
        logger.info(f"原始图片尺寸: {width} x {height}")

        max_size = 1024
        scale = min(1, max_size / max(width, height))
        if scale < 1:
            new_width = int(width * scale)
            new_height = int(height * scale)
            img = img.resize((new_width, new_height), Image.LANCZOS)
            logger.info(f"缩放至: {new_width} x {new_height}")

        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        buf = BytesIO()
        img.save(buf, format="JPEG", quality=80)
        compressed = buf.getvalue()
        logger.info(f"压缩后大小: {len(compressed) / 1024:.1f} KB")

        b64 = base64.b64encode(compressed).decode("utf-8")
        data_url = "data:image/jpeg;base64," + b64

        client = get_client()
        response = client.chat.completions.create(
            model="qwen3-vl-plus",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url},
                        },
                        {
                            "type": "text",
                            "text": prompt,
                        },
                    ],
                }
            ],
        )

        text = response.choices[0].message.content.strip()

        result = parse_ai_response(text)
        objects = deduplicate_objects(result["objects"])
        actions = result["actions"]
        return {"objects": objects, "actions": actions}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/scenelingo-service/api/photos/upload")
async def upload_photos(request: Request):
    user_id = require_auth(request)
    form = await request.form()
    original_file = form.get("original")
    original_url = form.get("original_url")
    annotated_file = form.get("annotated")
    metadata_str = form.get("metadata")

    if not annotated_file or not metadata_str:
        raise HTTPException(status_code=400, detail="缺少必要参数")
    if not original_file and not original_url:
        raise HTTPException(status_code=400, detail="缺少原图或原图URL")

    metadata = json.loads(metadata_str)
    photo_id = metadata.get("id", "")
    if not photo_id:
        raise HTTPException(status_code=400, detail="缺少photoId")

    if original_file is not None:
        original_data = await original_file.read()
        if not upload_photo(user_id, photo_id, original_data, "original.jpg"):
            raise HTTPException(status_code=500, detail="原图上传失败")
    elif original_url:
        logger.info(f"原图URL为: {original_url}，跳过重复上传")

    annotated_data = await annotated_file.read()
    if not upload_photo(user_id, photo_id, annotated_data, "annotated.jpg"):
        raise HTTPException(status_code=500, detail="标注图上传失败")

    meta = {
        "objects": metadata.get("objects", []),
        "collectionDate": metadata.get("collectionDate", ""),
        "createdAt": metadata.get("createdAt", 0),
    }

    mongo_saved = await save_photo_record(user_id, photo_id, meta)
    if not mongo_saved:
        upload_metadata(user_id, photo_id, meta)

    return {"success": True, "photoId": photo_id}


@app.post("/scenelingo-service/api/photos/upload-pending")
async def upload_pending(request: Request):
    user_id = require_auth(request)
    form = await request.form()
    original_file = form.get("original")

    if not original_file:
        raise HTTPException(status_code=400, detail="缺少原图")

    photo_id = uuid.uuid4().hex[:16]

    original_data = await original_file.read()
    if not upload_photo(user_id, photo_id, original_data, "original.jpg"):
        raise HTTPException(status_code=500, detail="原图上传失败")

    saved = await save_pending_photo_record(user_id, photo_id)
    if not saved:
        raise HTTPException(status_code=500, detail="保存记录失败")

    return {"photo_id": photo_id, "status": "pending"}


@app.post("/scenelingo-service/api/photos/upload-annotated")
async def upload_annotated(request: Request):
    user_id = require_auth(request)
    form = await request.form()
    annotated_file = form.get("annotated")
    photo_id = str(form.get("photo_id", ""))

    if not annotated_file or not photo_id:
        raise HTTPException(status_code=400, detail="缺少标注图或照片ID")

    annotated_data = await annotated_file.read()
    if not upload_photo(user_id, photo_id, annotated_data, "annotated.jpg"):
        raise HTTPException(status_code=500, detail="标注图上传失败")

    bucket = os.environ.get("OSS_BUCKET_NAME", "scenelingo")
    endpoint = os.environ.get("OSS_ENDPOINT", "oss-cn-hangzhou.aliyuncs.com")
    annotated_url = f"https://{bucket}.{endpoint}/photos/{user_id}/{photo_id}/annotated.jpg"
    await set_annotated_url(photo_id, annotated_url)

    return {"success": True, "photoId": photo_id}


@app.get("/scenelingo-service/api/tts")
async def text_to_speech(text: str = Query(...), lang: str = Query(default="en-US")):
    try:
        tts_url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={quote(text)}&tl={lang}&client=tw-ob"
        with urlopen(tts_url, timeout=15) as resp:
            content_type = resp.headers.get("Content-Type", "audio/mpeg")
            data = resp.read()
        return Response(content=data, media_type=content_type)
    except Exception as e:
        logger.warning(f"TTS代理失败: text={text}, lang={lang} - {e}")
        raise HTTPException(status_code=502, detail="语音合成失败")


@app.get("/scenelingo-service/api/image/proxy")
async def image_proxy(url: str = Query(...)):
    try:
        with urlopen(url, timeout=15) as resp:
            content_type = resp.headers.get("Content-Type", "image/jpeg")
            data = resp.read()
        return Response(content=data, media_type=content_type)
    except Exception as e:
        logger.warning(f"图片代理失败: {url} - {e}")
        raise HTTPException(status_code=502, detail="图片获取失败")


@app.get("/scenelingo-service/api/photos/list")
async def list_photos(request: Request, start_date: str = None, end_date: str = None, words: str = None):
    user_id = require_auth(request)
    word_list = words.split(",") if words else None
    logger.info(f"[list_photos] 用户 {user_id} 请求照片列表, start_date={start_date}, end_date={end_date}, words={word_list}")
    photos = await list_user_photos_mongo(user_id, start_date, end_date, word_list)
    if photos is None:
        logger.warning(f"[list_photos] MongoDB 不可用, 降级到 OSS 查询")
        photos = list_user_photos(user_id)
    logger.info(f"[list_photos] 返回 {len(photos)} 张照片给 {user_id}")
    return {"photos": photos}

@app.post("/scenelingo-service/api/photos/list")
async def list_photos_post(request: Request, req: PhotoListRequest):
    user_id = require_auth(request)
    logger.info(f"[list_photos_post] 用户 {user_id} 请求照片列表, start_date={req.start_date}, end_date={req.end_date}, words={req.words}")
    photos = await list_user_photos_mongo(user_id, req.start_date, req.end_date, req.words)
    if photos is None:
        logger.warning(f"[list_photos_post] MongoDB 不可用, 降级到 OSS 查询")
        photos = list_user_photos(user_id)
    logger.info(f"[list_photos_post] 返回 {len(photos)} 张照片给 {user_id}")
    return {"photos": photos}


@app.delete("/scenelingo-service/api/photos/delete")
async def delete_photos(request: Request):
    user_id = require_auth(request)
    photo_id = request.query_params.get("id", "")
    if not photo_id:
        raise HTTPException(status_code=400, detail="缺少照片ID")
    await delete_photo_record(user_id, photo_id)
    delete_photo(user_id, photo_id)
    return {"success": True}


@app.get("/scenelingo-service/api/wordbook/list")
async def list_wordbook(request: Request):
    user_id = require_auth(request)
    words = await get_user_wordbook(user_id)
    return {"words": words}

@app.post("/scenelingo-service/api/wordbook/sync")
async def sync_wordbook(request: Request, req: WordbookSyncRequest):
    user_id = require_auth(request)
    success = await sync_user_wordbook(user_id, req.words)
    if not success:
        raise HTTPException(status_code=500, detail="同步生词本失败")
    return {"success": True}

@app.post("/scenelingo-service/api/wordbook/add")
async def add_to_wordbook(request: Request, req: WordbookWordRequest):
    user_id = require_auth(request)
    success = await add_wordbook_word(user_id, req.word)
    if not success:
        raise HTTPException(status_code=500, detail="添加生词失败")
    return {"success": True}

@app.post("/scenelingo-service/api/wordbook/remove")
async def remove_from_wordbook(request: Request, req: WordbookWordRequest):
    user_id = require_auth(request)
    success = await remove_wordbook_word(user_id, req.word)
    if not success:
        raise HTTPException(status_code=500, detail="移除生词失败")
    return {"success": True}

@app.on_event("startup")
async def startup():
    database = await get_db()
    if database is not None:
        await init_db(database)


@app.on_event("shutdown")
async def shutdown():
    global _client
    if _client is not None:
        _client.close()
        logger.info("[DB] MongoDB 连接已关闭")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8022)