import base64
import json
import os
import re
import sys
from datetime import datetime, timezone
from urllib.request import urlopen

from loguru import logger

from dotenv import load_dotenv

load_dotenv()

# Allow importing from backend/ when this module is not run from the backend root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from oss_client import _get_bucket, OSS_BUCKET, OSS_ENDPOINT  # noqa: E402
from shared.client import get_client  # noqa: E402


# ── OSS upload ──────────────────────────────────────────────────────

def upload_scene_to_oss(scene_path: list[str], image_data: bytes) -> dict | None:
    """Upload a scene photo to OSS and return the URL and key.

    Args:
        scene_path: scene hierarchy, e.g. ["airport", "runway"]
        image_data: JPEG image bytes

    Returns:
        {"url": "https://...", "oss_key": "assets/scenes/..."} on success, None on failure
    """
    bucket = _get_bucket()
    if not bucket:
        logger.error("[scene_grid] OSS bucket not available")
        return None

    oss_key = f"assets/scenes/{'/'.join(scene_path)}.jpg"
    url = f"https://{OSS_BUCKET}.{OSS_ENDPOINT}/{oss_key}"

    try:
        bucket.put_object(oss_key, image_data)
        logger.info(f"[scene_grid] 上传成功: {oss_key}")
        return {"url": url, "oss_key": oss_key}
    except Exception as e:
        logger.error(f"[scene_grid] OSS 上传失败: {e}")
        return None


# ── Scene recognition ───────────────────────────────────────────────

def _make_thumbnail_url(image_url: str, width: int = 200) -> str:
    """Append OSS image processing params to resize an image URL."""
    return f"{image_url}?x-oss-process=image/resize,w_{width}"


def recognize_scene(image_bytes: bytes) -> list[dict]:
    """Recognize all items in a scene photo using qwen3-vl-plus.

    Returns a list of dicts with word, bbox (0-1000 range).
    """
    base64_data = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:image/jpeg;base64,{base64_data}"

    prompt = (
        "This is a scene photo. Identify ALL visible objects/items in the scene in English. "
        "For each item, provide its bounding box as [x1, y1, x2, y2] in a 0-1000 coordinate system "
        "(relative to the full image). "
        "Return a JSON array like: "
        '[{"word": "chair", "bbox": [100, 200, 300, 500]}, {"word": "desk", "bbox": [350, 150, 700, 450]}, ...]'
    )

    client = get_client()

    try:
        resp = client.chat.completions.create(
            model="qwen3-vl-plus",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": data_url}},
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
        raw = resp.choices[0].message.content.strip()

        # Clean markdown fences
        raw = re.sub(r"```json\s*", "", raw)
        raw = re.sub(r"\s*```\s*$", "", raw)

        try:
            words = json.loads(raw)
        except json.JSONDecodeError:
            # Try to extract JSON array from the text
            match = re.search(r"\[.*\]", raw, re.DOTALL)
            if match:
                words = json.loads(match.group())
            else:
                logger.warning(f"[scene_grid] 无法解析识别结果: {raw[:200]}")
                return []

        if not isinstance(words, list):
            logger.warning(f"[scene_grid] 识别结果不是列表: {raw[:200]}")
            return []

        logger.info(f"[scene_grid] 识别出 {len(words)} 个物品")

        return words

    except Exception as e:
        logger.error(f"[scene_grid] 识别失败: {e}")
        return []


# ── Word enrichment ─────────────────────────────────────────────────

def enrich_scene_words(words: list[dict]) -> list[dict]:
    """Enrich word items with Chinese, phonetic and example sentences using LLM.

    Takes a list of {word, bbox} and returns the same list with
    'chinese', 'phonetic' and 'examples' fields added.
    """
    if not words:
        return words

    word_names = [w["word"] for w in words]
    word_list = ", ".join(word_names)

    prompt = (
        f"For each of the following English words: {word_list}\n"
        "Provide the Chinese translation, IPA phonetic transcription, "
        "and 2 short English example sentences. "
        "Return a JSON object where keys are the words, and values are "
        '{{"chinese": "...", "phonetic": "...", "examples": ["...", "..."]}}. '
        "Only return the JSON object, no other text."
    )

    client = get_client()

    try:
        resp = client.chat.completions.create(
            model="qwen-plus",
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.choices[0].message.content.strip()

        # Clean markdown fences
        raw = re.sub(r"```json\s*", "", raw)
        raw = re.sub(r"\s*```\s*$", "", raw)

        try:
            details = json.loads(raw)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                details = json.loads(match.group())
            else:
                logger.warning(f"[scene_grid] 无法解析单词详情: {raw[:200]}")
                return words
    except Exception as e:
        logger.error(f"[scene_grid] 获取单词详情失败: {e}")
        return words

    if not isinstance(details, dict):
        return words

    for w in words:
        word_detail = details.get(w["word"], {})
        if isinstance(word_detail, dict):
            w["chinese"] = word_detail.get("chinese", "")
            w["phonetic"] = word_detail.get("phonetic", "")
            w["examples"] = word_detail.get("examples", [])
        else:
            w["chinese"] = ""
            w["phonetic"] = ""
            w["examples"] = []

    return words


# ── Scene detail ────────────────────────────────────────────────────

async def get_scene_detail(scene_path: list[str]) -> dict | None:
    """Get a single scene record with enriched word details.

    Returns the full record dict or None if not found.
    """
    from db import db

    if db is None:
        logger.error("[scene_grid] MongoDB 未连接，无法查询")
        return None

    try:
        doc = await db.scene_grids.find_one({"scene_path": scene_path})
        if not doc:
            logger.warning(f"[scene_grid] 记录不存在: {scene_path}")
            return None

        doc_id = doc["_id"]
        doc["_id"] = str(doc_id)

        # Enrich words with chinese, phonetic and examples if not already present
        words = doc.get("words", [])
        if words and ("chinese" not in words[0] or "phonetic" not in words[0]):
            words = enrich_scene_words(words)
            await db.scene_grids.update_one(
                {"_id": doc_id},
                {"$set": {"words": words}},
            )
            doc["words"] = words

        return doc
    except Exception as e:
        logger.error(f"[scene_grid] 查询详情失败: {e}")
        return None


# ── Re-annotate ─────────────────────────────────────────────────────

async def re_annotate_scene(scene_path: list[str]) -> dict | None:
    """Re-recognize a scene photo with bbox and enrich word details.

    Downloads the image from OSS, runs recognition, and saves the updated data.
    Returns the updated record dict or None on failure.
    """
    from db import db

    if db is None:
        logger.error("[scene_grid] MongoDB 未连接")
        return None

    try:
        doc = await db.scene_grids.find_one({"scene_path": scene_path})
    except Exception as e:
        logger.error(f"[scene_grid] 查询记录失败: {e}")
        return None

    if not doc:
        logger.warning(f"[scene_grid] 记录不存在: {scene_path}")
        return None

    image_url = doc.get("image_url", "")
    if not image_url:
        logger.error("[scene_grid] 记录缺少 image_url")
        return None

    # Download image from OSS
    try:
        with urlopen(image_url, timeout=30) as resp:
            image_bytes = resp.read()
    except Exception as e:
        logger.error(f"[scene_grid] 下载图片失败: {e}")
        return None

    # Recognize all items
    words = recognize_scene(image_bytes)
    if not words:
        logger.error("[scene_grid] 重新识别失败，未获取到物品")
        return None

    # Enrich with phonetic and examples
    words = enrich_scene_words(words)

    # Update database
    try:
        await db.scene_grids.update_one(
            {"_id": doc["_id"]},
            {"$set": {"words": words}},
        )
        logger.info(f"[scene_grid] 重新标注完成: {scene_path}")
    except Exception as e:
        logger.error(f"[scene_grid] 保存标注结果失败: {e}")
        return None

    doc["_id"] = str(doc["_id"])
    doc["words"] = words
    return doc


# ── Upload annotated image ──────────────────────────────────────────

async def upload_annotated_scene(
    scene_path: list[str],
    image_data: bytes,
) -> str | None:
    """Upload an annotated scene image to OSS and update the DB record.

    Only stores the annotated image URL; does NOT overwrite words.
    Returns the annotated image URL on success, None on failure.
    """
    from db import db

    bucket = _get_bucket()
    if not bucket:
        logger.error("[scene_grid] OSS bucket not available")
        return None

    oss_key = f"assets/scenes/{'/'.join(scene_path)}_annotated.jpg"
    url = f"https://{OSS_BUCKET}.{OSS_ENDPOINT}/{oss_key}"

    try:
        bucket.put_object(oss_key, image_data)
        logger.info(f"[scene_grid] 标注图上传成功: {oss_key}")
    except Exception as e:
        logger.error(f"[scene_grid] 标注图上传失败: {e}")
        return None

    if db is not None:
        try:
            await db.scene_grids.update_one(
                {"scene_path": scene_path},
                {"$set": {
                    "annotated_url": url,
                    "annotated_oss_key": oss_key,
                }},
            )
            logger.info(f"[scene_grid] 标注记录已更新: {scene_path}")
        except Exception as e:
            logger.error(f"[scene_grid] 更新标注记录失败: {e}")

    return url


# ── Search by word ──────────────────────────────────────────────────

async def search_scenes_by_word(word: str) -> list[dict]:
    """Find all scene_grid records that contain the given word."""
    from db import db

    if db is None:
        logger.error("[scene_grid] MongoDB 未连接")
        return []

    try:
        cursor = db.scene_grids.find(
            {"words.word": word.lower()},
            {"scene_path": 1, "annotated_url": 1,
             "image_url": 1, "words": 1}
        ).limit(20)
        records = await cursor.to_list(length=20)
        for rec in records:
            rec["_id"] = str(rec["_id"])
            img = rec.get("annotated_url") or rec.get("image_url", "")
            if img:
                rec["thumbnail_url"] = _make_thumbnail_url(img)
        return records
    except Exception as e:
        logger.error(f"[scene_grid] 按词搜索失败: {e}")
        return []


# ── MongoDB record ──────────────────────────────────────────────────

async def save_scene_record(
    scene_path: list[str],
    image_url: str,
    oss_key: str,
    words: list[dict],
) -> bool:
    """Save a scene record to the scene_grids collection.

    Returns True on success, False on failure.
    """
    from db import db

    if db is None:
        logger.error("[scene_grid] MongoDB 未连接，无法保存记录")
        return False

    doc = {
        "scene_path": scene_path,
        "scene_path_str": "/".join(scene_path),
        "image_url": image_url,
        "oss_key": oss_key,
        "words": words,
        "created_at": datetime.now(timezone.utc),
    }

    try:
        await db.scene_grids.insert_one(doc)
        logger.info(f"[scene_grid] 记录已保存: scene_path={scene_path}")
        return True
    except Exception as e:
        logger.error(f"[scene_grid] 保存记录失败: {e}")
        return False


# ── Indexes ─────────────────────────────────────────────────────────

async def ensure_scene_grids_indexes() -> None:
    """Ensure scene_grids collection exists (no unique index — dedup handled in app logic)."""
    from db import db

    if db is None:
        logger.error("[scene_grid] MongoDB 未连接，无法创建索引")
        return

    try:
        # Drop old unique index if it exists
        try:
            await db.scene_grids.drop_index("scene_grids_unique_idx")
            logger.info("[scene_grid] 已删除旧索引")
        except Exception:
            pass

        logger.info("[scene_grid] 索引初始化完成")
    except Exception as e:
        logger.error(f"[scene_grid] 索引初始化失败: {e}")


# ── Scene tree ──────────────────────────────────────────────────────

async def get_scene_tree() -> list[dict]:
    """Query all scene_grids records and build a tree structure.

    Returns a list of top-level scene nodes (parent scenes), each with name, path, children, scenes.
    """
    from db import db

    if db is None:
        logger.error("[scene_grid] MongoDB 未连接，无法查询")
        return []

    try:
        cursor = db.scene_grids.find({})
        records = await cursor.to_list(length=None)
    except Exception as e:
        logger.error(f"[scene_grid] 查询记录失败: {e}")
        return []

    # Build tree: key is tuple(scene_path), value is node dict
    tree: dict[tuple[str, ...], dict] = {}

    for rec in records:
        path: list[str] = rec.get("scene_path", [])
        if not path:
            continue

        scene_entry = {
            "image_url": rec.get("image_url", ""),
            "thumbnail_url": _make_thumbnail_url(rec.get("image_url", "")),
            "oss_key": rec.get("oss_key", ""),
            "word_count": len(rec.get("words", [])),
            "words": [{"word": w["word"]} for w in rec.get("words", [])],
        }

        # Ensure every prefix of path exists as a node
        for i in range(1, len(path) + 1):
            prefix = tuple(path[:i])
            if prefix not in tree:
                tree[prefix] = {
                    "name": path[i - 1],
                    "path": list(path[:i]),
                    "children": [],
                    "scenes": [],
                }

        # Add scene to the leaf node (full path)
        leaf_key = tuple(path)
        if leaf_key in tree:
            tree[leaf_key]["scenes"].append(scene_entry)

    # Build parent-child relationships
    for key_tuple, node in tree.items():
        if len(key_tuple) > 1:
            parent_key = key_tuple[:-1]
            if parent_key in tree:
                parent = tree[parent_key]
                if node not in parent["children"]:
                    parent["children"].append(node)

    # Return only root nodes (path length == 1)
    roots = [node for key, node in tree.items() if len(key) == 1]
    return roots