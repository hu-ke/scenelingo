# Tasks

- [x] Task 1: 后端异步识别任务管理
  - [x] 1.1 创建内存任务存储字典 `recognition_tasks: dict[str, dict]` 和线程锁
  - [x] 1.2 实现任务创建函数：生成 UUID task_id，初始化任务记录（status=pending），返回 task_id
  - [x] 1.3 实现后台异步处理函数 `process_image_task(task_id, image_bytes, native_lang, target_lang)`：将 status 更新为 processing，调用 Qwen VL 模型识别，成功则更新 status=completed 并存储 objects，失败则更新 status=failed 并存储 error
  - [x] 1.4 新增 `POST /api/recognize/async` 接口：接收单张图片上传，创建任务，通过 `asyncio.create_task` 启动后台处理，立即返回 `{task_id, status: "pending"}`
  - [x] 1.5 新增 `GET /api/recognize/status/{task_id}` 接口：根据 task_id 查询任务状态，已完成时返回 objects，失败时返回 error
  - [x] 1.6 新增 `POST /api/recognize/status/batch` 接口：接收 `{task_ids: [...]}`，批量返回各任务状态

- [x] Task 2: 首页改为异步提交
  - [x] 2.1 修改 `handleFabClick`：选图后不再直接 dispatch setPhotos 并跳转，而是先调用 `api.recognizeAsync` 逐张提交（每张图片单独上传获取 task_id）
  - [x] 2.2 显示提交进度（如"正在提交 2/5..."），提交完成后 dispatch setPhotos（每张照片带 status 和 taskId），然后跳转复习页
  - [x] 2.3 部分照片提交失败时，对应照片 status 设为 failed + errorMessage，仍正常跳转

- [x] Task 3: 复习页重构为异步状态驱动 + 自动保存
  - [x] 3.1 新增"照片列表视图"：以网格展示所有 photos，每张显示缩略图 + 状态标记（pending 旋转动画、processing 进度动画、completed 勾号、failed 叉号）
  - [x] 3.2 实现轮询逻辑：使用 `setInterval` 每 5 秒调用 `api.getRecognitionStatusBatch`，通过 `dispatch updatePhotoStatus` 更新状态；全部完成后清除定时器；页面卸载时清除定时器
  - [x] 3.3 pending/processing 状态的照片不显示删除按钮（不可删除）；completed/failed 状态的照片显示删除按钮（可从列表移除）
  - [x] 3.4 实现"照片详情视图"：点击 completed 照片进入，显示 AnnotatedImage + WordCard 列表（复用现有组件）
  - [x] 3.5 详情视图底部操作按钮：只保留"重新识别"和"跳过"，移除"保存"按钮和登录提示弹窗
  - [x] 3.6 实现自动保存逻辑：当照片 status 变为 completed 时自动触发保存（已登录 → api.uploadPhoto；未登录 → 本地 storage），保存成功后标记 saved=true，失败不阻塞其他照片
  - [x] 3.7 实现失败照片重试：点击 failed 照片的重试按钮，调用 `api.recognizeAsync` 重新提交，通过 `updatePhotoStatus` 更新 taskId 和 status
  - [x] 3.8 汇总界面：全部照片处理完毕后展示"已保存 X 张，失败 X 张"，提供"返回首页"按钮
  - [x] 3.9 处理中照片点击时显示"正在识别中"提示（toast）

- [x] Task 4: 复习页样式更新
  - [x] 4.1 新增照片列表网格布局样式（`.review-photo-grid`、`.review-photo-item`）
  - [x] 4.2 新增各状态标记样式（pending 旋转动画、processing 脉冲动画、completed 勾号、failed 叉号）
  - [x] 4.3 新增删除按钮样式
  - [x] 4.4 新增汇总界面样式（与现有 completion 样式整合）
  - [x] 4.5 新增整体进度条样式
  - [x] 4.6 清理/移除不再需要的旧样式（如 `.review-action-btn-save` 等）

# Task Dependencies
- Task 2 depends on Task 1（需要后端接口可用）
- Task 3 depends on Task 1（需要后端接口可用）
- Task 2 和 Task 3 可并行开发（基于 API 契约，使用 dev 环境后端验证）
- Task 4 depends on Task 3（样式跟随 UI 结构）