# 邮箱验证码登录 & MongoDB 数据库 规格说明

## Why
当前登录使用手机号+短信验证码，但个人开发者无短信服务资质。改用邮箱验证码登录，无需第三方资质即可实现。同时引入 MongoDB 作为持久化数据库，替代内存存储验证码和 OSS meta.json 元数据，使查询更高效、数据更可靠。

## What Changes
- **BREAKING**：所有 `phone` 标识替换为 `email`（前端字段、JWT payload、OSS 路径、API 参数）
- 登录方式从"手机号+短信验证码"改为"邮箱+邮箱验证码"
- 移除阿里云短信 SDK 依赖，改用 Python 内置 `smtplib` 发送邮件
- 新增 MongoDB 数据库，使用 `motor` 异步驱动
- 验证码从内存字典迁移到 MongoDB `verification_codes` 集合（带 TTL 索引自动过期）
- 用户数据持久化到 MongoDB `users` 集合
- 照片元数据从 OSS `meta.json` 迁移到 MongoDB `photos` 集合（OSS 仅存二进制文件）
- 环境变量移除 `SMS_SIGN_NAME`/`SMS_TEMPLATE_CODE`，新增 `SMTP_*` 和 `MONGODB_URL`

## Impact
- Affected specs: login-oss-storage
- Affected code:
  - `backend/auth.py` — phone→email，验证码改用 MongoDB，移除短信代码
  - `backend/main.py` — phone→email，send-code 改为发送邮件
  - `backend/oss_client.py` — 路径中 phone→email
  - `backend/requirements.txt` — 移除 `alibabacloud_dysmsapi20170525`，新增 `motor`
  - `backend/.env` — 新增 MongoDB/SMTP 环境变量，移除 SMS 环境变量
  - `backend/db.py` — **新增**：MongoDB 连接和集合初始化
  - `frontend/src/pages/LoginPage.tsx` — 手机号输入→邮箱输入，校验逻辑变更
  - `frontend/src/context/AuthContext.tsx` — phone→email
  - `frontend/src/utils/api.ts` — phone→email

---
## ADDED Requirements

### Requirement: 邮箱验证码发送
系统 SHALL 通过 SMTP 协议向用户邮箱发送 6 位数字验证码。

#### Scenario: 发送验证码成功
- **WHEN** 用户在登录页输入邮箱地址并点击"获取验证码"
- **THEN** 前端调用 `POST /api/auth/send-code`，body: `{"email": "xxx@example.com"}`，后端通过 SMTP 向该邮箱发送 6 位数字验证码邮件，60 秒内不可重复发送，返回 `{"success": true, "message": "验证码已发送到邮箱"}`

#### Scenario: 60秒内重复发送被拒
- **WHEN** 用户在 60 秒内向同一邮箱再次请求发送验证码
- **THEN** 后端返回 429 状态码，提示"验证码已发送，请60秒后再试"

#### Scenario: 邮箱格式校验
- **WHEN** 用户输入的邮箱格式不合法
- **THEN** 后端返回 400 状态码，提示"请输入正确的邮箱地址"

#### Scenario: 开发模式降级
- **WHEN** SMTP 环境变量未配置
- **THEN** 验证码固定为 `"123456"` 并在控制台打印日志，方便前端调试

---
### Requirement: 邮箱验证码校验与登录
系统 SHALL 校验用户提交的邮箱验证码，通过后返回 JWT token。

#### Scenario: 验证码正确
- **WHEN** 用户输入正确的验证码（且未过期）并点击"登录"
- **THEN** 后端校验通过，若用户不存在则自动创建用户记录，生成 JWT token（有效期 30 天），返回 `{"token": "...", "email": "..."}`

#### Scenario: 验证码错误或过期
- **WHEN** 用户输入的验证码错误或已过期（超过 5 分钟）
- **THEN** 后端返回 400 状态码，提示"验证码错误或已过期"

#### Scenario: 验证码已使用
- **WHEN** 用户尝试用已使用过的验证码再次登录
- **THEN** 后端返回 400 状态码，提示"验证码错误或已过期"

---
### Requirement: MongoDB 数据库连接
系统 SHALL 在启动时连接 MongoDB，并初始化集合索引。

#### Scenario: 连接成功
- **WHEN** `MONGODB_URL` 环境变量配置正确
- **THEN** 后端启动时连接 MongoDB，创建 `users`、`verification_codes`、`photos` 三个集合，并创建必要的索引

#### Scenario: 连接失败降级
- **WHEN** `MONGODB_URL` 未配置或连接失败
- **THEN** 后端降级为内存模式：验证码使用内存字典，照片元数据仍从 OSS meta.json 读取，启动时打印警告日志
---

## MODIFIED Requirements

### Requirement: 用户标识从 phone 改为 email（来自 login-oss-storage）
所有系统组件 SHALL 使用 email 替代 phone 作为用户唯一标识：
- JWT token payload: `{"email": "..."}` 替代 `{"phone": "..."}`
- OSS 存储路径: `photos/{email}/{photoId}/...` 替代 `photos/{phone}/{photoId}/...`
- 前端 localStorage key: `scene_lingo_email` 替代 `scene_lingo_phone`
- API 请求/响应字段: `email` 替代 `phone`

### Requirement: 登录页 UI 改为邮箱输入（来自 login-oss-storage）
登录页 SHALL 将手机号输入框替换为邮箱输入框：
- 输入框 `type="email"`，placeholder 为"请输入邮箱地址"
- 前端校验邮箱格式（包含 `@` 和 `.`）
- 副标题文案从"手机号登录，同步你的学习记录"改为"邮箱登录，同步你的学习记录"

### Requirement: 照片元数据存储方式变更（来自 login-oss-storage）
系统 SHALL 将照片元数据从 OSS `meta.json` 迁移到 MongoDB `photos` 集合：
- OSS 仅存储原图和标注图的二进制文件
- 照片列表接口从 MongoDB 查询（而非遍历 OSS 对象）
- 上传时同时写入 MongoDB `photos` 集合和上传 OSS 文件
- 删除时同时从 MongoDB 删除记录和 OSS 删除文件

---
## REMOVED Requirements

### Requirement: 阿里云短信服务
**Reason**: 个人开发者无短信服务资质，改用 SMTP 邮箱发送。
**Migration**: 移除 `alibabacloud_dysmsapi20170525` 依赖，删除 `main.py` 中短信发送逻辑，所有 `phone` 相关代码替换为 `email`。

---
## 数据库设计

### MongoDB 集合结构

#### `users` 集合
```json
{
  "_id": ObjectId,
  "email": "user@example.com",
  "created_at": ISODate("2025-01-01T00:00:00Z"),
  "updated_at": ISODate("2025-01-01T00:00:00Z"),
  "last_login_at": ISODate("2025-01-01T00:00:00Z")
}
```
- 索引：`email` 唯一索引

#### `verification_codes` 集合
```json
{
  "_id": ObjectId,
  "email": "user@example.com",
  "code": "123456",
  "created_at": ISODate("2025-01-01T00:00:00Z"),
  "expires_at": ISODate("2025-01-01T00:05:00Z"),
  "used": false
}
```
- 索引：`email` 普通索引、`expires_at` TTL 索引（自动过期删除）

#### `photos` 集合
```json
{
  "_id": ObjectId,
  "photo_id": "uuid-string",
  "user_email": "user@example.com",
  "collection_date": "2025-01-01",
  "original_url": "https://scenelingo.oss-cn-hangzhou.aliyuncs.com/photos/user@example.com/uuid/original.jpg",
  "annotated_url": "https://scenelingo.oss-cn-hangzhou.aliyuncs.com/photos/user@example.com/uuid/annotated.jpg",
  "objects": [
    {
      "name": "apple",
      "phonetic": "/ˈæp.l/",
      "bbox": [100, 200, 300, 400],
      "examples": ["I ate a red apple.", "The apple fell from the tree."]
    }
  ],
  "created_at": ISODate("2025-01-01T00:00:00Z")
}
```
- 索引：`user_email` 普通索引、`user_email + collection_date` 复合索引

### 环境变量

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `MONGODB_URL` | MongoDB 连接字符串，如 `mongodb://localhost:27017` | 否（降级内存模式） |
| `SMTP_HOST` | SMTP 服务器地址，如 `smtp.qq.com` | 否（降级开发模式） |
| `SMTP_PORT` | SMTP 端口，如 `587` | 否 |
| `SMTP_USER` | SMTP 登录邮箱 | 否 |
| `SMTP_PASSWORD` | SMTP 授权码（非登录密码） | 否 |
| `SMTP_FROM` | 发件人邮箱（默认同 SMTP_USER） | 否 |

移除的环境变量：`SMS_SIGN_NAME`、`SMS_TEMPLATE_CODE`