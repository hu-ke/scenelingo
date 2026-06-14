# 识图次数配额与分享奖励机制 Spec

## Why
当前用户上传照片识图没有次数限制，无法激励用户分享传播。通过引入"免费次数 + 分享奖励"机制，既可以控制 AI 识别成本，又能利用用户的社交分享带来自然增长。

## What Changes
- 每个用户默认拥有 10 次免费识图机会（`recognition_quota` 字段，存储在 MongoDB `users` 集合）
- 上传照片识图时（`upload-pending` 接口）检查并扣减配额，配额用尽后拒绝上传
- 分享路径携带邀请者 `user_id`（`?inviter=xxx`），新用户通过分享卡片进入后，邀请者获得 10 次配额奖励
- 新增 `GET /api/user/quota` 接口返回当前剩余配额
- 新增 `POST /api/share/reward` 接口处理分享奖励逻辑
- 前端首页展示剩余配额，配额用尽时弹出引导分享的弹窗

## Impact
- Affected specs: `miniprogram-share`（分享路径需增加 inviter 参数）
- Affected code:
  - Backend: `main.py`（新增/修改接口）、`auth.py`（配额相关数据库操作）
  - Frontend: `pages/home/index.tsx`（配额展示、用尽弹窗）、`utils/shareCard.ts`（分享路径增加 inviter）、`utils/api.ts`（新增 API 调用）、`app.tsx`（检测 inviter 参数）

## ADDED Requirements

### Requirement: 用户识图配额
系统 SHALL 为每个用户维护一个 `recognition_quota` 字段，初始值为 10，表示剩余可识图次数。

#### Scenario: 新用户获得初始配额
- **WHEN** 新用户首次创建账号（通过微信登录或邮箱登录）
- **THEN** 该用户的 `recognition_quota` 被设置为 10

#### Scenario: 查询剩余配额
- **WHEN** 用户请求 `GET /api/user/quota`
- **THEN** 返回 `{"quota": 10}`（或其他剩余次数）

### Requirement: 上传识图时扣减配额
系统 SHALL 在用户上传照片识图时检查配额，配额不足时拒绝上传。

#### Scenario: 配额充足时正常上传
- **WHEN** 用户配额 > 0 时调用 `POST /api/photos/upload-pending`
- **THEN** 照片正常上传，配额扣减 1

#### Scenario: 配额用尽时拒绝上传
- **WHEN** 用户配额 = 0 时调用 `POST /api/photos/upload-pending`
- **THEN** 返回 403 错误，`detail` 为「识别次数已用完，请分享给好友获取更多次数」

### Requirement: 分享奖励机制
系统 SHALL 在分享路径中携带邀请者 ID，当新用户通过分享卡片首次进入小程序时，邀请者获得 10 次配额奖励。

#### Scenario: 分享路径携带邀请者 ID
- **WHEN** 用户发起分享（分享给朋友或朋友圈）
- **THEN** 分享路径为 `/pages/home/index?inviter=<当前用户user_id>`

#### Scenario: 新用户通过分享进入，邀请者获得奖励
- **WHEN** 新用户（首次使用、无照片记录）通过携带 `inviter` 参数的分享卡片进入小程序
- **AND** 该邀请关系尚未被记录（同一对新老用户不会重复奖励）
- **THEN** 邀请者的 `recognition_quota` 增加 10
- **AND** 邀请关系记录到 `share_invites` 集合

#### Scenario: 老用户点击分享卡片不触发奖励
- **WHEN** 已有照片记录的用户通过携带 `inviter` 参数的分享卡片进入
- **THEN** 不触发邀请奖励

#### Scenario: 同一邀请关系不重复奖励
- **WHEN** 同一个新用户已经被某个邀请者奖励过
- **THEN** 再次进入时不再重复奖励

### Requirement: 前端配额展示与引导
前端首页 SHALL 展示剩余识图次数，配额用尽时引导用户分享。

#### Scenario: 首页展示剩余配额
- **WHEN** 用户进入首页
- **THEN** 在页面中展示剩余识图次数（如「剩余 8 次」）

#### Scenario: 配额用尽时弹出引导弹窗
- **WHEN** 用户点击拍照按钮且配额为 0
- **THEN** 弹出弹窗提示「识别次数已用完！分享给好友，即可获得 10 次识别机会」，并提供「分享给好友」按钮
- **AND** 用户点击分享按钮后触发微信分享流程

#### Scenario: 配额用尽时上传也展示提示
- **WHEN** 用户配额为 0 时尝试上传照片
- **THEN** 后端返回 403，前端展示 Toast 提示「识别次数已用完，请分享给好友获取更多次数」