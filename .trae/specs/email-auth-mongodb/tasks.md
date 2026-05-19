# Tasks

## Task 1: 后端新增 MongoDB 连接模块

创建 `backend/db.py`，封装 MongoDB 连接与集合初始化。

- [x] SubTask 1.1: 创建 `get_db()` 异步函数，连接 MongoDB（从 `MONGODB_URL` 环境变量读取），返回数据库实例
- [x] SubTask 1.2: 创建 `init_db()` 函数，初始化三个集合及索引：
  - `users`: `email` 唯一索引
  - `verification_codes`: `email` 普通索引 + `expires_at` TTL 索引
  - `photos`: `user_email` 普通索引 + `user_email + collection_date` 复合索引
- [x] SubTask 1.3: 若 `MONGODB_URL` 未配置或连接失败，返回 `None` 并打印警告日志，不阻塞启动
- [x] SubTask 1.4: 确保 MongoDB 连接在整个 FastAPI 生命周期中正确管理（`app.add_event_handler("startup", ...)` 初始化 + `"shutdown"` 关闭连接）

**依赖**: 无

---

## Task 2: 后端更新依赖和环境变量

更新依赖文件和环境变量配置。

- [x] SubTask 2.1: 更新 `backend/requirements.txt`：移除 `alibabacloud_dysmsapi20170525`，新增 `motor`（异步 MongoDB 驱动）
- [x] SubTask 2.2: 更新 `backend/.env`：移除 `SMS_SIGN_NAME`、`SMS_TEMPLATE_CODE`，新增 `MONGODB_URL`、`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASSWORD`、`SMTP_FROM`

**依赖**: 无

---

## Task 3: 后端重写 auth.py（phone→email + MongoDB + SMTP）

将验证码和 Token 逻辑从 phone 迁移到 email，验证码存储改用 MongoDB。

- [x] SubTask 3.1: 验证码生成逻辑：从 MongoDB `verification_codes` 集合写入验证码记录（含 `email`、`code`、`created_at`、`expires_at`、`used: false`），60 秒内同一邮箱不可重复发送（查 MongoDB 中该邮箱未过期且 created_at 在 60 秒内的记录）
- [x] SubTask 3.2: 验证码校验逻辑：从 MongoDB `verification_codes` 集合查找匹配 email + code + 未过期 + 未使用的记录，校验通过后标记 `used: true`
- [x] SubTask 3.3: JWT Token: `generate_token(email)` payload 中 `{"email": "..."}` 替代 `{"phone": "..."}`，`verify_token(token)` 返回 email
- [x] SubTask 3.4: 实现 `send_email(to_email, code)` 函数：使用 `smtplib` 通过 SMTP 发送验证码邮件，邮件标题"场景外语 - 登录验证码"，内容包含验证码数字。SMTP 配置从环境变量读取（`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM`），支持 STARTTLS
- [x] SubTask 3.5: 用户管理：`get_or_create_user(email)` 函数，在 MongoDB `users` 集合中查找或创建用户记录，登录时更新 `last_login_at`
- [x] SubTask 3.6: 降级兼容：若 MongoDB 不可用，验证码回退到内存字典存储；若 SMTP 未配置，验证码固定为 `"123456"` 并打印到控制台

**依赖**: Task 1

---

## Task 4: 后端重写 main.py（phone→email + 邮箱接口 + MongoDB 照片 CRUD）

更新所有路由，phone→email，接入 MongoDB 和 SMTP。

- [x] SubTask 4.1: `require_auth` 中间件：从 token 解析 email 替代 phone
- [x] SubTask 4.2: `POST /api/auth/send-code`：body `{"email": "..."}` 替代 `{"phone": "..."}`，校验邮箱格式（正则匹配），调用 `generate_code(email)` 和 `send_email(email, code)`，移除阿里云短信调用代码
- [x] SubTask 4.3: `POST /api/auth/verify`：body `{"email": "...", "code": "..."}` 替代 `{"phone": "...", "code": "..."}`，返回 `{"token": "...", "email": "..."}` 替代 `{"token": "...", "phone": "..."}`
- [x] SubTask 4.4: `POST /api/photos/upload`：上传完成后将照片元数据写入 MongoDB `photos` 集合（`photo_id`、`user_email`、`collection_date`、`original_url`、`annotated_url`、`objects`、`created_at`），OSS 不再上传 meta.json
- [x] SubTask 4.5: `GET /api/photos/list`：从 MongoDB `photos` 集合查询该用户的所有照片（按 `collection_date` 降序），而非遍历 OSS meta.json
- [x] SubTask 4.6: `DELETE /api/photos/delete`：同时从 MongoDB `photos` 集合删除记录 + OSS 删除文件
- [x] SubTask 4.7: 降级兼容：若 MongoDB 不可用，照片列表回退到 OSS meta.json 方式

**依赖**: Task 1, Task 3

---

## Task 5: 后端更新 oss_client.py（phone→email）

OSS 存储路径中 phone 替换为 email。

- [x] SubTask 5.1: `upload_photo`、`list_user_photos`、`delete_photo` 等函数参数从 `phone: str` 改为 `email: str`
- [x] SubTask 5.2: OSS 路径从 `photos/{phone}/{photoId}/...` 改为 `photos/{email}/{photoId}/...`
- [x] SubTask 5.3: 图片 URL 中路径段同步更新

**依赖**: 无（可与 Task 3/4 并行）

---

## Task 6: 前端更新 AuthContext（phone→email）

AuthContext 状态和持久化 key 从 phone 改为 email。

- [x] SubTask 6.1: `AuthState.phone` 改为 `AuthState.email`
- [x] SubTask 6.2: `login(token, email)` 参数和 localStorage key 更新：`scene_lingo_phone` → `scene_lingo_email`
- [x] SubTask 6.3: `logout()` 中清除 `scene_lingo_email` 替代 `scene_lingo_phone`
- [x] SubTask 6.4: 恢复登录时从 localStorage 读取 `scene_lingo_email`

**依赖**: 无

---

## Task 7: 前端更新 api.ts（phone→email）

API 请求方法参数从 phone 改为 email。

- [x] SubTask 7.1: `sendCode(email)` 替代 `sendCode(phone)`
- [x] SubTask 7.2: `verify(email, code)` 替代 `verify(phone, code)`，返回类型中 `phone` 改为 `email`
- [x] SubTask 7.3: 401 处理中 `localStorage.removeItem('scene_lingo_phone')` 改为 `localStorage.removeItem('scene_lingo_email')`

**依赖**: 无

---

## Task 8: 前端重写 LoginPage（邮箱输入 + 校验）

登录页从手机号输入改为邮箱输入。

- [x] SubTask 8.1: 将 `phone` state 改为 `email` state，输入框 `type="email"`，placeholder 为"请输入邮箱地址"
- [x] SubTask 8.2: 前端邮箱格式校验：包含 `@` 和 `.` 的基本校验
- [x] SubTask 8.3: "获取验证码"按钮 disabled 条件改为 `email` 格式不合法或倒计时中
- [x] SubTask 8.4: 副标题文案从"手机号登录，同步你的学习记录"改为"邮箱登录，同步你的学习记录"
- [x] SubTask 8.5: `handleSendCode` 和 `handleLogin` 中 phone→email 参数替换
- [x] SubTask 8.6: 登录成功后 `auth.login(result.token, result.email)` 替代 `auth.login(result.token, result.phone)`

**依赖**: Task 6, Task 7

---

## Task 9: 前端更新 HomePage/ReviewPage 等页面（phone→email 引用）

清理所有页面中残留的 phone 引用。

- [x] SubTask 9.1: HomePage 中 `authState.phone` → `authState.email`（如有引用）
- [x] SubTask 9.2: 检查 ReviewPage、WordBookPage、WordDetailPage 中是否有 phone 引用并更新
- [x] SubTask 9.3: 检查 `indexedDB.ts` 中 `isLoggedIn` 函数引用是否需要更新

**依赖**: Task 6

---

# Task Dependencies

- Task 1（db.py）可独立开发
- Task 2（依赖/环境变量）可独立开发
- Task 3（auth.py）依赖 Task 1
- Task 4（main.py）依赖 Task 1, Task 3
- Task 5（oss_client.py）可独立开发，可与 Task 3/4 并行
- Task 6（AuthContext）可独立开发
- Task 7（api.ts）可独立开发
- Task 8（LoginPage）依赖 Task 6, Task 7
- Task 9（其他页面）依赖 Task 6

并行组 1: Task 1, Task 2, Task 5, Task 6, Task 7
并行组 2: Task 3, Task 8（在并行组 1 完成后）
串行: Task 4 在 Task 3 之后，Task 9 在 Task 6 之后