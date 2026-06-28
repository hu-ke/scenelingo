#!/usr/bin/env python3
"""Scene Skill — reusable pipeline for generating scene photos."""

import sys, os, time, asyncio
from io import BytesIO
from loguru import logger

from dotenv import load_dotenv
load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_db
from shared.scene_grid import (
    upload_scene_to_oss, recognize_scene, enrich_scene_words,
    save_scene_record, ensure_scene_grids_indexes
)


async def generate_scene(scene_path: list[str]) -> dict | None:
    """
    Full pipeline: generate scene photo → upload OSS → recognize → enrich → save DB.

    Args:
        scene_path: e.g. ["airport", "runway"]

    Returns:
        {"image_url": "...", "oss_key": "...", "words": [...]} or None on failure
    """
    start_time = time.time()

    # Ensure MongoDB connection
    await get_db()

    # Ensure indexes exist
    await ensure_scene_grids_indexes()

    # Check if scene already exists
    from db import db
    if db is not None:
        try:
            existing = await db.scene_grids.find_one({"scene_path": scene_path})
            if existing:
                logger.info(f"场景 {scene_path} 已存在，跳过生成")
                return None
        except Exception as e:
            logger.warning(f"查询已有记录失败: {e}")

    # Build scene description for prompt
    child = scene_path[1] if len(scene_path) > 1 else scene_path[0]
    scene_name = child.replace("_", " ")

    logger.info(f"开始生成场景: {scene_path}, 场景名: {scene_name}")

    # Step 1: Generate scene photo using qwen-image-plus
    # We use generate_single_image but with a scene prompt instead of a single item
    from scripts.generate_grids import _get_api_key
    from urllib.request import urlopen
    from PIL import Image as PILImage

    api_key = _get_api_key()

    prompt = (
        f"A realistic photograph of a {scene_name} scene, "
        f"filled with many typical objects and items commonly found in this environment. "
        f"Warm cream background tone (#fef8ed), studio lighting, high quality, "
        f"no text, no watermark. The scene should show a wide view with many recognizable objects."
    )

    import requests
    DASHSCOPE_IMAGE_API = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis"
    payload = {
        "model": "qwen-image-plus",
        "input": {"prompt": prompt},
        "parameters": {
            "size": "1328*1328",
            "n": 1,
            "prompt_extend": True,
            "watermark": False,
        },
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
    }

    try:
        # Submit task
        r = requests.post(DASHSCOPE_IMAGE_API, headers=headers, json=payload, timeout=120)
        r.raise_for_status()
        data = r.json()
        task_id = data.get("output", {}).get("task_id")
        if not task_id:
            logger.error(f"场景生成失败: 未获取到 task_id, {data}")
            return None

        logger.info(f"场景生成任务已提交: {task_id}")

        # Poll for result
        DASHSCOPE_TASK_API = "https://dashscope.aliyuncs.com/api/v1/tasks"
        deadline = time.time() + 120
        while time.time() < deadline:
            time.sleep(3)
            r2 = requests.get(f"{DASHSCOPE_TASK_API}/{task_id}", headers=headers, timeout=30)
            r2.raise_for_status()
            task_data = r2.json()
            status = task_data.get("output", {}).get("task_status", "")
            if status == "SUCCEEDED":
                results = task_data.get("output", {}).get("results", [])
                if results:
                    image_url = results[0].get("url")
                    if image_url:
                        # Download the image
                        with urlopen(image_url, timeout=60) as resp:
                            img = PILImage.open(BytesIO(resp.read()))
                            img = img.convert("RGB")
                            # Convert to bytes
                            buf = BytesIO()
                            img.save(buf, format="JPEG", quality=95)
                            image_bytes = buf.getvalue()
                        break
                    else:
                        logger.error("场景生成结果中无 URL")
                        return None
            elif status == "FAILED":
                logger.error(f"场景生成任务失败: {task_data.get('output', {}).get('message', '')}")
                return None
        else:
            logger.error(f"场景生成任务超时: {task_id}")
            return None

    except Exception as e:
        logger.error(f"场景生成失败: {e}")
        return None

    # Step 2: Upload to OSS
    upload_result = upload_scene_to_oss(scene_path, image_bytes)
    if upload_result is None:
        logger.error(f"场景 {scene_path} OSS 上传失败")
        return None

    image_url = upload_result["url"]
    oss_key = upload_result["oss_key"]
    logger.info(f"场景已上传: {image_url}")

    # Step 3: Recognize items in scene
    words = recognize_scene(image_bytes)
    logger.info(f"场景识别结果: {len(words)} 个物品")

    # Step 4: Enrich words
    words = enrich_scene_words(words)
    logger.info(f"场景单词已丰富: {len(words)} 个")

    # Step 5: Save to MongoDB
    await save_scene_record(scene_path, image_url, oss_key, words)

    elapsed = time.time() - start_time
    logger.info(f"场景生成完成! 耗时 {elapsed:.1f}s, 识别 {len(words)} 个物品")

    return {
        "image_url": image_url,
        "oss_key": oss_key,
        "words": words,
    }


# CLI entry point
async def _main():
    import argparse
    parser = argparse.ArgumentParser(description="Scene Skill")
    parser.add_argument("scene_path", type=str, help='Scene path, e.g. "airport,runway"')
    args = parser.parse_args()

    scene_path = [s.strip() for s in args.scene_path.split(",") if s.strip()]
    result = await generate_scene(scene_path)
    if result:
        print(f"\nDone: {result['image_url']}")
        print(f"Words: {len(result['words'])}")
    else:
        print("\nScene already exists or generation failed")


if __name__ == "__main__":
    asyncio.run(_main())