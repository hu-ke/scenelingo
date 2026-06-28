#!/usr/bin/env python3
"""
Migration script: re-annotate all historical category_grids records.

- Re-recognizes grid images with bbox coordinates (0-1000 range)
- Enriches words with phonetic transcriptions and example sentences
- Updates the database records in-place

Usage:
    cd backend && python -m scripts.migrate_category_grids
"""

import asyncio
import os
import sys

from dotenv import load_dotenv
from loguru import logger

load_dotenv()

# Allow importing from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_db  # noqa: E402
from shared.category_grid import re_annotate_grid  # noqa: E402


async def main():
    logger.info("===== 开始迁移历史 category_grids 数据 =====")

    # Connect to MongoDB
    database = await get_db()
    if database is None:
        logger.error("MongoDB 连接失败，迁移终止")
        return

    # Find all records
    cursor = database.category_grids.find({})
    records = await cursor.to_list(length=None)
    logger.info(f"共找到 {len(records)} 条记录")

    total = len(records)
    success = 0
    skipped = 0
    failed = 0

    for i, rec in enumerate(records, 1):
        category_path = rec.get("category_path", [])
        grid_index = rec.get("grid_index", 1)
        words = rec.get("words", [])

        # Check if already has bbox data
        has_bbox = any(
            w.get("bbox") and any(v > 0 for v in w["bbox"])
            for w in words
        )
        if has_bbox:
            logger.info(
                f"[{i}/{total}] 跳过 {category_path}/{grid_index} (已有 bbox 数据)"
            )
            skipped += 1
            continue

        logger.info(f"[{i}/{total}] 重新标注 {category_path}/{grid_index} ...")
        try:
            result = await re_annotate_grid(category_path, grid_index)
            if result:
                success += 1
                logger.info(
                    f"[{i}/{total}] 成功: {category_path}/{grid_index} "
                    f"({len(result.get('words', []))} 个物品)"
                )
            else:
                failed += 1
                logger.error(f"[{i}/{total}] 失败: {category_path}/{grid_index}")
        except Exception as e:
            failed += 1
            logger.error(f"[{i}/{total}] 异常: {category_path}/{grid_index} - {e}")

    logger.info("===== 迁移完成 =====")
    logger.info(f"总计: {total}, 成功: {success}, 跳过: {skipped}, 失败: {failed}")


if __name__ == "__main__":
    asyncio.run(main())