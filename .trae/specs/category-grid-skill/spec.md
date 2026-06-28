# 类目九宫格 Skill Spec

## Why

为 scenelingo 提供可复用的类目九宫格图片生成能力，将 Qwen 文生图、OSS 上传、识物标注、MongoDB 存储整合为一个 Skill，支持多级类目（如"哺乳类-陆地-猫科"），后续可灵活扩展新类目。

## What Changes

* 修改 `generate_grids.py`：背景色从 `#ffffff` 改为 `#fef8ed`，支持多级类目参数

* 新增 OSS 上传到 `asset/category/{path}/1.png`，`{path}` 为多级目录（如 `mammal/land/feline`）

* 新增九宫格识别能力：用现有 qwen3-vl-plus 识别九宫格中每个格子的物品，标记英文单词和位置

* 新增 MongoDB 集合 `category_grids`，存储图片 URL、单词、位置、类目路径

* 新增 Skill 脚本 `backend/scripts/category_grid_skill.py`，封装生成→上传→识别→存储全流程

* 预设 4 个类目：水果、衣服、再加 2 个新类目，每个 1 张九宫格

* 类目以数组存储（支持多级），如 `["哺乳类", "陆地", "猫科"]`

* 新增 API 接口 `GET /api/category-grids/tree`，返回类目树结构供小程序使用

* 小程序新增「卡片识词」Tab 页面，按类目目录树渲染九宫格卡片

## Impact

* Affected specs: `qwen-grid-image-generator`（背景色、多级类目、功能扩展）

* Affected code:

  * 修改 `backend/scripts/generate_grids.py`（背景色、多级类目支持）

  * 新增 `backend/scripts/category_grid_skill.py`（Skill 主入口）

  * 新增 `backend/scripts/category_grids_seed.py`（预设类目种子脚本）

  * 新增 `backend/shared/category_grid.py`（OSS 上传、识别、DB 存储共用逻辑）

  * 修改 `backend/main.py`（新增 API 接口）

  * 新增 MongoDB 集合 `category_grids` 及索引

  * 新增 `miniprogram/src/pages/cards/index`（卡片识词页面）

  * 修改 `miniprogram/src/app.config.ts`（新增 Tab 页面和菜单项）

  * 修改 `miniprogram/src/custom-tab-bar/index.tsx`（新增 Tab 图标）

## ADDED Requirements

### Requirement: 背景色改为 #fef8ed

系统 SHALL 在九宫格拼接时使用 `#fef8ed`（暖米色）作为画布背景色，替代原来的白色 `#ffffff`。单品图的 prompt 中也应体现暖色背景。

#### Scenario: 背景色生效

* **WHEN** 生成一张九宫格图片

* **THEN** 格子之间的间隙和空白区域颜色为 `#fef8ed`（RGB: 254, 248, 237）

### Requirement: 多级类目支持

系统 SHALL 支持多级类目，类目以数组形式存储和传递，如 `["fruit"]` 或 `["mammal", "land", "feline"]`。类目数组映射到 OSS 路径为多级目录。

#### Scenario: 单级类目

* **WHEN** 类目为 `["fruit"]`，生成第 1 张九宫格

* **THEN** OSS 路径为 `asset/category/fruit/1.png`，DB 中 `category_path` 为 `["fruit"]`

#### Scenario: 多级类目

* **WHEN** 类目为 `["mammal", "land", "feline"]`，生成第 1 张九宫格

* **THEN** OSS 路径为 `asset/category/mammal/land/feline/1.png`，DB 中 `category_path` 为 `["mammal", "land", "feline"]`

### Requirement: OSS 上传

系统 SHALL 将生成的九宫格图片上传到 OSS 的 `asset/category/{path_segments}/` 路径下，文件名为 `{index}.jpg`（从 1 开始编号）。

#### Scenario: 上传成功

* **WHEN** 九宫格图片生成完毕

* **THEN** 图片被上传到 OSS，返回可访问的 CDN URL

#### Scenario: 上传失败

* **WHEN** OSS 上传失败

* **THEN** 记录错误日志，该图片标记为失败，不影响其他图片

### Requirement: 九宫格识别标注

系统 SHALL 使用现有的 qwen3-vl-plus 视觉模型识别九宫格图片中每个格子的物品，返回英文单词及对应位置（行列号）。

#### Scenario: 识别九宫格

* **WHEN** 传入一张 3×3 九宫格水果图片

* **THEN** 模型返回 9 个格子对应的英文单词，如 `[{"word": "apple", "row": 0, "col": 0}, {"word": "banana", "row": 0, "col": 1}, ...]`

#### Scenario: 识别结果不完整

* **WHEN** 模型返回的单词数量不足 9 个

* **THEN** 以实际返回为准，记录警告日志

### Requirement: MongoDB 存储

系统 SHALL 将每个九宫格图片的信息存入 MongoDB 的 `category_grids` 集合，包含以下字段：

* `category_path`: 类目数组，如 `["fruit"]` 或 `["mammal", "land", "feline"]`

* `grid_index`: 九宫格序号（从 1 开始）

* `image_url`: CDN 图片 URL

* `words`: 识别出的单词列表，每个包含 `word`、`row`、`col`

* `oss_key`: OSS 对象 key

* `created_at`: 创建时间

#### Scenario: 存储成功

* **WHEN** 九宫格图片已上传并识别完毕

* **THEN** 一条包含完整信息的记录被写入 `category_grids` 集合

### Requirement: Skill 封装

系统 SHALL 提供 `category_grid_skill.py` 作为可复用的 Skill，暴露 `generate_category_grid(category_path, num_grids, cell_size)` 函数，供其他脚本或服务调用。

#### Scenario: 调用 Skill

* **WHEN** 调用 `generate_category_grid(["fruit"], 1, 512)`

* **THEN** 完成生成→上传→识别→存储全流程，返回结果列表

### Requirement: 预设类目种子脚本

系统 SHALL 提供 `category_grids_seed.py` 种子脚本，预定义 4 个类目（水果、衣服 + 2 个新类目），每个 1 张九宫格，一键执行全部。

#### Scenario: 执行种子脚本

* **WHEN** 运行 `python category_grids_seed.py`

* **THEN** 依次为 4 个类目生成九宫格、上传 CDN、识别标注、写入数据库

