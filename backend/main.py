import os
import base64
import json
import re
import uuid
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


def require_auth(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未登录")
    token = auth_header[7:]
    email = verify_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="token已过期，请重新登录")
    return email


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
    token = generate_token(email)
    return {"token": token, "email": email, "nativeLang": user_info["nativeLang"], "targetLang": user_info["targetLang"], "theme": user_info.get("theme", "warm-orange")}


@app.post("/scenelingo-service/api/user/language")
async def update_language(request: Request, req: LanguageUpdateRequest):
    email = require_auth(request)
    success = await update_user_language(email, req.nativeLang, req.targetLang)
    if not success:
        raise HTTPException(status_code=500, detail="更新语言偏好失败")
    return {"success": True}


@app.post("/scenelingo-service/api/user/theme")
async def update_theme(request: Request, req: ThemeUpdateRequest):
    email = require_auth(request)
    success = await update_user_theme(email, req.theme)
    if not success:
        raise HTTPException(status_code=500, detail="更新主题失败")
    return {"success": True}


LANG_NAMES = {
    "zh": "Chinese", "en": "English", "ja": "Japanese", "ko": "Korean",
    "fr": "French", "de": "German", "es": "Spanish", "pt": "Portuguese",
    "ru": "Russian", "ar": "Arabic",
}

PHONETIC_DESCS = {
    "zh": "the Pinyin of the word",
    "en": 'the English phonetic transcription of the word, e.g. "/ˈæp.l/"',
    "ja": "the Romaji reading of the word",
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

    return (
        f"Please identify only the obvious and prominent objects in the image. "
        f"Each object should contain name (object name in {target_name}), "
        f"phonetic ({phonetic_desc}), "
        f"chinese (the {native_name} translation of the word), "
        f"bbox (bounding box coordinates), "
        f"and examples (an array of 2 simple {target_name} example sentences using the word). "
        f"The bbox format is [x1, y1, x2, y2], with coordinate values normalized to the 0-1000 range. "
        f"Return only a JSON array with no other text. "
        f'Format example: [{{"name": "apple", "phonetic": "/ˈæp.l/", "chinese": "苹果", "bbox": [100, 200, 300, 400], "examples": ["I ate a red apple.", "The apple fell from the tree."]}}]'
    )


@app.post("/scenelingo-service/api/recognize")
async def recognize(image: UploadFile = None, request: Request = None):
    logger.info("收到识别请求，开始处理...")
    try:
        if request is None:
            raise HTTPException(status_code=400, detail="缺少请求数据")
        form_data = await request.form()
        nativeLang = form_data.get("nativeLang", "zh")
        targetLang = form_data.get("targetLang", "en")

        logger.info(f"识别请求: nativeLang={nativeLang}, targetLang={targetLang}")

        prompt = build_prompt(nativeLang, targetLang)

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

        text = re.sub(r'```json\s*', '', text)
        text = re.sub(r'\s*```\s*$', '', text)

        json_match = re.search(r'\[.*\]', text, re.DOTALL)
        if json_match:
            json_str = json_match.group()
            json_str = re.sub(r'(\d+)"(\s*\])', r'"\1"\2', json_str)
            try:
                objects = json.loads(json_str)
                return {"objects": objects}
            except json.JSONDecodeError:
                pass

        try:
            objects = json.loads(text)
            return {"objects": objects}
        except json.JSONDecodeError:
            return {"objects": [], "raw_response": text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/scenelingo-service/api/photos/upload")
async def upload_photos(request: Request):
    email = require_auth(request)
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
        if not upload_photo(email, photo_id, original_data, "original.jpg"):
            raise HTTPException(status_code=500, detail="原图上传失败")
    elif original_url:
        logger.info(f"原图URL为: {original_url}，跳过重复上传")

    annotated_data = await annotated_file.read()
    if not upload_photo(email, photo_id, annotated_data, "annotated.jpg"):
        raise HTTPException(status_code=500, detail="标注图上传失败")

    meta = {
        "objects": metadata.get("objects", []),
        "collectionDate": metadata.get("collectionDate", ""),
        "createdAt": metadata.get("createdAt", 0),
    }

    mongo_saved = await save_photo_record(email, photo_id, meta)
    if not mongo_saved:
        upload_metadata(email, photo_id, meta)

    return {"success": True, "photoId": photo_id}


@app.post("/scenelingo-service/api/photos/upload-pending")
async def upload_pending(request: Request):
    email = require_auth(request)
    form = await request.form()
    original_file = form.get("original")

    if not original_file:
        raise HTTPException(status_code=400, detail="缺少原图")

    photo_id = uuid.uuid4().hex[:16]

    original_data = await original_file.read()
    if not upload_photo(email, photo_id, original_data, "original.jpg"):
        raise HTTPException(status_code=500, detail="原图上传失败")

    saved = await save_pending_photo_record(email, photo_id)
    if not saved:
        raise HTTPException(status_code=500, detail="保存记录失败")

    return {"photo_id": photo_id, "status": "pending"}


@app.post("/scenelingo-service/api/photos/upload-annotated")
async def upload_annotated(request: Request):
    email = require_auth(request)
    form = await request.form()
    annotated_file = form.get("annotated")
    photo_id = str(form.get("photo_id", ""))

    if not annotated_file or not photo_id:
        raise HTTPException(status_code=400, detail="缺少标注图或照片ID")

    annotated_data = await annotated_file.read()
    if not upload_photo(email, photo_id, annotated_data, "annotated.jpg"):
        raise HTTPException(status_code=500, detail="标注图上传失败")

    bucket = os.environ.get("OSS_BUCKET_NAME", "scenelingo")
    endpoint = os.environ.get("OSS_ENDPOINT", "oss-cn-hangzhou.aliyuncs.com")
    annotated_url = f"https://{bucket}.{endpoint}/photos/{email}/{photo_id}/annotated.jpg"
    await set_annotated_url(photo_id, annotated_url)

    return {"success": True, "photoId": photo_id}


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
async def list_photos(request: Request):
    email = require_auth(request)
    logger.info(f"[list_photos] 用户 {email} 请求照片列表")
    photos = await list_user_photos_mongo(email)
    if photos is None:
        logger.warning(f"[list_photos] MongoDB 不可用, 降级到 OSS 查询")
        photos = list_user_photos(email)
    logger.info(f"[list_photos] 返回 {len(photos)} 张照片给 {email}")
    return {"photos": photos}


@app.delete("/scenelingo-service/api/photos/delete")
async def delete_photos(request: Request):
    email = require_auth(request)
    photo_id = request.query_params.get("id", "")
    if not photo_id:
        raise HTTPException(status_code=400, detail="缺少照片ID")
    await delete_photo_record(email, photo_id)
    delete_photo(email, photo_id)
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