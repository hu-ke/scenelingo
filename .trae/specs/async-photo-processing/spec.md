# 异步照片处理 Spec

## Why
当前照片识别流程是同步阻塞的：用户选择照片后，必须逐张等待后端调用 Qwen VL 模型返回识别结果，每张耗时数秒到数十秒，期间 UI 完全阻塞。用户无法查看已完成的照片，只能干等。引入异步处理机制后，照片可以批量提交、后台处理，用户可以立刻看到状态并在结果就绪后随时查看，大幅减少等待感知。

## What Changes
- 后端新增异步照片处理机制：提交照片后立即返回任务 ID，后台异步调用 Qwen VL，完成后结果可查询
- 前端/小程序 ReviewContext 新增照片处理状态字段（pending / processing / completed / failed）
- 前端 ReviewPage 改为支持批量预览 + 状态显示 + 按需查看已完成结果
- 前端新增轮询或主动查询机制获取照片处理进度
- 小程序同步实现同样的异步处理流程
- **BREAKING**：`/api/recognize` 接口改为异步模式，旧同步模式不再支持

## Impact
- Affected specs: scene-english-learning（照片复习流程变更）
- Affected code:
  - `backend/main.py` — 新增异步任务管理 + 改造 `/api/recognize`
  - `frontend/src/context/ReviewContext.tsx` — 新增 photo status 状态和 actions
  - `frontend/src/pages/ReviewPage.tsx` — 重构为异步状态驱动
  - `frontend/src/pages/HomePage.tsx` — 提交照片后展示处理状态
  - `frontend/src/utils/api.ts` — 新增查询识别状态的 API
  - `miniprogram/src/` — 对应前端的所有修改

## ADDED Requirements

### Requirement: 异步照片提交
系统 SHALL 允许用户批量提交照片进行识别处理，提交后立即返回，不阻塞 UI。

#### Scenario: 用户提交多张照片
- **WHEN** 用户选择 5 张照片并确认提交
- **THEN** 后端接收所有照片，为每张照片创建处理任务，返回任务列表及各自的任务 ID
- **AND** 前端立即显示所有照片的缩略图，每张标注"等待处理"状态

#### Scenario: 提交失败处理
- **WHEN** 照片提交请求网络失败
- **THEN** 系统显示提交失败提示，允许用户重试

### Requirement: 照片处理状态
系统 SHALL 为每张照片维护处理状态，支持以下状态流转：
- `pending`：已提交，等待处理
- `processing`：正在调用 VL 模型识别中
- `completed`：识别完成，结果可用
- `failed`：识别失败（含错误信息）

#### Scenario: 照片状态变更
- **WHEN** 后端开始处理某张照片
- **THEN** 该照片状态变为 `processing`
- **WHEN** VL 模型返回识别结果
- **THEN** 该照片状态变为 `completed`，结果可被查询
- **WHEN** VL 模型调用失败或超时
- **THEN** 该照片状态变为 `failed`，记录错误信息

### Requirement: 结果查询接口
系统 SHALL 提供接口查询单张照片的处理状态和识别结果。

#### Scenario: 查询已完成的照片
- **WHEN** 前端调用状态查询接口，传入任务 ID
- **THEN** 返回该照片的当前状态，若状态为 `completed` 则同时返回识别结果（objects 数组）

#### Scenario: 查询处理中的照片
- **WHEN** 前端调用状态查询接口，传入任务 ID
- **THEN** 返回该照片的当前状态（`pending` 或 `processing`），不含识别结果

#### Scenario: 批量查询状态
- **WHEN** 前端调用批量状态查询接口，传入多个任务 ID
- **THEN** 返回所有照片的当前状态，已完成的同时返回识别结果

### Requirement: 前端状态轮询
前端 SHALL 在照片提交后自动轮询处理状态，直到全部完成或用户离开页面。

#### Scenario: 自动轮询完成
- **WHEN** 用户提交 3 张照片
- **THEN** 前端每 2 秒轮询一次批量状态接口
- **AND** 当所有照片状态变为 `completed` 或 `failed` 后停止轮询

#### Scenario: 用户进入已完成照片的复习
- **WHEN** 某张照片变为 `completed`
- **THEN** 用户可以点击该照片进入复习查看（标注图 + 识别结果）

### Requirement: 用户可查看处理中的进度
系统 SHALL 在界面上展示每张照片的处理状态，让用户清楚了解进度。

#### Scenario: 处理中状态展示
- **WHEN** 照片处于 `pending` 状态
- **THEN** 界面显示"等待中"标记和旋转动画
- **WHEN** 照片处于 `processing` 状态
- **THEN** 界面显示"识别中"标记和进度动画
- **WHEN** 照片处于 `completed` 状态
- **THEN** 界面显示"已完成"标记，可点击查看
- **WHEN** 照片处于 `failed` 状态
- **THEN** 界面显示"识别失败"标记和重试按钮

## MODIFIED Requirements

### Requirement: ReviewContext 照片状态模型
`PhotoItem` 接口 SHALL 新增以下字段：
- `status: 'pending' | 'processing' | 'completed' | 'failed'`
- `taskId?: string`（后端任务 ID，提交后获得）
- `errorMessage?: string`（失败时的错误信息）

`ReviewState` 接口 SHALL 新增：
- `isSubmitting: boolean`（是否正在提交照片）

新增 action types：
- `updatePhotoStatus` — 更新单张照片状态
- `setSubmitting` — 设置提交状态

### Requirement: 后端异步任务管理
后端 SHALL 使用内存字典存储任务状态（key 为 UUID 任务 ID），每张照片对应一个任务记录：
```python
{
    "task_id": "uuid",
    "status": "pending" | "processing" | "completed" | "failed",
    "objects": [...] | null,
    "error": str | null,
    "created_at": datetime,
    "updated_at": datetime,
    "native_lang": str,
    "target_lang": str,
}
```

后端 SHALL 通过 `asyncio.create_task` 在后台异步处理每张照片，不阻塞请求响应。

## REMOVED Requirements
无移除的需求。