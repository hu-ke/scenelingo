# Tasks

- [x] Task 1: 创建目录结构和脚本骨架
  - [x] 创建 `backend/scripts/` 目录，添加 `__init__.py`
  - [x] 创建 `backend/scripts/generate_grids.py` 骨架文件，包含命令行参数解析（argparse）和 main 函数入口
  - [x] 引入项目现有的 loguru 日志配置

- [x] Task 2: 实现物品列表生成接口
  - [x] 复用 `shared/client.py` 的 OpenAI 客户端调用 `qwen-plus` 模型
  - [x] 编写 prompt，让模型返回 JSON 数组格式的物品名称列表
  - [x] 实现 `generate_item_list(category, count)` 函数，解析模型返回并校验

- [x] Task 3: 实现单品图片生成接口
  - [x] 通过 DashScope REST API 调用 `qwen-image-plus` 文生图模型
  - [x] 实现 `generate_single_image(item_name, cell_size)` 函数，传入英文 prompt 生成单品图
  - [x] 实现重试逻辑（最多 3 次，间隔 1s/2s/4s）
  - [x] 处理 DashScope 返回的图片 URL，下载图片数据

- [x] Task 4: 实现九宫格拼接
  - [x] 实现 `stitch_grid(images, cell_size, gap=4)` 函数，用 Pillow 将 9 张图拼为 3×3 九宫格
  - [x] 处理单品图不足 9 张的情况，空位用白色占位图填充
  - [x] 保存最终图片到输出目录，文件名格式：`{category}_grid{n}_{timestamp}.jpg`

- [x] Task 5: 串联完整流程并测试
  - [x] 在 main 函数中串联：解析参数 → 生成物品列表 → 逐项生成单品图 → 拼接九宫格 → 输出
  - [x] 添加步骤进度日志和总耗时统计
  - [x] 本地运行验证：`python generate_grids.py 水果` 确认能正常生成图片

# Task Dependencies
- Task 2 依赖 Task 1（需要先有脚本骨架和项目结构）
- Task 3 依赖 Task 1
- Task 4 依赖 Task 3（需要单品图才能拼接）
- Task 5 依赖 Task 2、3、4
