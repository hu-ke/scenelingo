# Tasks

- [x] Task 1: 修改 generate_grids.py 背景色和类目支持
  - [x] `stitch_grid()` 背景色从 `(255,255,255)` 改为 `(254,248,237)` (#fef8ed)
  - [x] 单品图 prompt 从 white background 改为 warm cream background
  - [x] `generate_item_list()` 的 category 参数支持通过 LLM 翻译为英文（用于 item 列表生成）
  - [x] 支持多级类目：取类目数组最后一级作为实际类别名传给 LLM

- [x] Task 2: 新增 shared/category_grid.py 共用逻辑
  - [x] `upload_grid_to_oss(category_path, grid_index, image_data)` — 上传到 `asset/category/{path}/` 
  - [x] `recognize_grid(image_data)` — 调用 qwen3-vl-plus 识别九宫格，返回单词和位置
  - [x] `save_grid_record(category_path, grid_index, image_url, oss_key, words)` — 写入 MongoDB
  - [x] `ensure_category_grids_indexes()` — 创建 `category_grids` 集合索引
  - [x] `get_category_tree()` — 构建类目树结构

- [x] Task 3: 新增 category_grid_skill.py Skill 主入口
  - [x] `generate_category_grid(category_path, num_grids, cell_size)` — 串联完整流程
  - [x] 流程：生成物品列表 → 生成单品图 → 拼接九宫格 → 上传 OSS → 识别标注 → 存 DB
  - [x] 返回结果列表，包含每张图片的 URL、单词、类目等信息

- [x] Task 4: 新增 category_grids_seed.py 种子脚本
  - [x] 预定义 4 个类目（水果 fruit、衣服 clothes + 蔬菜 vegetables、交通工具 vehicles）
  - [x] 每个类目 1 张九宫格
  - [x] 调用 Skill 的 `generate_category_grid()` 依次执行

- [x] Task 5: MongoDB 集合初始化
  - [x] 在 `db.py` 的 `init_db()` 中为 `category_grids` 创建索引（`category_path` + `grid_index` 唯一索引）

- [x] Task 6: 新增类目树 API 接口
  - [x] 在 `backend/main.py` 中添加 `GET /api/category-grids/tree` 路由
  - [x] 从 `category_grids` 集合查询所有记录，递归组装为树形结构
  - [x] 无需登录（无需 `require_auth`），匿名可访问

- [x] Task 7: 小程序新增卡片识词页面
  - [x] 创建 `miniprogram/src/pages/cards/index.tsx`、`index.scss`、`index.config.ts`
  - [x] 调用 `/api/category-grids/tree` 获取类目树并渲染
  - [x] 支持展开/收起多级类目，末级类目展示九宫格卡片
  - [x] 点击九宫格中的格子显示对应英文单词

- [x] Task 8: 小程序配置 Tab 菜单
  - [x] 在 `app.config.ts` 的 tabBar.list 中添加卡片识词（放在收藏夹和我的之间）
  - [x] 在 `custom-tab-bar/index.tsx` 的 TAB_LIST 中新增卡片识词 Tab 项

# Task Dependencies
- Task 2 依赖 Task 1（修改 generate_grids.py 后才能确定共用接口）
- Task 3 依赖 Task 1、Task 2（Skill 需要调用 generate_grids 和共用逻辑）
- Task 4 依赖 Task 3（种子脚本调用 Skill）
- Task 5 可与 Task 1-4 并行
- Task 6 依赖 Task 5（MongoDB 集合就绪后才能查询）
- Task 7 依赖 Task 6（API 接口就绪后前端才能调用）
- Task 8 依赖 Task 7（页面创建后才能配置路由）