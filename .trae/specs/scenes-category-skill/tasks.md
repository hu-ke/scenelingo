# Tasks

- [x] Task 1: 新增 shared/scene_grid.py 共用逻辑
  - [x] `generate_scene_photo(scene_path, scene_prompt)` — 调用 qwen-image-plus 生成单张场景照片（非九宫格），prompt 要求尽可能多地包含典型物品，背景 #fef8ed
  - [x] `upload_scene_to_oss(scene_path, image_data)` — 上传到 `assets/scenes/{parent}/{child}.jpg`
  - [x] `recognize_scene(image_data)` — 调用 qwen3-vl-plus 识别照片中所有物品，返回 bbox 坐标 + 英文单词
  - [x] `enrich_scene_words(words)` — 批量补充 chinese + phonetic + examples（复用 category_grid 中的 enrich_word_details 逻辑）
  - [x] `save_scene_record(scene_path, image_url, oss_key, words)` — 写入 MongoDB scene_grids 集合
  - [x] `ensure_scene_grids_indexes()` — 创建 scene_grids 集合索引
  - [x] `get_scene_tree()` — 构建场景树结构（parent → children 层级）
  - [x] `get_scene_detail(scene_path)` — 查询单张场景详情，补充音标/例句
  - [x] `search_scenes_by_word(word)` — 按单词搜索关联场景

- [x] Task 2: 新增 scene_skill.py Skill 主入口
  - [x] `generate_scene(scene_path)` — 串联完整流程：生成照片 → 上传 OSS → 识别标注 → 存 DB
  - [x] 生成前查 DB，若 scene_path 已存在则跳过
  - [x] 支持 CLI 调用：`python -m scripts.scene_skill "airport,runway"`

- [x] Task 3: 新增 scenes_seed.py 种子脚本
  - [x] 预设机场场景：候机室(waiting_room)、跑道(runway)、飞机内部(airplane_interior)、行李提取处(baggage_claim)
  - [x] 预设学校场景：教室(classroom)、操场(playground)、图书馆(library)、食堂(cafeteria)
  - [x] 每个子场景生成 1 张照片
  - [x] 已存在的场景自动跳过

- [x] Task 4: MongoDB 索引
  - [x] 在 db.py 中为 scene_grids 添加 `scene_path` 唯一索引

- [x] Task 5: 后端 API 接口
  - [x] `GET /api/scene-grids/tree` — 返回场景树，含缩略图 URL
  - [x] `GET /api/scene-grids/detail?scene_path=airport,runway` — 返回场景详情含音标例句
  - [x] `POST /api/scene-grids/re-annotate` — 重新识别场景照片
  - [x] `POST /api/scene-grids/upload-annotated` — 上传标注后的图片
  - [x] `GET /api/scene-grids/search?word=xxx` — 按词搜索关联场景

- [x] Task 6: 小程序卡片识词页面改为双 Tab
  - [x] 新增 Tab 切换栏：场景（scenes）在前，物体（objects）在后
  - [x] 场景 Tab 调用 `/api/scene-grids/tree` 渲染场景树
  - [x] 物体 Tab 调用 `/api/category-grids/tree` 渲染物体类目树（原逻辑）
  - [x] 两个 Tab 默认展开第一项
  - [x] 场景缩略图点击跳转到详情页（复用 card-detail 页面，根据类型调用不同 API）
  - [x] Tab 样式（暖色调，与现有设计一致）

# Task Dependencies
- Task 2 依赖 Task 1（Skill 需要共用逻辑）
- Task 3 依赖 Task 2（种子脚本调用 Skill）
- Task 4 可与 Task 1-3 并行
- Task 5 依赖 Task 1、Task 4（共用逻辑和 DB 就绪后提供 API）
- Task 6 依赖 Task 5（API 接口就绪后前端调用）