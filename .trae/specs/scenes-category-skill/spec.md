# 场景分类 Skill Spec

## Why

当前系统仅支持物体（objects）分类的九宫格卡片生成，缺少场景（scenes）分类能力。场景分类帮助学生通过真实场景照片学习英语词汇，如"机场→候机室"场景中包含座椅、登机口、航班信息屏等大量相关物品，比单一物体分类更有沉浸感。

## What Changes

- 新增场景照片生成 Skill：与 objects 九宫格不同，每个子场景生成一张照片（非九宫格），照片中尽可能多地包含该场景的典型物品
- 场景层级结构：如 `机场 → 候机室`、`机场 → 跑道`、`学校 → 教室`、`学校 → 操场`，CDN 路径为 `assets/scenes/airport/runway.png`
- 场景照片也需进行识物标注（bbox + 英文单词），与 objects 逻辑一致
- **BREAKING**: 小程序「卡片识词」页面改为双 Tab 结构：场景（scenes）在前，物体（objects）在后，默认展开第一个 Tab 的第一项

## Impact

- Affected specs: `category-grid-skill`（场景逻辑复用类目体系，但数据结构不同）
- Affected code:
  - 新增 `backend/scripts/scene_skill.py`（场景生成 Skill 主入口）
  - 新增 `backend/scripts/scenes_seed.py`（预设场景种子脚本）
  - 新增 `backend/shared/scene_grid.py`（场景照片 OSS 上传、识别、DB 存储共用逻辑）
  - 修改 `backend/main.py`（新增场景 API 接口）
  - 修改 `backend/db.py`（新增 `scene_grids` 集合索引）
  - 修改 `miniprogram/src/pages/cards/index.tsx`（双 Tab 结构）
  - 修改 `miniprogram/src/pages/cards/index.scss`（Tab 样式）

## ADDED Requirements

### Requirement: 场景照片生成（单张，非九宫格）

系统 SHALL 支持场景分类的照片生成，每个子场景生成一张照片而非九宫格。照片 prompt 应描述该场景的典型环境，并要求尽可能多地包含该场景中可能出现的物品。

#### Scenario: 生成机场跑道场景

- **WHEN** 调用场景生成 Skill，scene_path 为 `["airport", "runway"]`
- **THEN** 系统生成一张包含跑道、飞机、地勤车辆等物品的机场跑道场景照片，上传到 `assets/scenes/airport/runway.jpg`

#### Scenario: 生成学校教室场景

- **WHEN** 调用场景生成 Skill，scene_path 为 `["school", "classroom"]`
- **THEN** 系统生成一张包含课桌、黑板、书包、文具等物品的教室场景照片

### Requirement: 场景层级结构与 CDN 路径

系统 SHALL 支持两级场景层级，如 `[parent_scene, child_scene]`。OSS 路径为 `assets/scenes/{parent}/{child}.jpg`。

#### Scenario: 单场景路径

- **WHEN** 场景路径为 `["airport", "waiting_room"]`
- **THEN** OSS 路径为 `assets/scenes/airport/waiting_room.jpg`

### Requirement: 场景照片识别标注

系统 SHALL 使用 qwen3-vl-plus 识别场景照片中的所有物品，返回 bbox 坐标、英文单词、中文翻译、音标和例句。识别结果存入 MongoDB 的 `scene_grids` 集合。

#### Scenario: 识别场景照片

- **WHEN** 传入一张机场候机室场景照片
- **THEN** 模型返回物品列表，包含 `word`、`bbox`、`chinese`、`phonetic`、`examples`

### Requirement: 重复场景避免

系统 SHALL 在生成场景前查询 `scene_grids` 集合，若该场景路径已存在记录则跳过生成。同时从已有记录中提取所有已用物品名，传给 LLM 要求排除，避免新场景照片中出现重复物品（跨场景的通用物品除外，如"椅子"可在多个场景中出现）。

#### Scenario: 场景已存在

- **WHEN** 再次为 `["airport", "runway"]` 生成场景
- **THEN** 检测到已有记录，跳过生成

### Requirement: 场景种子脚本

系统 SHALL 提供 `scenes_seed.py`，预设至少 2 个父场景（如机场、学校），每个父场景下至少 2 个子场景，每个子场景生成 1 张照片。

#### Scenario: 执行种子脚本

- **WHEN** 运行 `python scripts/scenes_seed.py`
- **THEN** 依次为机场（候机室、跑道、飞机内部、行李提取处）和学校（教室、操场、图书馆、食堂）生成场景照片并上传 CDN

### Requirement: 场景数据存储

系统 SHALL 在 MongoDB 中新增 `scene_grids` 集合，字段包括：

- `scene_path`: 场景路径数组，如 `["airport", "runway"]`
- `image_url`: CDN 图片 URL
- `annotated_url`: 标注后的 CDN URL（可选）
- `oss_key`: OSS 对象 key
- `words`: 识别出的物品列表，每个包含 `word`、`bbox`、`row`、`col`、`chinese`、`phonetic`、`examples`
- `created_at`: 创建时间

### Requirement: 场景 API 接口

系统 SHALL 提供以下 API 接口：

- `GET /api/scene-grids/tree` — 返回场景树结构（匿名访问）
- `GET /api/scene-grids/detail?scene_path=airport,runway` — 返回场景详情含音标例句
- `POST /api/scene-grids/re-annotate` — 重新识别场景照片
- `POST /api/scene-grids/upload-annotated` — 上传标注后的图片

### Requirement: 小程序双 Tab 结构

小程序「卡片识词」页面 SHALL 改为双 Tab 结构：场景（scenes）Tab 在前，物体（objects）Tab 在后。两个 Tab 共用类目树展开的 UI 模式，但分别调用不同 API。进入页面时默认展开第一个 Tab 的第一项。

#### Scenario: 场景 Tab 渲染

- **WHEN** 用户进入卡片识词页面，场景 Tab 默认选中
- **THEN** 调用 `/api/scene-grids/tree` 获取场景树，渲染为可展开的层级列表，默认展开第一项，点击缩略图进入详情页

#### Scenario: 物体 Tab 渲染

- **WHEN** 用户切换到物体 Tab
- **THEN** 调用 `/api/category-grids/tree` 获取物体类目树，渲染逻辑与原来一致，默认展开第一项

## MODIFIED Requirements

### Requirement: 卡片识词页面结构

原卡片识词页面为单列表结构，现改为双 Tab 结构（场景/物体），两个 Tab 独立加载数据，共用展开/收起和详情跳转逻辑。详情页复用现有 `card-detail` 页面，根据来源类型（scene/object）调用不同的详情 API。