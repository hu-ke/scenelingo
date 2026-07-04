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
from PIL import Image
from pydantic import BaseModel

from shared.client import get_client
from shared.recognition import build_prompt, deduplicate_objects, parse_ai_response
from auth import generate_code, verify_code, generate_token, verify_token, send_email, get_or_create_user
from auth import save_photo_record, list_user_photos_mongo, delete_photo_record, save_pending_photo_record
from auth import update_user_language
from auth import update_user_theme
from auth import set_annotated_url
from auth import get_user_wordbook, sync_user_wordbook, add_wordbook_word, remove_wordbook_word
from auth import get_user_mastered, sync_user_mastered, add_mastered_word, remove_mastered_word
from auth import wechat_login
from auth import get_user_stats
from auth import get_user_quota, decrement_user_quota, add_user_quota, record_share_invite, is_new_user
from auth import complete_photo
from auth import SHARE_REWARD_QUOTA
from auth import create_favorite_folder, list_favorite_folders, update_favorite_folder, delete_favorite_folder
from auth import add_favorite_item, list_favorite_items, remove_favorite_item, move_favorite_item, get_favorited_photo_ids
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

class PhotoReRecognizeRequest(BaseModel):
    photo_id: str
    objects: list
    actions: list | None = None

class ShareRewardRequest(BaseModel):
    inviter_user_id: str

class CreateFolderRequest(BaseModel):
    name: str
    parent_id: str | None = None

class RenameFolderRequest(BaseModel):
    name: str | None = None
    parent_id: str | None = None

class MoveItemRequest(BaseModel):
    target_folder_id: str

class AddFavoriteItemRequest(BaseModel):
    folder_id: str
    photo_id: str

class RemoveFavoriteItemRequest(BaseModel):
    folder_id: str
    photo_id: str


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


@app.get("/scenelingo-service/api/user/quota")
async def user_quota(request: Request):
    user_id = require_auth(request)
    quota = await get_user_quota(user_id)
    return {"quota": quota}


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
        previous_objects_str = form_data.get("previous_objects", "")
        previous_actions_str = form_data.get("previous_actions", "")

        logger.info(f"识别请求: nativeLang={nativeLang}, targetLang={targetLang}, hint={hint}")

        prompt = build_prompt(nativeLang, targetLang)
        
        # 如果用户提供了调整提示，把已有识别结果作为上下文，让 AI 在此基础上调整
        if hint and isinstance(hint, str) and hint.strip():
            prompt += "\n\n"
            # 如果有已有识别结果，先告诉 AI 这是当前状态
            previous_objects = None
            if previous_objects_str and isinstance(previous_objects_str, str) and previous_objects_str.strip():
                try:
                    previous_objects = json.loads(previous_objects_str)
                except json.JSONDecodeError:
                    pass
            previous_actions = None
            if previous_actions_str and isinstance(previous_actions_str, str) and previous_actions_str.strip():
                try:
                    previous_actions = json.loads(previous_actions_str)
                except json.JSONDecodeError:
                    pass

            if previous_objects:
                prompt += (
                    f"Here is your previous recognition result for this image:\n"
                    f"Objects: {json.dumps(previous_objects, ensure_ascii=False)}\n"
                )
                if previous_actions:
                    prompt += f"Actions: {json.dumps(previous_actions, ensure_ascii=False)}\n"
                prompt += "\n"

            prompt += (
                f"The user reviewed your previous recognition and gave this feedback:\n"
                f'"{hint.strip()}"\n\n'
                f"Please re-examine the image carefully and update your response based on this feedback. "
                f"Keep all the previously correct objects and add/modify only what the user mentioned. "
                f"For example, if the user mentions you missed an object, look for it and add it to the existing list. "
                f"If the user says an identification was wrong, correct it. "
                f"Return the COMPLETE list including all previously correct objects plus any additions/corrections."
            )

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
    
    # 检查配额（已禁用）
    # quota = await get_user_quota(user_id)
    # if quota <= 0:
    #     raise HTTPException(status_code=403, detail="识别次数已用完，请分享给好友获取更多次数")
    
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

    # await decrement_user_quota(user_id)  # 已禁用使用次数扣减

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


@app.post("/scenelingo-service/api/share/reward")
async def share_reward(request: Request, req: ShareRewardRequest):
    new_user_id = require_auth(request)
    inviter_id = req.inviter_user_id
    
    if not inviter_id or inviter_id == new_user_id:
        raise HTTPException(status_code=400, detail="无效的邀请者ID")
    
    # 检查当前用户是否为新用户
    if not await is_new_user(new_user_id):
        return {"success": False, "reason": "not_new_user"}
    
    # 检查是否已记录该邀请关系
    recorded = await record_share_invite(inviter_id, new_user_id)
    if not recorded:
        return {"success": False, "reason": "already_rewarded"}
    
    # 奖励邀请者
    await add_user_quota(inviter_id, SHARE_REWARD_QUOTA)
    
    logger.info(f"[share_reward] 邀请者 {inviter_id} 获得 {SHARE_REWARD_QUOTA} 次配额，新用户 {new_user_id}")
    return {"success": True, "quota_added": SHARE_REWARD_QUOTA}


@app.get("/scenelingo-service/api/share/reward-info")
async def share_reward_info():
    return {"reward_quota": SHARE_REWARD_QUOTA}


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
        photos = {"photos": list_user_photos(user_id), "oldest_date": None}
    logger.info(f"[list_photos] 返回 {len(photos['photos'])} 张照片给 {user_id}")
    return photos

@app.post("/scenelingo-service/api/photos/list")
async def list_photos_post(request: Request, req: PhotoListRequest):
    user_id = require_auth(request)
    logger.info(f"[list_photos_post] 用户 {user_id} 请求照片列表, start_date={req.start_date}, end_date={req.end_date}, words={req.words}")
    photos = await list_user_photos_mongo(user_id, req.start_date, req.end_date, req.words)
    if photos is None:
        logger.warning(f"[list_photos_post] MongoDB 不可用, 降级到 OSS 查询")
        photos = {"photos": list_user_photos(user_id), "oldest_date": None}
    logger.info(f"[list_photos_post] 返回 {len(photos['photos'])} 张照片给 {user_id}")
    return photos


@app.get("/scenelingo-service/api/user/stats")
async def get_stats(request: Request):
    user_id = require_auth(request)
    logger.info(f"[get_stats] 用户 {user_id} 请求统计数据")
    stats = await get_user_stats(user_id)
    logger.info(f"[get_stats] 返回 total_count={stats['total_count']} total_days={stats['total_days']}")
    return stats


@app.post("/scenelingo-service/api/photos/re-recognize")
async def re_recognize(request: Request, req: PhotoReRecognizeRequest):
    user_id = require_auth(request)
    logger.info(f"[re_recognize] 用户 {user_id} 更新照片 {req.photo_id} 的识别结果, objects={len(req.objects)}个, actions={len(req.actions or [])}个")
    
    success = await complete_photo(req.photo_id, req.objects, req.actions)
    if not success:
        raise HTTPException(status_code=404, detail="照片不存在或更新失败")
    
    return {"success": True, "photo_id": req.photo_id}


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

# ---- Mastered Words API ----
@app.get("/scenelingo-service/api/mastered/list")
async def list_mastered(request: Request):
    user_id = require_auth(request)
    words = await get_user_mastered(user_id)
    return {"words": words}

@app.post("/scenelingo-service/api/mastered/sync")
async def sync_mastered(request: Request, req: WordbookSyncRequest):
    user_id = require_auth(request)
    success = await sync_user_mastered(user_id, req.words)
    if not success:
        raise HTTPException(status_code=500, detail="同步已掌握失败")
    return {"success": True}

@app.post("/scenelingo-service/api/mastered/add")
async def add_to_mastered(request: Request, req: WordbookWordRequest):
    user_id = require_auth(request)
    success = await add_mastered_word(user_id, req.word)
    if not success:
        raise HTTPException(status_code=500, detail="添加已掌握失败")
    return {"success": True}

@app.post("/scenelingo-service/api/mastered/remove")
async def remove_from_mastered(request: Request, req: WordbookWordRequest):
    user_id = require_auth(request)
    success = await remove_mastered_word(user_id, req.word)
    if not success:
        raise HTTPException(status_code=500, detail="移除已掌握失败")
    return {"success": True}

# ---- Favorites API ----
@app.post("/scenelingo-service/api/favorites/folders")
async def create_folder(request: Request, req: CreateFolderRequest):
    user_id = require_auth(request)
    result = await create_favorite_folder(user_id, req.name, req.parent_id)
    if result is None:
        raise HTTPException(status_code=500, detail="创建文件夹失败")
    return result


@app.get("/scenelingo-service/api/favorites/folders")
async def list_folders(request: Request, parent_id: str = None):
    user_id = require_auth(request)
    folders = await list_favorite_folders(user_id, parent_id)
    return {"folders": folders}


@app.put("/scenelingo-service/api/favorites/folders/{folder_id}")
async def update_folder(request: Request, folder_id: str, req: RenameFolderRequest):
    user_id = require_auth(request)
    success = await update_favorite_folder(user_id, folder_id, req.name, req.parent_id)
    if not success:
        raise HTTPException(status_code=404, detail="文件夹不存在或操作失败")
    return {"success": True}


@app.delete("/scenelingo-service/api/favorites/folders/{folder_id}")
async def delete_folder(request: Request, folder_id: str):
    user_id = require_auth(request)
    success = await delete_favorite_folder(user_id, folder_id)
    if not success:
        raise HTTPException(status_code=500, detail="删除文件夹失败")
    return {"success": True}

@app.get("/scenelingo-service/api/favorites/photo-ids")
async def list_favorited_photo_ids(request: Request):
    user_id = require_auth(request)
    photo_ids = await get_favorited_photo_ids(user_id)
    return {"photo_ids": photo_ids}

@app.post("/scenelingo-service/api/favorites/items")
async def add_item(request: Request, req: AddFavoriteItemRequest):
    user_id = require_auth(request)
    result = await add_favorite_item(user_id, req.folder_id, req.photo_id)
    if result is None:
        raise HTTPException(status_code=409, detail="已收藏过该照片")
    return result


@app.get("/scenelingo-service/api/favorites/items")
async def list_items(request: Request, folder_id: str):
    user_id = require_auth(request)
    items = await list_favorite_items(user_id, folder_id)
    return {"photos": items}


@app.delete("/scenelingo-service/api/favorites/items")
async def remove_item(request: Request, req: RemoveFavoriteItemRequest):
    user_id = require_auth(request)
    success = await remove_favorite_item(user_id, req.folder_id, req.photo_id)
    if not success:
        raise HTTPException(status_code=404, detail="收藏项不存在")
    return {"success": True}

@app.put("/scenelingo-service/api/favorites/items/{photo_id}")
async def move_item(request: Request, photo_id: str, req: MoveItemRequest):
    user_id = require_auth(request)
    success = await move_favorite_item(user_id, photo_id, req.target_folder_id)
    if not success:
        raise HTTPException(status_code=404, detail="收藏项不存在或操作失败")
    return {"success": True}


@app.get("/scenelingo-service/api/category-grids/tree")
async def category_grids_tree():
    """Return the category tree structure for all category grids. No auth required."""
    from shared.category_grid import get_category_tree
    tree = await get_category_tree()
    return {"categories": tree}


@app.get("/scenelingo-service/api/category-grids/detail")
async def category_grids_detail(
    category_path: str = Query(..., description="Comma-separated category path, e.g. 'fruits' or 'mammal,land,feline'"),
    grid_index: int = Query(..., description="Grid index (1-based)"),
):
    """Return the full detail of a single grid including enriched words. No auth required."""
    from shared.category_grid import get_grid_detail
    path_parts = [p.strip() for p in category_path.split(",") if p.strip()]
    if not path_parts or grid_index < 1:
        raise HTTPException(status_code=400, detail="Invalid parameters")
    detail = await get_grid_detail(path_parts, grid_index)
    if not detail:
        raise HTTPException(status_code=404, detail="Grid not found")
    return {"grid": detail}


class ReAnnotateRequest(BaseModel):
    category_path: str
    grid_index: int


@app.post("/scenelingo-service/api/category-grids/re-annotate")
async def category_grids_re_annotate(body: ReAnnotateRequest):
    """Re-annotate a grid image with bbox coordinates and enriched words. No auth required."""
    from shared.category_grid import re_annotate_grid
    path_parts = [p.strip() for p in body.category_path.split(",") if p.strip()]
    if not path_parts or body.grid_index < 1:
        raise HTTPException(status_code=400, detail="Invalid parameters")
    result = await re_annotate_grid(path_parts, body.grid_index)
    if not result:
        raise HTTPException(status_code=500, detail="Re-annotation failed")
    return {"grid": result}


@app.post("/scenelingo-service/api/category-grids/upload-annotated")
async def category_grids_upload_annotated(
    category_path: str = Query(..., description="Comma-separated category path"),
    grid_index: int = Query(..., description="Grid index (1-based)"),
    file: UploadFile | None = None,
):
    """Upload an annotated grid image. No auth required."""
    from shared.category_grid import upload_annotated_grid
    path_parts = [p.strip() for p in category_path.split(",") if p.strip()]
    if not path_parts or grid_index < 1:
        raise HTTPException(status_code=400, detail="Invalid parameters")
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")
    image_data = await file.read()
    url = await upload_annotated_grid(path_parts, grid_index, image_data)
    if not url:
        raise HTTPException(status_code=500, detail="Upload failed")
    return {"url": url}


@app.get("/scenelingo-service/api/category-grids/search")
async def category_grids_search(
    word: str = Query(..., description="Word to search for"),
):
    """Search all category grids for a given word. No auth required."""
    from shared.category_grid import search_grids_by_word
    if not word.strip():
        return {"grids": []}
    grids = await search_grids_by_word(word.strip().lower())
    return {"grids": grids}


# ── Scene Grids APIs ─────────────────────────────────────────────────

@app.get("/scenelingo-service/api/scene-grids/tree")
async def scene_grids_tree():
    """Return the scene tree structure for all scene grids. No auth required."""
    from shared.scene_grid import get_scene_tree
    tree = await get_scene_tree()
    return {"scenes": tree}


@app.get("/scenelingo-service/api/scene-grids/detail")
async def scene_grids_detail(
    scene_path: str = Query(..., description="Comma-separated scene path, e.g. 'airport,runway'"),
):
    """Return the full detail of a single scene including enriched words. No auth required."""
    from shared.scene_grid import get_scene_detail
    path_parts = [p.strip() for p in scene_path.split(",") if p.strip()]
    if not path_parts:
        raise HTTPException(status_code=400, detail="Invalid parameters")
    detail = await get_scene_detail(path_parts)
    if not detail:
        raise HTTPException(status_code=404, detail="Scene not found")
    return {"scene": detail}


class ReAnnotateSceneRequest(BaseModel):
    scene_path: str


@app.post("/scenelingo-service/api/scene-grids/re-annotate")
async def scene_grids_re_annotate(body: ReAnnotateSceneRequest):
    """Re-annotate a scene photo with bbox coordinates and enriched words. No auth required."""
    from shared.scene_grid import re_annotate_scene
    path_parts = [p.strip() for p in body.scene_path.split(",") if p.strip()]
    if not path_parts:
        raise HTTPException(status_code=400, detail="Invalid parameters")
    result = await re_annotate_scene(path_parts)
    if not result:
        raise HTTPException(status_code=500, detail="Re-annotation failed")
    return {"scene": result}


@app.post("/scenelingo-service/api/scene-grids/upload-annotated")
async def scene_grids_upload_annotated(
    scene_path: str = Query(..., description="Comma-separated scene path"),
    file: UploadFile | None = None,
):
    """Upload an annotated scene image. No auth required."""
    from shared.scene_grid import upload_annotated_scene
    path_parts = [p.strip() for p in scene_path.split(",") if p.strip()]
    if not path_parts:
        raise HTTPException(status_code=400, detail="Invalid parameters")
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")
    image_data = await file.read()
    url = await upload_annotated_scene(path_parts, image_data)
    if not url:
        raise HTTPException(status_code=500, detail="Upload failed")
    return {"url": url}


@app.get("/scenelingo-service/api/scene-grids/search")
async def scene_grids_search(
    word: str = Query(..., description="Word to search for"),
):
    """Search all scene grids for a given word. No auth required."""
    from shared.scene_grid import search_scenes_by_word
    if not word.strip():
        return {"scenes": []}
    scenes = await search_scenes_by_word(word.strip().lower())
    return {"scenes": scenes}


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