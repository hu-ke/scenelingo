# Tasks

- [x] Task 1: 后端 DB 层改造 — status 字段、索引、数据操作方法
  - [x] 1.1 在 `backend/db.py` 的 `init_db` 中新增 `(user_email, status)` 复合索引 + `status` 单字段索引
  - [x] 1.2 在 `backend/auth.py` 中新增 `save_pending_photo_record(user_email, photo_id)` 函数：插入 photos 记录，status="pending", objects=[]
  - [x] 1.3 在 `backend/auth.py` 中新增 `claim_pending_photo()` 函数：原子地将 status 从 pending 更新为 processing，返回 document（含 user_email, original_url），用于 worker 抢占任务
  - [x] 1.4 在 `backend/auth.py` 中新增 `complete_photo(photo_id, objects)` 函数：更新 status 为 completed，写入 objects 数组
  - [x] 1.5 在 `backend/auth.py` 中新增 `reset_photo_to_pending(photo_id)` 函数：将 processing 照片重置为 pending（用于处理失败时回退）
  - [x] 1.6 修改 `backend/auth.py` 的 `list_user_photos_mongo` 函数：返回的每条记录增加 `status` 字段，存量数据（无 status 字段）默认返回 "completed"

- [x] Task 2: 后端新增 `POST /api/photos/upload-pending` 接口
  - [x] 2.1 在 `backend/main.py` 中新增 `upload_pending` 路由：验证登录 → 获取上传的原图文件 → 上传到 OSS → 调用 `save_pending_photo_record` → 返回 `{photo_id, status: "pending"}`
  - [x] 2.2 `GET /api/photos/list` 不需要修改，`list_user_photos_mongo` 已经返回 status 字段，自动透传

- [x] Task 3: 后端创建 `backend/worker.py` 独立后台处理脚本
  - [x] 3.1 创建 `backend/worker.py`：加载 `.env`、连接 MongoDB（通过 `get_db()`）
  - [x] 3.2 实现主循环：每 2 秒调用 `claim_pending_photo()` → 如果有任务则从 OSS URL 下载原图 → 调用 Qwen VL 识别（复用 `build_prompt` 和识别逻辑）→ 成功后调用 `complete_photo` → 失败则调用 `reset_photo_to_pending`
  - [x] 3.3 异常处理：识别失败时记录日志并重置状态为 pending，不退出循环；外层捕获所有异常
  - [x] 3.4 所有依赖（PIL, openai, motor, loguru, python-dotenv）已在 requirements.txt 中

- [x] Task 4: 前端 API 层和类型定义更新
  - [x] 4.1 在 `frontend/src/context/ReviewContext.tsx` 的 `PhotoItem` 接口中增加 `status?: 'pending' | 'processing' | 'completed'` 字段
  - [x] 4.2 在 `frontend/src/utils/api.ts` 中新增 `uploadPending(formData: FormData)` 方法，调用 `POST /api/photos/upload-pending`

- [x] Task 5: 前端 HomePage 异步上传流程和状态展示
  - [x] 5.1 修改 `HomePage` 的 `handleFileChange`：登录用户选图后改为逐张调用 `api.uploadPending`，显示上传进度遮罩（"正在上传... X / N"），全部完成后调用 `loadData()` 刷新列表，留在首页（不跳转复习页）；未登录用户保持现有流程不变
  - [x] 5.2 在 `HomePage` 中实现不同 status 的缩略图样式：pending 显示半透明遮罩 + 旋转动画 + "等待识别"；processing 显示遮罩 + 旋转动画 + "识别中..."；completed 正常展示，保留 checkbox 和删除按钮
  - [x] 5.3 实现 5 秒自动刷新：`useEffect` 中检测是否存在非 completed 照片（`p.status !== 'completed'`），存在则设置 5 秒 interval 调用 `loadData()`；全部 completed 或组件卸载时清除 interval

# Task Dependencies
- [Task 2] depends on [Task 1]（需要 DB 层的 save_pending_photo_record 函数）
- [Task 3] depends on [Task 1]（需要 claim_pending_photo / complete_photo / reset_photo_to_pending 函数）
- [Task 5] depends on [Task 2] 和 [Task 4]（需要后端接口和前端类型就绪）
- [Task 1] 和 [Task 4] 可并行执行
