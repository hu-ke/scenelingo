# Checklist

## 后端 MongoDB 连接
- [x] `backend/db.py` 文件存在，包含 `get_db()` 和 `init_db()` 函数
- [x] `MONGODB_URL` 配置后能正确连接 MongoDB
- [x] `MONGODB_URL` 未配置时启动不报错，打印警告日志并返回 `None`
- [x] `users` 集合存在 `email` 唯一索引
- [x] `verification_codes` 集合存在 `email` 索引和 `expires_at` TTL 索引
- [x] `photos` 集合存在 `user_email` 索引和 `user_email + collection_date` 复合索引
- [x] FastAPI startup/shutdown 事件中正确初始化和关闭 MongoDB 连接

## 后端依赖与环境变量
- [x] `requirements.txt` 不包含 `alibabacloud_dysmsapi20170525`
- [x] `requirements.txt` 包含 `motor`
- [x] `.env` 中不存在 `SMS_SIGN_NAME` 和 `SMS_TEMPLATE_CODE`
- [x] `.env` 中存在 `MONGODB_URL`、`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASSWORD`、`SMTP_FROM` 字段
- [x] 所有敏感信息通过 `os.environ.get(...)` 读取，代码中不硬编码

## 后端邮箱验证码
- [x] `POST /api/auth/send-code` 接受 `{"email": "..."}` 而非 `{"phone": "..."}`
- [x] 邮箱格式非法时返回 400 错误
- [x] 60 秒内同一邮箱重复发送返回 429 错误
- [x] SMTP 未配置时降级为固定验证码 `123456` 并打印控制台日志
- [x] SMTP 配置正确时能成功发送验证码邮件到邮箱
- [x] 邮件标题为"场景外语 - 登录验证码"，内容包含验证码数字

## 后端验证码校验（MongoDB）
- [x] `POST /api/auth/verify` 接受 `{"email": "...", "code": "..."}` 而非 `{"phone": "...", "code": "..."}`
- [x] 验证码正确且未过期时返回 `{"token": "...", "email": "..."}`
- [x] 验证码错误时返回 400 错误
- [x] 验证码过期（超过 5 分钟）时返回 400 错误
- [x] 验证码已使用（`used: true`）时返回 400 错误
- [x] 验证通过后 `verification_codes` 中对应记录 `used` 标记为 `true`
- [x] 新邮箱自动创建 `users` 记录
- [x] MongoDB 不可用时降级为内存字典存储

## 后端 JWT Token
- [x] `generate_token(email)` 生成的 token payload 包含 `email` 字段（不含 `phone`）
- [x] `verify_token(token)` 返回 email 字符串
- [x] Token 有效期 30 天
- [x] Token 过期后 `verify_token` 返回 `None`

## 后端 OSS 照片管理（phone→email）
- [x] OSS 路径格式为 `photos/{email}/{photoId}/...`（非 `photos/{phone}/...`）
- [x] `POST /api/photos/upload` 正确上传原图和标注图到 OSS
- [x] 上传成功后照片元数据写入 MongoDB `photos` 集合
- [x] `GET /api/photos/list` 从 MongoDB `photos` 集合查询（非 OSS meta.json）
- [x] `DELETE /api/photos/delete` 同时删除 MongoDB 记录和 OSS 文件
- [x] MongoDB 不可用时照片列表降级为 OSS meta.json 方式

## 前端 AuthContext
- [x] `AuthState` 中 `phone` 字段改为 `email`
- [x] `login(token, email)` 参数包含 `email` 而非 `phone`
- [x] localStorage key 为 `scene_lingo_email`（非 `scene_lingo_phone`）
- [x] `logout()` 清除 `scene_lingo_email`
- [x] 启动时从 `scene_lingo_email` 恢复登录状态

## 前端 API 工具
- [x] `api.sendCode(email)` 参数为 `email` 非 `phone`
- [x] `api.verify(email, code)` 参数为 `email` 非 `phone`，返回类型包含 `email`
- [x] 401 处理中清除 `scene_lingo_email` 非 `scene_lingo_phone`

## 前端 LoginPage
- [x] 登录页副标题为"邮箱登录，同步你的学习记录"
- [x] 输入框为邮箱类型，placeholder 为"请输入邮箱地址"
- [x] 邮箱格式校验：包含 `@` 和 `.`
- [x] "获取验证码"按钮在邮箱格式不合法时 disabled
- [x] 登录成功后调用 `auth.login(result.token, result.email)`
- [x] 底部"暂不登录，先体验"可正常跳转首页

## 前端全局 phone→email 清理
- [x] HomePage 中无 `phone` 残留引用
- [x] ReviewPage 中无 `phone` 残留引用
- [x] WordBookPage 中无 `phone` 残留引用
- [x] WordDetailPage 中无 `phone` 残留引用
- [x] `indexedDB.ts` 中无 `phone` 残留引用

## 边界情况
- [x] MongoDB 未配置时整个应用仍可正常启动和运行（降级模式）
- [x] SMTP 未配置时验证码走降级模式（控制台打印）
- [x] 网络异常时登录/上传操作有合理的错误提示
- [x] Token 过期后自动清除并回到未登录首页
- [x] OSS 操作失败时前端显示错误提示