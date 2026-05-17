# 异步图片识别（后台 Worker）Spec

## Why
当前登录用户在首页选图后进入复习页，每张照片需逐张同步调用 AI 识别模型（Qwen VL），单张耗时数秒到数十秒，批量时用户等待时间极长。需要为登录用户引入异步识别机制：上传后立即保存并返回，由独立后台脚本轮询处理，前端轮询展示状态。未登录用户保持现有同步流程不变。

## What Changes
- **后端新增**：`POST /api/photos/upload-pending` 接口，登录用户上传原图后立即保存到 OSS + MongoDB（status=pending），立即返回 photo_id
- **后端修改**：`GET /api/photos/list` 接口返回每个 photo 增加 `status` 字段（pending/processing/completed）
- **后端新增**：独立后台脚本 `backend/worker.py`，每 2 秒轮询 MongoDB 中 status=pending 的照片，将其状态更新为 processing，调用 AI 识别，完成后更新为 completed 并写入 objects
- **前端修改**：`HomePage` 选图上传后，对登录用户改为调用新接口异步提交，直接留在首页；首页 list 接口返回全部状态的照片，不同状态有区别样式；存在非 completed 状态照片时每 5 秒自动刷新列表
- **前端修改**：`ReviewContext` 的 `PhotoItem` 增加 `status` 可选字段
- **前端修改**：`api.ts` 增加 `uploadPending` 方法
- 未登录用户流程完全不变（选图 → 复习页同步识别 → 手动保存）

## Impact
- Affected specs: 无（新功能）
- Affected code:
  - `backend/main.py` — 新增 `POST /api/photos/upload-pending` 接口，修改 `GET /api/photos/list` 返回 status
  - `backend/worker.py` — **新建**，独立后台轮询处理脚本
  - `backend/auth.py` — 新增 `save_pending_photo_record` / 修改 `list_user_photos_mongo` 返回 status、新增 `claim_pending_photo` / `complete_photo` 等方法
  - `backend/db.py` — 新增 photos 集合的 `(user_email, status)` 复合索引
  - `frontend/src/context/ReviewContext.tsx` — `PhotoItem` 增加 `status` 字段
  - `frontend/src/utils/api.ts` — 新增 `uploadPending` 方法
  - `frontend/src/pages/HomePage.tsx` — 登录用户选图后改为异步上传，不同状态区别样式，5 秒轮询

## ADDED Requirements

### Requirement: 登录用户异步上传接口
系统 SHALL 为登录用户提供异步照片上传接口，上传原图后立即保存并返回。

#### Scenario: 登录用户上传单张照片
- **WHEN** 已登录用户调用 `POST /api/photos/upload-pending` 上传原图
- **THEN** 后端将原图上传到 OSS（路径：`photos/{email}/{photo_id}/original.jpg`），在 MongoDB photos 集合中插入记录（status=pending, objects=[]），立即返回 `{photo_id, status: "pending"}`
- **AND** 接口需要 Bearer token 认证

#### Scenario: 未登录用户调用异步上传接口
- **WHEN** 未登录用户调用 `POST /api/photos/upload-pending`
- **THEN** 返回 401 未登录错误

### Requirement: 照片列表接口返回状态
系统 SHALL 在照片列表接口中返回每张照片的状态字段。

#### Scenario: 查询照片列表
- **WHEN** 已登录用户调用 `GET /api/photos/list`
- **THEN** 返回的每张照片包含 `status` 字段，值为 "pending"、"processing" 或 "completed"
- **AND** status 为 "pending" 或 "processing" 的照片 `objects` 为空数组（尚未完成识别）

### Requirement: 后台 Worker 轮询处理
系统 SHALL 提供独立运行的 Python 脚本，轮询数据库并处理待识别照片。

#### Scenario: Worker 发现 pending 照片
- **WHEN** Worker 每 2 秒检查一次 MongoDB，发现 status=pending 的照片
- **THEN** Worker 将该照片状态原子更新为 status=processing
- **AND** Worker 从 OSS 下载原图
- **AND** Worker 调用 Qwen VL 模型进行识别（复用现有 `build_prompt` 和识别逻辑）
- **AND** 识别完成后更新 MongoDB：status=completed, objects=[...]

#### Scenario: Worker 识别失败
- **WHEN** Worker 调用 AI 识别失败（网络错误、模型返回异常等）
- **THEN** Worker 将该照片状态重置为 pending（以便后续重试），记录错误日志
- **AND** 不阻塞其他照片的处理

#### Scenario: 没有 pending 照片
- **WHEN** Worker 检查 MongoDB 没有 status=pending 的照片
- **THEN** Worker 休眠 2 秒后继续下一轮检查

### Requirement: 前端异步上传流程（登录用户）
登录用户在首页选图后，系统 SHALL 改为异步提交而非进入复习页同步识别。

#### Scenario: 登录用户选择多张照片上传
- **WHEN** 已登录用户在首页选择 N 张照片
- **THEN** 系统逐张调用 `POST /api/photos/upload-pending` 上传原图
- **AND** 全部上传完毕后，刷新首页列表，留在首页（不进入复习页）
- **AND** 上传过程中显示进度提示（如 "正在上传 2/5..."）
- **AND** 如果有上传失败的照片，提示用户并继续上传其余照片

#### Scenario: 未登录用户选图上传
- **WHEN** 未登录用户在首页选择照片
- **THEN** 行为与现有流程完全一致：创建 PhotoItem[] → dispatch setPhotos → 跳转复习页同步识别

### Requirement: 首页按状态区分照片样式
系统 SHALL 在首页照片列表中根据 status 展示不同样式。

#### Scenario: pending 状态的照片
- **WHEN** 照片 status 为 "pending"
- **THEN** 照片缩略图显示半透明遮罩 + "等待识别" 文字 + 旋转加载动画（或骨架屏效果）

#### Scenario: processing 状态的照片
- **WHEN** 照片 status 为 "processing"
- **THEN** 照片缩略图显示半透明遮罩 + "识别中..." 文字 + 进度动画

#### Scenario: completed 状态的照片
- **WHEN** 照片 status 为 "completed"
- **THEN** 照片正常展示，无遮罩，可正常点击进行重新识别、删除等操作

### Requirement: 首页自动刷新
系统 SHALL 在存在非 completed 状态照片时每 5 秒自动刷新列表。

#### Scenario: 存在 pending 或 processing 照片
- **WHEN** 首页照片列表中存在至少一张 status 不为 "completed" 的照片
- **THEN** 系统每 5 秒调用 `GET /api/photos/list` 刷新列表数据
- **AND** 刷新时仅更新数据，不改变 UI 滚动位置或展开/折叠状态

#### Scenario: 全部照片 completed
- **WHEN** 首页所有照片 status 均为 "completed"
- **THEN** 停止 5 秒轮询，不再自动刷新

#### Scenario: 用户离开首页
- **WHEN** 用户导航到其他页面
- **THEN** 清除轮询定时器，停止自动刷新

## MODIFIED Requirements

### Requirement: MongoDB photos 集合结构
photos 集合的文档增加 `status` 字段。

- 新增字段：`status`（字符串，取值："pending" / "processing" / "completed"，默认 "completed" 兼容存量数据）
- 新增索引：`(user_email, status)` 复合索引，用于 Worker 高效查询 pending 照片
- 存量数据（无 status 字段）：list 接口返回时默认视为 "completed"

### Requirement: PhotoItem 接口（前端 ReviewContext）
`PhotoItem` 接口增加可选 `status` 字段。

- 新增：`status?: 'pending' | 'processing' | 'completed'`
- 兼容性：`status` 为可选字段，未设置时前端视为 "completed"

## REMOVED Requirements
无。
