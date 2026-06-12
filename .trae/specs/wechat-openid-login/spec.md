# 微信 OpenID 免登录

## Why
小程序当前使用邮箱+验证码登录，用户需要手动输入邮箱、接收验证码、输入验证码后才能使用。微信小程序本身可以通过 `wx.login()` 获取用户 OpenID，实现静默免登录——用户打开小程序即自动完成身份认证，无需任何手动操作。同时移除小程序中的邮箱登录页面，简化用户体验。

## What Changes

### 后端
- `auth.py`: JWT token 改用 `user_id` 作为载荷（非 email），新增 `wechat_login(code)` 函数调用微信 code2Session 接口获取 OpenID 并创建/查找用户，生成 JWT。用户相关函数（`update_user_language`、`update_user_theme`、`get_user_language`）参数从 email 改为 user_id
- `main.py`: `require_auth()` 返回 `user_id` 直接使用，移除 `get_user_id_by_email` 相关代码；新增 `POST /api/auth/wechat-login` 端点；各端点适配 `user_id`
- `db.py`: users 集合新增 `openid` 稀疏唯一索引
- `worker.py`: `get_user_language()` 直接传 `user_id`，移除 email 查找逻辑

### 小程序
- `AuthContext.tsx`: 存储 `user_id` 替代 `email`，新增启动时的静默微信登录逻辑
- `api.ts`: 新增 `wechatLogin()` API，`getToken()` 逻辑调整
- `app.tsx`: 应用启动时触发自动登录
- `pages/login/index.tsx`: 移除登录页面，app.config.ts 中移除该路由
- `pages/home/index.tsx`: 移除"未登录"分支和邮箱显示，移除 `isLoggedIn` 检查（永远为 true）
- 其他页面: 移除 `isLoggedIn` 条件判断

### 前端 (React)
- 不做修改

## Impact
- Affected specs: email-auth-mongodb, sync-miniprogram, migrate-user-id-relation
- Affected code: `backend/auth.py`, `backend/main.py`, `backend/db.py`, `backend/worker.py`；`miniprogram/src/context/AuthContext.tsx`、`miniprogram/src/utils/api.ts`、`miniprogram/src/app.tsx`、`miniprogram/src/app.config.ts`、`miniprogram/src/pages/login/*`、`miniprogram/src/pages/home/index.tsx`
- **BREAKING**: 小程序中完全移除邮箱登录页面和登录流程；JWT 载荷从 email 改为 user_id

## ADDED Requirements

### Requirement: 微信 OpenID 静默登录
系统 SHALL 在小程序启动时自动调用 `wx.login()` 获取临时 code，发送到后端 `/api/auth/wechat-login`，后端通过微信 code2Session 接口换取 OpenID，创建或查找用户，返回 JWT token。整个过程对用户完全透明，无需任何手动操作。

#### Scenario: 新用户首次打开小程序
- **WHEN** 新用户首次打开小程序
- **THEN** 自动完成微信登录，后端创建新用户记录（`openid` 有值，`email` 为空），返回 JWT token，进入首页

#### Scenario: 已有微信用户再次打开
- **WHEN** 已有 OpenID 的用户再次打开小程序
- **THEN** 自动完成微信登录，后端查找已有用户返回 JWT token，进入首页

#### Scenario: 后端 code2Session 接口调用
- **WHEN** 后端收到微信登录 code
- **THEN** 调用 `https://api.weixin.qq.com/sns/jscode2session`，使用环境变量 `WECHAT_APPID` 和 `WECHAT_SECRET`，获取 `openid` 和 `session_key`

### Requirement: JWT 使用 user_id 作为载荷
JWT token 的 payload SHALL 使用 `user_id`（MongoDB `_id` 字符串）作为用户标识，替代原有的 `email`。

#### Scenario: 生成微信登录 token
- **WHEN** 调用 `wechat_login(code)`
- **THEN** 返回的 JWT 中包含 `user_id` 字段

#### Scenario: 验证 token
- **WHEN** `verify_token(token)` 被调用
- **THEN** 返回 `user_id` 字符串或 None

### Requirement: users 集合新增 openid 字段
users 集合 SHALL 新增 `openid` 字段（字符串，可选），并创建稀疏唯一索引。已有用户 `openid` 为 null，微信登录用户 `openid` 有值，邮箱登录用户（仅 web 前端）`email` 有值。

#### Scenario: 微信登录创建用户
- **WHEN** 后端通过 OpenID 找不到已有用户
- **THEN** 在 users 集合中插入新文档，包含 `openid` 字段和空的 `email` 字段

### Requirement: 移除小程序邮箱登录
小程序 SHALL 完全移除邮箱登录页面和相关代码路径，不再有任何登录 UI。应用启动即自动完成认证。

#### Scenario: 小程序启动
- **WHEN** 小程序启动
- **THEN** 自动调用微信登录，进入首页，无登录页面展示

## MODIFIED Requirements

### Requirement: require_auth 返回 user_id
`main.py` 中的 `require_auth()` 函数 SHALL 从 JWT 中提取 `user_id` 并返回，而非 `email`。所有端点直接使用 `user_id`，无需再调用 `get_user_id_by_email()`。

#### Scenario: API 请求认证
- **WHEN** 请求携带有效的 Bearer token
- **THEN** `require_auth()` 返回 `user_id` 字符串

### Requirement: 用户管理函数使用 user_id
`auth.py` 中 `update_user_language`、`update_user_theme`、`get_user_language` SHALL 使用 `user_id` 参数并通过 `_id` 查询 users 集合。

#### Scenario: 更新语言偏好
- **WHEN** 调用 `update_user_language(user_id, nativeLang, targetLang)`
- **THEN** 通过 `_id: ObjectId(user_id)` 查找用户并更新

### Requirement: Worker 直接使用 user_id
`worker.py` SHALL 从 photo 文档读取 `user_id` 后直接调用 `get_user_language(user_id)`，不再先查找 email。

### Requirement: 小程序无"未登录"状态
小程序的 AuthContext SHALL 始终保持 `isLoggedIn = true`（加载完成后），不再有"跳过登录"或"暂不登录"的路径。所有页面不再检查 `isLoggedIn` 状态。

### Requirement: 小程序首页简化
小程序首页 SHALL 移除邮箱显示、"登录"/"退出"按钮、以及所有基于 `isLoggedIn` 的条件分支。

## REMOVED Requirements

### Requirement: 小程序邮箱登录页面
**Reason**: 微信 OpenID 免登录替代
**Migration**: 移除 `pages/login/index` 路由和所有登录相关代码，后端邮箱验证 API 保留供 web 前端使用
