#!/usr/bin/env python3
"""Seed script: generate scene photos for predefined scenes and upload to CDN."""

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

from scripts.scene_skill import generate_scene

# Predefined scenes: [scene_path, display_name]
SCENES = [
    # Airport scenes
    (["airport", "waiting_room"], "机场-候机室"),
    (["airport", "runway"], "机场-跑道"),
    (["airport", "airplane_interior"], "机场-飞机内部"),
    (["airport", "baggage_claim"], "机场-行李提取处"),
    # School scenes
    (["school", "classroom"], "学校-教室"),
    (["school", "playground"], "学校-操场"),
    (["school", "library"], "学校-图书馆"),
    (["school", "cafeteria"], "学校-食堂"),
]

async def main():
    logger.info("===== 开始生成场景种子数据 =====")
    for scene_path, display_name in SCENES:
        logger.info(f"\n----- 处理场景: {display_name} ({scene_path}) -----")
        result = await generate_scene(scene_path)
        if result:
            logger.info(f"场景 {display_name} 完成: {result['image_url']}")
        else:
            logger.info(f"场景 {display_name} 已存在或生成失败，跳过")

    logger.info("\n===== 场景种子数据生成完成 =====")


if __name__ == "__main__":
    asyncio.run(main())