# Tasks

## Task 1: 后端新增依赖和验证码/OSS 基础设施

安装阿里云 SDK 依赖，实现验证码发送/校验、Token 签发/校验、OSS 客户端封装。

- [x] SubTask 1.1: 更新 `backend/requirements.txt`，新增 `oss2`、`PyJWT`、阿里云短信 SDK（`alibabacloud_dysmsapi20170525`）
- [x] SubTask 1.2: 实现验证码管理模块：内存字典 `{phone: {code, expires_at}}`，5 分钟过期，60 秒内同一手机号不可重复发送
- [x] SubTask 1.3: 实现 Token 工具：`generate_token(phone)` → JWT（有效期 30 天），`verify_token(token)` → 解析出 phone
- [x] SubTask 1.4: 实现 OSS 客户端封装：上传文件/删除文件/列出目录下文件/生成访问 URL
- [x] SubTask 1.5: 敏感信息全部从 `os.environ.get(...)` 读取

**依赖**: 无

---

## Task 2: 后端实现登录接口

新增 `/api/auth/send-code` 和 `/api/auth/verify` 两个接口。

- [x] SubTask 2.1: `POST /api/auth/send-code` — body `{phone}`，校验手机号格式（中国大陆 1 开头的 11 位数字），调用阿里云短信 API 发送 6 位随机验证码，存入内存字典，返回 `{success: true, message: "验证码已发送"}`
- [x] SubTask 2.2: `POST /api/auth/verify` — body `{phone, code}`，校验验证码是否匹配且未过期，生成 JWT token 返回 `{token, phone}`，新用户自动视为注册
- [x] SubTask 2.3: 开发阶段降级方案：当未配置阿里云短信 AccessKey 时，验证码固定为 `"123456"` 并打印到控制台日志，方便前端调试

**依赖**: Task 1

---

## Task 3: 后端实现 OSS 照片管理接口

新增照片上传、列表、删除接口，带 Token 鉴权中间件。

- [x] SubTask 3.1: 实现 Token 鉴权中间件：从 `Authorization: Bearer {token}` 头中提取 token，校验有效性，注入 `request.state.phone`
- [x] SubTask 3.2: `POST /api/photos/upload` — 接收 form-data（`file` + `metadata` JSON 字符串），上传原图/标注图到 OSS，路径 `photos/{phone}/{photoId}/original.jpg`，同时上传 `meta.json`（包含 objects, collectionDate, createdAt）
- [x] SubTask 3.3: `GET /api/photos/list` — 列出用户 OSS 目录下所有照片，读取每张照片的 `meta.json`，返回照片列表（id, originalUrl, annotatedUrl, objects, collectionDate, createdAt）
- [x] SubTask 3.4: `DELETE /api/photos/delete?id={id}` — 删除 OSS 上指定照片目录下的所有文件

**依赖**: Task 1, Task 2

---

## Task 4: 前端新增 API 工具模块和 AuthContext

创建 API 请求封装和登录状态管理 Context。

- [x] SubTask 4.1: 创建 `frontend/src/utils/api.ts`，封装 `fetch` 请求，自动附带 `Authorization` 头（从 localStorage 读取），统一处理错误
- [x] SubTask 4.2: 创建 `frontend/src/context/AuthContext.tsx`：
  - `AuthState`: `{token, phone, isLoggedIn}`
  - `AuthAction`: `login`, `logout`, `setAuth`
  - `AuthProvider` 从 localStorage 恢复 token，初始化时校验 token 有效性（调 `/api/photos/list` 试探）
  - 导出 `useAuth` hook

**依赖**: 无

---

## Task 5: 前端新增 LoginPage

创建登录页面组件。

- [x] SubTask 5.1: 创建 `frontend/src/pages/LoginPage.tsx`
- [x] SubTask 5.2: 登录逻辑：调用 `api.sendCode(phone)` → `api.verify(phone, code)` → 拿到 token 存入 AuthContext → 跳转首页
- [x] SubTask 5.3: 登录页样式（内联 + 复用 App.css 类）

**依赖**: Task 4

---

## Task 6: 前端 App.tsx 集成 Auth + 登录路由

将 AuthProvider 和 LoginPage 集成到 App 路由中。

- [x] SubTask 6.1: `AppPage` 类型新增 `'login'`
- [x] SubTask 6.2: `App.tsx` 用 `AuthProvider` 包裹 `ReviewProvider`
- [x] SubTask 6.3: 未登录 → 渲染 LoginPage，已登录 → 正常路由

**依赖**: Task 4, Task 5

---

## Task 7: 前端 IndexedDB 新增数量检查

新增本地照片计数功能，实现 10 张上限检查。

- [x] SubTask 7.1: 在 `indexedDB.ts` 中新增 `countPhotos(): Promise<number>` 函数
- [x] SubTask 7.2: 在 `indexedDB.ts` 中新增 `isLoggedIn(): boolean` 辅助函数（检查 localStorage token）

**依赖**: 无

---

## Task 8: 前端 HomePage 和 ReviewPage 保存分流

根据登录状态，保存时选择本地 IndexedDB 或 OSS 上传。

- [x] SubTask 8.1: HomePage 上传入口增加检查：未登录 + 本地照片 ≥ 10 → 弹出登录引导弹窗
- [x] SubTask 8.2: ReviewPage 保存逻辑分流（本地 IndexedDB / OSS 上传）
- [x] SubTask 8.3: 已登录用户首页加载照片：调用 `GET /api/photos/list` 获取云端照片列表
- [x] SubTask 8.4: 已登录用户删除照片：调用 `DELETE /api/photos/delete`

**依赖**: Task 3, Task 4, Task 7

---

## Task 9: 首页增加退出登录入口

在首页添加退出登录按钮。

- [x] SubTask 9.1: 在首页 Header 右上角添加"退出登录"按钮（仅已登录用户可见）
- [x] SubTask 9.2: 点击后清除 AuthContext token 和 localStorage，dispatch setPage('login')

**依赖**: Task 4, Task 6

---

## Task 10: 更新 WordBookPage 和 WordDetailPage 兼容云端数据

确保单词本和单词详情页能正确处理来自云端的照片数据。

- [x] SubTask 10.1: WordBookPage 数据源根据登录状态切换（云端 API / 本地 IndexedDB）
- [x] SubTask 10.2: WordDetailPage 同样适配两种数据源

**依赖**: Task 8

---

# Task Dependencies
- Task 1 可独立开发
- Task 2 依赖 Task 1
- Task 3 依赖 Task 1, Task 2
- Task 4 可独立开发
- Task 5 依赖 Task 4
- Task 6 依赖 Task 4, Task 5
- Task 7 可独立开发
- Task 8 依赖 Task 3, Task 4, Task 7
- Task 9 依赖 Task 4, Task 6
- Task 10 依赖 Task 8
- Task 1 + Task 4 + Task 7 可并行开发
- Task 2 + Task 5 可在 Task 1/Task 4 完成后并行
- Task 3 + Task 6 可在 Task 2/Task 5 完成后并行
- Task 8 + Task 9 可在 Task 3/Task 6/Task 7 完成后并行
- Task 10 最后执行