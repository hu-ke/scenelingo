# Tasks

- [x] Task 1: 后端异步任务管理
  - [x] 1.1 在 `backend/main.py` 中创建内存任务存储字典 `recognition_tasks: dict[str, dict]`
  - [x] 1.2 实现任务创建函数 `create_recognition_task(native_lang, target_lang) -> dict`
  - [x] 1.3 实现后台异步处理函数 `process_image_task(task_id, image_base64, native_lang, target_lang)`：调用 Qwen VL 识别，更新任务状态和结果
  - [x] 1.4 实现任务状态查询函数 `get_task(task_id) -> dict | None`

- [x] Task 2: 后端 API 改造
  - [x] 2.1 新增 `POST /api/recognize/async` — 接收多张照片，创建任务，返回 `[{task_id, status: "pending"}, ...]`
  - [x] 2.2 新增 `GET /api/recognize/status/{task_id}` — 查询单张照片任务状态和结果
  - [x] 2.3 新增 `POST /api/recognize/status/batch` — 批量查询任务状态
  - [x] 2.4 保留旧 `POST /api/recognize` 接口（未修改，完全兼容）

- [x] Task 3: 前端 ReviewContext 状态模型扩展
  - [x] 3.1 `PhotoItem` 接口新增 `status`、`taskId`、`errorMessage` 字段
  - [x] 3.2 `ReviewState` 接口新增 `isSubmitting` 字段
  - [x] 3.3 新增 `updatePhotoStatus` action：根据 taskId 更新对应照片的 status 和 objects
  - [x] 3.4 新增 `setSubmitting` action
  - [x] 3.5 `initialState` 适配新字段默认值

- [x] Task 4: 前端 api.ts 新增异步接口
  - [x] 4.1 新增 `recognizeAsync(files, nativeLang, targetLang)` — 调用 `POST /api/recognize/async`
  - [x] 4.2 新增 `getRecognitionStatus(taskId)` — 调用 `GET /api/recognize/status/{task_id}`
  - [x] 4.3 新增 `getRecognitionStatusBatch(taskIds)` — 调用 `POST /api/recognize/status/batch`

- [x] Task 5: 前端 HomePage 改造为异步提交
  - [x] 5.1 选择照片后调用 `recognizeAsync` 提交照片而非直接进入复习
  - [x] 5.2 提交成功后跳转到 ReviewPage（状态预览模式）
  - [x] 5.3 提交失败显示错误提示，不跳转

- [x] Task 6: 前端 ReviewPage 重构为异步状态驱动
  - [x] 6.1 新增"照片处理状态"视图：网格展示所有照片缩略图 + 各状态标记
  - [x] 6.2 轮询逻辑：每 2 秒调用 `getRecognitionStatusBatch`，更新各照片状态
  - [x] 6.3 所有照片完成后自动停止轮询
  - [x] 6.4 支持点击已完成照片进入单张复习视图
  - [x] 6.5 处理中照片不可点击
  - [x] 6.6 失败照片显示错误信息和重试按钮
  - [x] 6.7 保留原有的进度条、已保存数量等 UI 元素（通过"完成"按钮触发）

- [x] Task 7: 前端旧同步逻辑清理
  - [x] 7.1 移除 ReviewPage 中原有的 `recognizeImage` 同步调用逻辑
  - [x] 7.2 `AnnotatedImage` 组件兼容新的数据获取方式（通过 selectedPhotoIndex 获取当前照片对象）
  - [x] 7.3 保存/上传流程（OSS + IndexedDB）通过 selectedPhotoIndex 正常适配

- [x] Task 8: 小程序同步适配
  - [x] 8.1 小程序 `AppContext` 同步前端的状态模型扩展
  - [x] 8.2 小程序 `api.ts` 新增异步识别和状态查询接口（使用 `Taro.uploadFile` 适配）
  - [x] 8.3 小程序数据层和 API 层已就绪（UI 页面有待后续实现）
  - [x] 8.4 小程序数据层和 API 层已就绪（UI 页面有待后续实现）

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1 (接口设计确定)
- Task 4 depends on Task 2
- Task 5 depends on Task 3, Task 4
- Task 6 depends on Task 3, Task 4
- Task 7 depends on Task 6
- Task 8 depends on Task 3, Task 4 (可并行)