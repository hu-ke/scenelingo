import os
import json
import oss2
from io import BytesIO
from loguru import logger

OSS_ACCESS_KEY = os.environ.get("ALIBABA_CLOUD_ACCESS_KEY_ID", "")
OSS_ACCESS_SECRET = os.environ.get("ALIBABA_CLOUD_ACCESS_KEY_SECRET", "")
OSS_ENDPOINT = os.environ.get("OSS_ENDPOINT", "oss-cn-hangzhou.aliyuncs.com")
OSS_BUCKET = os.environ.get("OSS_BUCKET_NAME", "scenelingo")

def _get_bucket():
    if not OSS_ACCESS_KEY or not OSS_ACCESS_SECRET:
        return None
    auth = oss2.Auth(OSS_ACCESS_KEY, OSS_ACCESS_SECRET)
    return oss2.Bucket(auth, OSS_ENDPOINT, OSS_BUCKET)

def upload_photo(user_id: str, photo_id: str, file_data: bytes, filename: str) -> bool:
    bucket = _get_bucket()
    if not bucket:
        return False
    key = f"photos/{user_id}/{photo_id}/{filename}"
    try:
        bucket.put_object(key, file_data)
        return True
    except Exception as e:
        logger.error(f"[OSS] 上传失败: {e}")
        return False

def upload_metadata(user_id: str, photo_id: str, meta: dict) -> bool:
    bucket = _get_bucket()
    if not bucket:
        return False
    key = f"photos/{user_id}/{photo_id}/meta.json"
    try:
        bucket.put_object(key, json.dumps(meta, ensure_ascii=False).encode("utf-8"))
        return True
    except Exception as e:
        logger.error(f"[OSS] 元数据上传失败: {e}")
        return False

def list_user_photos(user_id: str) -> list[dict]:
    bucket = _get_bucket()
    if not bucket:
        return []
    prefix = f"photos/{user_id}/"
    result = []
    try:
        for obj in oss2.ObjectIterator(bucket, prefix=prefix, delimiter="/"):
            key = obj.key
            if key.endswith("/meta.json"):
                photo_id = key.split("/")[-2]
                try:
                    content = bucket.get_object(key).read()
                    meta = json.loads(content.decode("utf-8"))
                    result.append({
                        "id": photo_id,
                        "originalUrl": f"https://{OSS_BUCKET}.{OSS_ENDPOINT}/photos/{user_id}/{photo_id}/original.jpg",
                        "annotatedUrl": f"https://{OSS_BUCKET}.{OSS_ENDPOINT}/photos/{user_id}/{photo_id}/annotated.jpg",
                        "objects": meta.get("objects", []),
                        "collectionDate": meta.get("collectionDate", ""),
                        "createdAt": meta.get("createdAt", 0),
                    })
                except Exception as e:
                    logger.error(f"[OSS] 读取meta失败 {key}: {e}")
    except Exception as e:
        logger.error(f"[OSS] 列出文件失败: {e}")
    return result

def delete_photo(user_id: str, photo_id: str) -> bool:
    bucket = _get_bucket()
    if not bucket:
        return False
    prefix = f"photos/{user_id}/{photo_id}/"
    try:
        keys = [obj.key for obj in oss2.ObjectIterator(bucket, prefix=prefix)]
        if keys:
            bucket.batch_delete_objects(keys)
        return True
    except Exception as e:
        logger.error(f"[OSS] 删除失败: {e}")
        return False
