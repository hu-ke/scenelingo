# Qwen 九宫格文生图脚本 Spec

## Why
为 scenelingo 应用提供一个后端脚本，利用 Qwen 文生图模型批量生成同一类别物品的九宫格图片，用于学习场景中的词汇展示（如水果、衣服等类别）。

## What Changes
- 新增后端脚本 `backend/scripts/generate_grids.py`，接收类别名称，调用 Qwen 模型生成多张九宫格图片
- 脚本使用 Qwen 文本模型生成物品列表，再调用 Qwen 文生图模型逐项生成单品图，最后用 Pillow 拼接为 3×3 九宫格
- 选型策略：文本模型用 `qwen-plus`（高性价比），文生图用 `qwen-image-plus`（质量与费用平衡），单品图尺寸 512×512 以控制成本
- 支持自定义参数：生成 n 张九宫格（默认 2）、输出目录、每格尺寸等
- 输出图片保存到指定目录，文件名包含类别和时间戳

## Impact
- Affected specs: 无（新功能，不修改已有功能）
- Affected code: 
  - 新增 `backend/scripts/generate_grids.py`
  - 可能在 `backend/requirements.txt` 中新增 `requests` 依赖（如尚未直接依赖）

## ADDED Requirements

### Requirement: 物品列表生成
系统 SHALL 根据用户输入的类别名称（如"水果"、"衣服"），调用 Qwen 文本模型生成该类别下不重复的物品名称列表，数量等于 `九宫格数量 × 9`。

#### Scenario: 正常生成物品列表
- **WHEN** 用户输入类别"水果"，要求生成 2 张九宫格
- **THEN** 系统调用 qwen-plus 模型，返回 18 个不重复的水果名称（如苹果、梨、葡萄等）

#### Scenario: 类别物品不足以填满
- **WHEN** 用户输入一个物品数量较少的类别（如"行星"），要求生成 2 张九宫格
- **THEN** 系统尽量生成尽可能多的不重复物品名称，若不足 18 个则按实际数量生成

### Requirement: 单品图片生成
系统 SHALL 根据物品列表，逐项调用 Qwen 文生图模型 `qwen-image-plus` 生成每个物品的单品展示图片，尺寸为 512×512。

#### Scenario: 正常生成单品图
- **WHEN** 需要为"苹果"生成图片
- **THEN** 系统调用 qwen-image-plus 模型，传入 prompt "A clean product photo of a single apple on a white background"，获得苹果图片

#### Scenario: API 调用失败重试
- **WHEN** 某次图片生成 API 调用失败
- **THEN** 系统进行最多 3 次重试，间隔逐次递增（1s/2s/4s），全部失败后跳过该物品并记录日志

### Requirement: 九宫格拼接
系统 SHALL 将每 9 张单品图片用 Pillow 拼接为一张 3×3 的九宫格大图，格子之间保留 4px 白色间隔边框。

#### Scenario: 正常拼接九宫格
- **WHEN** 9 张 512×512 的单品图生成完毕
- **THEN** 系统拼接为一张 1544×1544（含间距）的九宫格图片

#### Scenario: 单品图数量不足 9 张
- **WHEN** 最后一组仅有不足 9 张单品图
- **THEN** 空位用纯白占位图填充，保持 3×3 布局

### Requirement: CLI 接口
系统 SHALL 提供命令行接口，支持以下参数：
- `category`（必填）：类别名称，如"水果"
- `--num-grids`（可选，默认 2）：生成九宫格的数量
- `--output-dir`（可选，默认 `./output`）：输出目录
- `--cell-size`（可选，默认 512）：每格单品图边长（像素）

#### Scenario: 命令行基本用法
- **WHEN** 执行 `python generate_grids.py 水果`
- **THEN** 生成 2 张九宫格图片，保存到 `./output/` 目录

#### Scenario: 自定义参数
- **WHEN** 执行 `python generate_grids.py 衣服 --num-grids 1 --output-dir ./clothes --cell-size 256`
- **THEN** 生成 1 张九宫格图片，每格 256×256，保存到 `./clothes/` 目录

### Requirement: 日志输出
系统 SHALL 使用 loguru 输出关键步骤日志，包括物品列表、每张图片生成进度、拼接完成、总耗时等信息，便于调试和进度追踪。

#### Scenario: 进度日志
- **WHEN** 正在生成第 3/18 张单品图
- **THEN** 终端输出带序号的进度信息，如"正在生成第 3/18 个物品[苹果]的图片..."
