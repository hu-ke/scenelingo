# Tasks

- [x] Task 1: 修改 `auth.py` — JWT 改用 user_id + 新增微信登录
  - `generate_token(user_id: str)` 替代 `generate_token(email: str)`，JWT payload 使用 `user_id`
  - `verify_token(token)` 返回 `user_id` 替代 `email`
  - 新增环境变量读取 `WECHAT_APPID`、`WECHAT_SECRET`
  - 新增 `get_or_create_user_by_openid(openid: str) -> dict` 函数
  - 新增 `wechat_login(code: str) -> dict` 函数（调用微信 code2Session，获取 openid，查找/创建用户，生成 JWT）
  - `update_user_language(email)` → `update_user_language(user_id)`，通过 `_id: ObjectId(user_id)` 查询
  - `update_user_theme(email)` → `update_user_theme(user_id)`，通过 `_id: ObjectId(user_id)` 查询
  - `get_user_language(email)` → `get_user_language(user_id)`，通过 `_id: ObjectId(user_id)` 查询
  - `get_or_create_user(email)` 保持原样（供 web 前端邮箱登录使用）
  - 保留 `get_user_id_by_email()` 辅助函数

- [x] Task 2: 修改 `db.py` — 新增 openid 索引
  - users 集合新增 `openid` 稀疏唯一索引
  - 新增 `bson` 的 ObjectId 导入（如尚未导入——已由 worker.py 使用）

- [x] Task 3: 修改 `main.py` — 适配 user_id 认证 + 新增微信登录端点
  - `require_auth()` 返回 `user_id`（从 JWT 的 `user_id` 字段提取）
  - 移除各端点中的 `get_user_id_by_email()` 调用（`require_auth` 已直接返回 `user_id`）
  - 移除 `get_user_id_by_email` 导入
  - 新增 `POST /api/auth/wechat-login` 端点
  - 所有端点中 `update_user_language`、`update_user_theme` 调用改为传 `user_id`
  - 邮箱登录端点（`send-code`、`verify`）保持不变（供 web 前端使用）
  - 新增 `wechat_login` 和 `get_user_id_by_email`（保留）的导入

- [x] Task 4: 修改 `worker.py` — 直接使用 user_id 调用 get_user_language
  - 移除 email 查找逻辑（`db.users.find_one({"_id": ObjectId(user_id)})` → 直接取 email 那段）
  - 改为直接调用 `get_user_language(user_id)`
  - 移除不再需要的 `from db import db` 在该代码块的引用

- [x] Task 5: 修改小程序 `AuthContext.tsx` — 自动微信登录
  - AuthState 中 `email` 字段改为 `userId`（或添加 `userId`）
  - 存储键 `scene_lingo_email` 改为 `scene_lingo_user_id`
  - 新增 `loginWechat()` 函数：调用 `Taro.login()` 获取 code → 调用 `api.wechatLogin(code)`
  - `useEffect` 启动时自动调用 `loginWechat()`
  - 移除手动 `login(token, email)` 函数，改为 `setAuth(token, userId)`
  - 保留 `logout()` 但小程序中无需调用（或移除退出逻辑）

- [x] Task 6: 修改小程序 `api.ts` — 新增微信登录 API
  - 新增 `wechatLogin(code: string)` 函数，调用 `POST /api/auth/wechat-login`
  - `getToken()` 保持从 storage 读取 token 的逻辑
  - 401 处理改为重定向到首页（而非登录页）

- [x] Task 7: 修改小程序 `app.tsx` — 启动时触发自动登录
  - 无需修改（AuthContext 的 useEffect 已处理）

- [x] Task 8: 移除小程序登录页面，更新路由配置
  - 删除 `miniprogram/src/pages/login/` 目录下的文件
  - `app.config.ts` 中移除 `'pages/login/index'`

- [x] Task 9: 修改小程序首页 — 移除登录/登出 UI 和 isLoggedIn 条件
  - 移除邮箱显示 (`home-header-email`)
  - 移除"登录"/"退出"按钮
  - 移除所有 `authState.isLoggedIn` 条件判断（照片加载、上传、删除等操作始终可用）
  - 移除 `handleLoginClick` 和 `handleLogout` 函数
  - 移除 `authState.loading` 时的条件（改为始终加载）

- [x] Task 10: 修改小程序 review/merge/wordbook/worddetail/settings 页面
  - 检查并移除各页面中 `authState.isLoggedIn` 相关的条件判断
  - 检查并移除与邮箱登录相关的逻辑

# Task Dependencies
- Task 3 依赖 Task 1（main.py 调用 auth 的新函数签名）
- Task 4 依赖 Task 1（worker.py 调用 `get_user_language` 新签名）
- Task 2 独立，可与其他后端任务并行
- Task 5、6、7 依赖 Task 1、3（需要后端新 API 就绪）
- Task 8、9、10 依赖 Task 5、6（小程序 AuthContext 变更后适配）
