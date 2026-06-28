#!/usr/bin/env python3
"""Category Grid Skill — reusable pipeline for generating category grid images."""

import sys, os, time, asyncio
from io import BytesIO
from loguru import logger

from dotenv import load_dotenv
load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_db
from scripts.generate_grids import generate_item_list, generate_single_image, stitch_grid
from shared.category_grid import (
    upload_grid_to_oss, recognize_grid, save_grid_record, ensure_category_grids_indexes
)

async def generate_category_grid(
    category_path: list[str],
    num_grids: int = 1,
    cell_size: int = 512,
) -> list[dict]:
    """
    Full pipeline: generate items → generate images → stitch grids → upload OSS → recognize → save DB.
    
    Args:
        category_path: e.g. ["fruit"] or ["mammal", "land", "feline"]
        num_grids: number of 3×3 grids to generate
        cell_size: pixel size of each cell
    
    Returns:
        list of result dicts: [{"grid_index": 1, "image_url": "...", "words": [...], "oss_key": "..."}]
    """
    start_time = time.time()
    
    # Ensure MongoDB connection
    await get_db()
    
    # Ensure indexes exist
    await ensure_category_grids_indexes()
    
    # ── DB checks: skip existing grids & collect used words ──────────
    from db import db
    existing_grids: list[int] = []
    used_words: set[str] = set()
    
    if db is not None:
        try:
            cursor = db.category_grids.find(
                {"category_path": category_path},
                {"grid_index": 1, "words.word": 1}
            )
            records = await cursor.to_list(length=None)
            for rec in records:
                existing_grids.append(rec.get("grid_index", 0))
                for w in rec.get("words", []):
                    word = (w.get("word") or "").strip().lower()
                    if word:
                        used_words.add(word)
        except Exception as e:
            logger.warning(f"查询已有记录失败: {e}")
    
    # Always generate num_grids new grids, starting from the next available index
    next_idx = (max(existing_grids) + 1) if existing_grids else 1
    grids_to_generate = list(range(next_idx, next_idx + num_grids))
    
    if used_words:
        logger.info(f"类目 {category_path}: 已有 {len(used_words)} 个单词，生成时将排除")
    
    # Extract the effective category name (last segment)
    effective_category = category_path[-1] if category_path else "items"
    
    total_items = num_grids * 9
    logger.info(
        f"开始 Skill: category_path={category_path}, effective={effective_category}, "
        f"num_grids={num_grids}, total_items={total_items}, cell_size={cell_size}px"
    )
    
    # Step 1: Generate item list (exclude already-used words)
    items = generate_item_list(effective_category, total_items, exclude=used_words)
    total = len(items)
    
    # Step 2: Generate single images
    images = []
    for i, item in enumerate(items, start=1):
        logger.info(f"正在生成第 {i}/{total} 个物品 [{item}] 的图片...")
        img = generate_single_image(item, cell_size)
        if img is None:
            logger.warning(f"跳过物品 [{item}]（图片生成失败）")
        images.append(img)
    
    valid_images = [img for img in images if img is not None]
    if not valid_images:
        logger.error("没有成功生成任何图片")
        return []
    
    # Step 3: Group into chunks of 9 and stitch grids
    results = []
    for i in range(num_grids):
        actual_grid_idx = grids_to_generate[i]
        start = i * 9
        chunk = valid_images[start:start + 9]
        if not chunk:
            break
        
        grid_image = stitch_grid(chunk, cell_size, gap=4)
        
        # Step 4: Convert to bytes and upload to OSS
        buf = BytesIO()
        grid_image.save(buf, format="JPEG", quality=95)
        image_bytes = buf.getvalue()
        
        upload_result = upload_grid_to_oss(category_path, actual_grid_idx, image_bytes)
        if upload_result is None:
            logger.error(f"九宫格 #{actual_grid_idx} OSS 上传失败")
            continue
        
        image_url = upload_result["url"]
        oss_key = upload_result["oss_key"]
        logger.info(f"九宫格 #{actual_grid_idx} 已上传: {image_url}")
        
        # Step 5: Recognize grid items
        words = recognize_grid(image_bytes)
        logger.info(f"九宫格 #{actual_grid_idx} 识别结果: {len(words)} 个单词")
        
        # Step 6: Save to MongoDB
        await save_grid_record(category_path, actual_grid_idx, image_url, oss_key, words)
        
        results.append({
            "grid_index": actual_grid_idx,
            "image_url": image_url,
            "oss_key": oss_key,
            "words": words,
        })
    
    elapsed = time.time() - start_time
    logger.info(f"Skill 完成! 共 {len(results)} 个九宫格, 耗时 {elapsed:.1f}s")
    return results


# CLI entry point for direct usage
async def _main():
    import argparse
    parser = argparse.ArgumentParser(description="Category Grid Skill")
    parser.add_argument("category_path", type=str, help='Category path, e.g. "fruit" or "mammal,land,feline"')
    parser.add_argument("--num-grids", type=int, default=1)
    parser.add_argument("--cell-size", type=int, default=512)
    args = parser.parse_args()
    
    category_path = [s.strip() for s in args.category_path.split(",") if s.strip()]
    results = await generate_category_grid(category_path, args.num_grids, args.cell_size)
    print(f"\nDone: {len(results)} grids generated")
    for r in results:
        print(f"  Grid #{r['grid_index']}: {r['image_url']}")

if __name__ == "__main__":
    asyncio.run(_main())