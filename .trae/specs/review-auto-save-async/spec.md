# 复习页异步识别与自动保存 Spec

## Why
当前复习页的识别流程是同步阻塞的：用户进入复习页后，必须逐张等待后端调用通义千问 VL 模型返回结果，每张耗时数秒到数十秒，期间 UI 完全阻塞。此外，识别完成后用户还需手动点击"保存"按钮才能保存照片，操作繁琐。需要改为异步识别机制（上传后立即返回，后台处理，前端每 5 秒轮询状态），并实现识别完成后自动保存，无需用户手动操作。

## What Changes
- **后端新增**：异步识别任务管理（内存存储 + `asyncio.create_task` 后台处理），新增 `POST /api/recognize/async`、`GET /api/recognize/status/{task_id}`、`POST /api/recognize/status/batch` 三个接口
- **小程序首页**：选图后改为异步提交（每张照片逐张上传，获取 task_id），然后进入复习页
- **小程序复习页**：重构为异步状态驱动模式，展示所有照片列表和各张照片的处理状态（pending/processing/completed/failed），每 5 秒轮询状态；正在处理的照片不可删除且显示处理中标记
- **自动保存**：识别完成后自动触发保存（已登录用户上传到云端，未登录用户保存到本地），移除手动保存按钮
- 数据模型（`PhotoItem.status`、`taskId`、`updatePhotoStatus` action）已在前期 spec 中由小程序数据层和 API 层完成，直接复用

## Impact
- Affected specs: async-photo-processing（本 spec 是其在小程序 UI 层和自动保存的延续）
- Affected code:
  - `backend/main.py` — 新增异步任务管理 + 三个异步识别接口
  - `miniprogram/src/pages/home/index.tsx` — 选图后改为异步提交
  - `miniprogram/src/pages/review/index.tsx` — 全面重构为异步状态驱动 + 自动保存
  - `miniprogram/src/pages/review/index.scss` — 新增照片列表/状态标记等样式
  - `miniprogram/src/context/AppContext.tsx` — 数据模型已就绪，可能需要少量调整

## ADDED Requirements

### Requirement: 后端异步识别任务管理
系统 SHALL 在内存中维护识别任务状态字典，支持异步后台处理。

#### Scenario: 创建异步识别任务
- **WHEN** 前端调用 `POST /api/recognize/async` 上传一张图片
- **THEN** 后端创建任务记录（status=pending），通过 `asyncio.create_task` 启动后台处理，立即返回 `{task_id, status: "pending"}`
- **AND** 后台处理调用 Qwen VL 模型进行识别，完成后更新任务状态为 `completed` 并存储识别结果，失败则更新为 `failed` 并存储错误信息

#### Scenario: 查询单任务状态
- **WHEN** 前端调用 `GET /api/recognize/status/{task_id}`
- **THEN** 返回任务当前状态，若已完成则同时返回 `objects` 识别结果，若失败则返回 `error` 信息

#### Scenario: 批量查询任务状态
- **WHEN** 前端调用 `POST /api/recognize/status/batch` 传入多个 task_id
- **THEN** 返回所有任务的当前状态，已完成的任务附带 `objects`，失败的任务附带 `error`

#### Scenario: 原始同步接口保持不变
- **WHEN** 前端调用 `POST /api/recognize`（旧接口）
- **THEN** 行为与原来完全一致，同步阻塞返回识别结果

### Requirement: 异步提交照片
小程序首页选图后，系统 SHALL 将每张照片异步提交到后端进行识别，而非同步等待。

#### Scenario: 用户选择多张照片
- **WHEN** 用户在首页选择 3 张照片
- **THEN** 系统为每张照片逐张调用 `POST /api/recognize/async`，获取各自的 task_id
- **AND** 所有照片提交完成后，dispatch `setPhotos` 到 ReviewContext（每张照片带 `status: 'pending'` 和 `taskId`）
- **AND** 跳转到复习页

#### Scenario: 部分照片提交失败
- **WHEN** 某张照片的异步提交网络失败
- **THEN** 该照片状态设为 `failed`，errorMessage 记录失败原因，其他照片正常处理
- **AND** 仍跳转到复习页，失败照片可重试

### Requirement: 复习页异步照片列表
复习页 SHALL 以列表/网格形式展示所有照片及其识别状态，而非逐张等待。

#### Scenario: 进入复习页查看照片列表
- **WHEN** 用户进入复习页
- **THEN** 展示所有照片的缩略图列表，每张照片带有状态标记：
  - `pending`：显示"等待中"标记和旋转动画
  - `processing`：显示"识别中"标记和进度动画
  - `completed`：显示"已完成"标记
  - `failed`：显示"失败"标记和错误信息
- **AND** 页面顶部显示整体进度（如 "2/5 已完成"）

#### Scenario: 处理中照片不可删除
- **WHEN** 照片状态为 `pending` 或 `processing`
- **THEN** 该照片不显示删除按钮，不可被删除

#### Scenario: 已完成照片可删除
- **WHEN** 照片状态为 `completed` 或 `failed`
- **THEN** 该照片显示删除按钮，用户可以将其从列表中移除（对应 task_id 不会被后续轮询）

### Requirement: 状态轮询
前端 SHALL 在复习页中每 5 秒轮询一次所有未完成照片的状态。

#### Scenario: 自动轮询更新状态
- **WHEN** 用户停留在复习页且有未完成（pending/processing）的照片
- **THEN** 系统每 5 秒调用 `POST /api/recognize/status/batch` 传入所有未完成照片的 task_id
- **AND** 根据返回结果通过 `updatePhotoStatus` action 更新各照片的状态

#### Scenario: 全部完成时停止轮询
- **WHEN** 所有照片状态变为 `completed` 或 `failed`
- **THEN** 停止轮询

#### Scenario: 离开页面时停止轮询
- **WHEN** 用户离开复习页
- **THEN** 清除轮询定时器

### Requirement: 识别完成后自动保存
识别完成后，系统 SHALL 自动保存照片，无需用户手动操作。

#### Scenario: 已登录用户自动保存到云端
- **WHEN** 某张照片识别完成（status 变为 `completed`）且用户已登录
- **THEN** 系统自动获取 Canvas 标注图，调用 `api.uploadPhoto` 上传原图、标注图和元数据到云端
- **AND** 保存成功后该照片标记为"已保存"

#### Scenario: 未登录用户自动保存到本地
- **WHEN** 某张照片识别完成（status 变为 `completed`）且用户未登录
- **THEN** 系统自动获取 Canvas 标注图，将照片数据写入本地 storage（`scene_lingo_local_photos`）
- **AND** 保存成功后该照片标记为"已保存"

#### Scenario: 自动保存失败
- **WHEN** 自动保存过程中发生错误（网络失败、本地存储满等）
- **THEN** 该照片不被标记为"已保存"，不阻塞其他照片的处理
- **AND** 用户后续可通过点击照片查看结果时手动触发保存

#### Scenario: 识别失败的照片不自动保存
- **WHEN** 照片识别失败（status 变为 `failed`）
- **THEN** 系统不触发自动保存，用户可选择重试

### Requirement: 查看已完成照片
用户 SHALL 可以点击已完成的照片进入详情查看标注图和单词卡片。

#### Scenario: 点击已完成照片
- **WHEN** 用户点击一张 status 为 `completed` 的照片
- **THEN** 进入单张照片查看视图，显示标注图（AnnotatedImage）和单词卡片列表（WordCard）
- **AND** 页面底部显示"重新识别"和"跳过"按钮（无保存按钮，因为已自动保存）

#### Scenario: 处理中照片不可点击查看
- **WHEN** 照片 status 为 `pending` 或 `processing`
- **THEN** 点击无响应，或显示"正在识别中"提示

### Requirement: 失败照片重试
用户 SHALL 能够重试识别失败的照片。

#### Scenario: 点击失败照片的重试
- **WHEN** 用户点击 `failed` 状态照片的重试按钮
- **THEN** 该照片重新提交到 `POST /api/recognize/async`，获取新的 task_id
- **AND** 状态重置为 `pending`，重新进入轮询流程

### Requirement: 全部完成后的汇总
所有照片处理完成后，系统 SHALL 展示汇总界面。

#### Scenario: 全部照片处理完毕
- **WHEN** 所有照片的 status 均为 `completed` 或 `failed`
- **THEN** 展示汇总界面，显示"已保存 X 张，失败 X 张"
- **AND** 用户可点击"返回首页"或"查看已保存照片"

## MODIFIED Requirements

### Requirement: ReviewContext 数据模型
数据模型已在上一个 spec 中完成修改，`PhotoItem` 已包含 `status`、`taskId`、`errorMessage` 字段，`updatePhotoStatus` 和 `setSubmitting` action 已就绪，无需再次修改。

### Requirement: 小程序 api.ts
`api.ts` 已包含 `recognizeAsync`、`getRecognitionStatus`、`getRecognitionStatusBatch` 方法，无需再次修改。

## REMOVED Requirements

### Requirement: 手动保存按钮
**Reason**: 识别完成后自动保存，不再需要用户手动点击保存按钮。
**Migration**: 从复习页移除"保存"按钮及相关逻辑（`handleSave`、`handleSaveLocally`、登录提示弹窗等）；已完成的照片不再显示保存按钮；WordCard 查看视图中只保留"重新识别"和"跳过"按钮。

### Requirement: 同步逐张识别
**Reason**: 改为异步批量提交 + 后台处理模式，不再需要逐张同步等待。
**Migration**: 移除 `recognizeImage` 函数和相关的 `useEffect` 监听逻辑；不再需要 `loading`、`error` 等逐张识别的状态管理。