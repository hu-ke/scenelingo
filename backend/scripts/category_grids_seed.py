#!/usr/bin/env python3
"""Seed script: generate category grids for predefined categories and upload to CDN."""

import sys, os, asyncio
from loguru import logger

from dotenv import load_dotenv
load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Logging setup
logger.remove()
logger.add(
    lambda msg: print(msg, end=""),
    format="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <level>{message}</level>",
    level="DEBUG",
    colorize=True,
)

from scripts.category_grid_skill import generate_category_grid

# Predefined categories: [category_path, display_name]
CATEGORIES = [
    (["fruits"], "水果"),
    (["clothes"], "衣服"),
    (["vegetables"], "蔬菜"),
    (["vehicles"], "交通工具"),
]

async def main():
    logger.info("===== 开始生成类目九宫格种子数据 =====")
    for category_path, display_name in CATEGORIES:
        logger.info(f"\n----- 处理类目: {display_name} ({category_path}) -----")
        results = await generate_category_grid(category_path, num_grids=1, cell_size=512)
        if results:
            logger.info(f"类目 {display_name} 完成: {results[0]['image_url']}")
        else:
            logger.error(f"类目 {display_name} 失败!")
    
    logger.info("\n===== 种子数据生成完成 =====")

if __name__ == "__main__":
    asyncio.run(main())