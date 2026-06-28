#!/usr/bin/env python3
"""
CLI script that generates 3×3 grid images (九宫格) of similar items
using Qwen models on DashScope.
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
from io import BytesIO
from urllib.request import urlopen

import requests
from loguru import logger

from dotenv import load_dotenv
load_dotenv()

# Allow running from the backend directory or directly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.client import get_client

# ── Logging setup (consistent with main.py) ─────────────────────────
logger.remove()
logger.add(
    lambda msg: print(msg, end=""),
    format="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <level>{message}</level>",
    level="DEBUG",
    colorize=True,
)


# ── Constants ───────────────────────────────────────────────────────
DASHSCOPE_IMAGE_API = (
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis"
)
DASHSCOPE_TASK_API = "https://dashscope.aliyuncs.com/api/v1/tasks"
# qwen-image-plus async API only supports these fixed sizes; pick the square one
IMAGE_SIZE = "1328*1328"
MAX_RETRIES = 3
TASK_POLL_INTERVAL = 3  # seconds between polling task status


def _get_api_key() -> str:
    key = os.environ.get("DASHSCOPE_API_KEY", "")
    if not key:
        raise RuntimeError("DASHSCOPE_API_KEY environment variable is not set")
    return key


# ── Function 1: generate item list ──────────────────────────────────

def generate_item_list(category: str, count: int) -> list[str]:
    """Use qwen-plus to generate a list of *count* non-repeating item names in *category*.

    The LLM is instructed to return English names so the image-generation prompt
    works well.
    """
    client = get_client()
    prompt = (
        f"Generate a JSON array of {count} distinct, non-repeating items in the "
        f'category "{category}".  Return ONLY a valid JSON array of strings — no '
        f"extra text, no markdown fences, no explanation.  Each item name must be "
        f"in English (lowercase, e.g. \"apple\", \"t-shirt\")."
    )

    logger.info(f"正在生成 {count} 个 [{category}] 类别的物品列表...")

    try:
        resp = client.chat.completions.create(
            model="qwen-plus",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
        raw = resp.choices[0].message.content.strip()

        # Remove markdown fences if present
        if raw.startswith("```"):
            raw = raw.lstrip("`").strip()
            if raw.startswith("json"):
                raw = raw[4:].strip()
        if raw.endswith("```"):
            raw = raw[:-3].strip()

        items = json.loads(raw)
        if not isinstance(items, list):
            raise ValueError("Response is not a list")

        items = [str(i).strip() for i in items if str(i).strip()]
        if len(items) < count:
            logger.warning(
                f"模型只返回了 {len(items)} 个物品，请求了 {count} 个"
            )

        logger.info(f"得到 {len(items)} 个物品: {items}")
        return items

    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"解析物品列表失败: {e}, 原始响应: {raw}")
        raise


# ── Function 2: async task helpers ──────────────────────────────────

def _submit_image_task(api_key: str, item_name: str) -> str:
    """Submit an async image-generation task, return task_id."""
    prompt = (
        f"A clean product photo of a single {item_name} on a white background, "
        f"studio lighting, high quality, centered, no text, no watermark"
    )
    payload = {
        "model": "qwen-image-plus",
        "input": {"prompt": prompt},
        "parameters": {
            "size": IMAGE_SIZE,
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
    r = requests.post(DASHSCOPE_IMAGE_API, headers=headers, json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    task_id = data.get("output", {}).get("task_id")
    if not task_id:
        raise ValueError(f"No task_id in response: {data}")
    return task_id


def _poll_task(task_id: str, api_key: str, max_wait: int = 120) -> dict:
    """Poll task status until SUCCEEDED or FAILED. Returns the result dict with 'url'."""
    url = f"{DASHSCOPE_TASK_API}/{task_id}"
    headers = {"Authorization": f"Bearer {api_key}"}
    deadline = time.time() + max_wait

    while time.time() < deadline:
        r = requests.get(url, headers=headers, timeout=30)
        r.raise_for_status()
        data = r.json()
        status = data.get("output", {}).get("task_status", "")

        if status == "SUCCEEDED":
            results = data.get("output", {}).get("results", [])
            if not results:
                raise ValueError("Task succeeded but no results found")
            image_url = results[0].get("url")
            if not image_url:
                raise ValueError(f"No URL in task result: {results[0]}")
            return {"url": image_url, "task_id": task_id}
        elif status == "FAILED":
            raise RuntimeError(
                f"Task failed: {data.get('output', {}).get('message', 'unknown')}"
            )
        elif status in ("PENDING", "RUNNING"):
            time.sleep(TASK_POLL_INTERVAL)
        else:
            raise RuntimeError(f"Unknown task status: {status}")

    raise TimeoutError(f"Task {task_id} did not complete within {max_wait}s")


# ── Function 3: generate a single image ─────────────────────────────

def generate_single_image(item_name: str, cell_size: int) -> "Image.Image | None":
    """Call DashScope async text-to-image API to produce one image of *item_name*.

    Submits an async task, polls for completion, downloads and resizes the result.
    Retries up to 3 times with exponential backoff (1s, 2s, 4s).
    Returns a PIL Image on success, or None on persistent failure.
    """
    from PIL import Image as PILImage

    api_key = _get_api_key()

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            task_id = _submit_image_task(api_key, item_name)
            result = _poll_task(task_id, api_key, max_wait=120)

            with urlopen(result["url"], timeout=60) as resp:
                img = PILImage.open(BytesIO(resp.read()))
                img = img.convert("RGB")
                img = img.resize((cell_size, cell_size), PILImage.LANCZOS)
                return img

        except Exception as e:
            logger.warning(
                f"生成图片 [{item_name}] 失败 (尝试 {attempt}/{MAX_RETRIES}): {e}"
            )
            if attempt < MAX_RETRIES:
                backoff = 2 ** (attempt - 1)  # 1, 2, 4
                time.sleep(backoff)

    logger.error(f"生成图片 [{item_name}] 彻底失败，已重试 {MAX_RETRIES} 次")
    return None


# ── Function 3: stitch grid ─────────────────────────────────────────

def stitch_grid(images: list["Image.Image"], cell_size: int, gap: int = 4) -> "Image.Image":
    """Arrange up to 9 PIL Images into a 3×3 grid on a white background.

    Each cell is *cell_size*×*cell_size* with *gap* px white gap between cells.
    Empty slots (if fewer than 9 images) remain white.
    """
    from PIL import Image as PILImage

    cols = 3
    rows = 3
    total_width = cell_size * cols + gap * (cols + 1)
    total_height = cell_size * rows + gap * (rows + 1)

    canvas = PILImage.new("RGB", (total_width, total_height), color=(255, 255, 255))

    for idx, img in enumerate(images):
        if idx >= 9:
            break
        row = idx // cols
        col = idx % cols
        x = gap + col * (cell_size + gap)
        y = gap + row * (cell_size + gap)
        canvas.paste(img, (x, y))

    return canvas


# ── Main ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="生成 3×3 九宫格图片",
    )
    parser.add_argument(
        "category",
        type=str,
        help='物品类别，例如 "水果"、"衣服"',
    )
    parser.add_argument(
        "--num-grids",
        type=int,
        default=2,
        help="生成多少个 3×3 九宫格 (默认 2)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./output",
        help="输出目录 (默认 ./output)",
    )
    parser.add_argument(
        "--cell-size",
        type=int,
        default=512,
        help="每个格子的像素尺寸 (默认 512)",
    )
    args = parser.parse_args()

    start_time = time.time()

    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)

    total_items = args.num_grids * 9
    logger.info(
        f"开始: 类别=[{args.category}], 九宫格数={args.num_grids}, "
        f"总物品数={total_items}, 格子尺寸={args.cell_size}px"
    )

    # Step 1: generate item list
    items = generate_item_list(args.category, total_items)
    total = len(items)

    # Step 2: generate images one by one
    images: list = []
    for i, item in enumerate(items, start=1):
        logger.info(f"正在生成第 {i}/{total} 个物品 [{item}] 的图片...")
        img = generate_single_image(item, args.cell_size)
        if img is None:
            logger.warning(f"跳过物品 [{item}]（图片生成失败）")
        images.append(img)

    # Filter out None images
    valid_images = [img for img in images if img is not None]

    if not valid_images:
        logger.error("没有成功生成任何图片，退出")
        sys.exit(1)

    # Step 3: group into chunks of 9 and stitch grids
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    for grid_idx in range(args.num_grids):
        start = grid_idx * 9
        chunk = valid_images[start : start + 9]
        if not chunk:
            break

        grid_image = stitch_grid(chunk, args.cell_size, gap=4)
        filename = f"{args.category}_grid{grid_idx + 1}_{timestamp}.jpg"
        filepath = os.path.join(args.output_dir, filename)
        grid_image.save(filepath, "JPEG", quality=95)
        logger.info(f"九宫格 #{grid_idx + 1} 已保存: {filepath}")

    # Summary
    elapsed = time.time() - start_time
    grids_generated = min(args.num_grids, (len(valid_images) + 8) // 9)
    logger.info(
        f"完成! 共生成 {grids_generated} 个九宫格, "
        f"成功图片 {len(valid_images)}/{total_items}, 耗时 {elapsed:.1f}s"
    )


if __name__ == "__main__":
    main()
