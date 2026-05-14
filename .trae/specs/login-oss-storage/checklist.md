# Checklist

## 后端依赖与环境变量
- [x] `requirements.txt` 包含 `oss2`、`PyJWT`、`alibabacloud_dysmsapi20170525`
- [x] 所有敏感信息通过 `os.environ.get(...)` 读取，代码中不硬编码密钥
- [x] 未配置阿里云短信 AccessKey 时自动降级为固定验证码 `123456` 并打印日志

## 后端验证码与登录
- [x] `POST /api/auth/send-code` 正常发送或降级返回验证码
- [x] 60 秒内同一手机号重复请求被拒绝
- [x] 验证码 5 分钟过期
- [x] `POST /api/auth/verify` 正确校验验证码，返回 JWT token
- [x] 新手机号自动创建用户记录（无需注册步骤）
- [x] 手机号格式校验（1 开头 11 位）

## 后端 OSS 照片管理
- [x] Token 鉴权中间件正确从 `Authorization` 头提取并校验 token
- [x] `POST /api/photos/upload` 正确上传文件到 OSS（含 meta.json）
- [x] OSS 路径格式为 `photos/{phone}/{photoId}/...`
- [x] `GET /api/photos/list` 正确列出用户所有照片及其元数据
- [x] `DELETE /api/photos/delete` 正确删除 OSS 文件

## 前端 AuthContext
- [x] `AuthProvider` 从 localStorage 正确恢复 token
- [x] `login()` 正确调用后端接口并存储 token
- [x] `logout()` 正确清除 token 和状态
- [x] `useAuth` hook 可正常使用

## 前端 API 工具
- [x] `api.ts` 自动在请求中附带 `Authorization` 头
- [x] `api.ts` 统一处理 401 错误（token 过期时自动登出）

## 前端 LoginPage
- [x] 登录页 UI 符合 App 明亮活泼风格
- [x] 手机号输入框限制 11 位数字
- [x] "获取验证码"按钮发送后倒计时 60 秒，期间置灰不可点击
- [x] 验证码正确时登录成功跳转首页
- [x] 底部"暂不登录，先体验"可跳过登录进入首页

## App 路由集成
- [x] 未登录用户自动跳转登录页
- [x] 登录成功后正常进入首页
- [x] 退出登录后跳转登录页
- [x] `AppPage` 包含 `'login'` 类型

## 本地存储 10 张上限
- [x] 未登录用户本地照片 < 10 张时正常保存
- [x] 未登录用户本地照片达到 10 张时弹出登录引导弹窗
- [x] 引导弹窗包含"去登录"和"取消"按钮

## 保存分流
- [x] 未登录 → IndexedDB 本地保存（上限检查）
- [x] 已登录 → OSS 云端保存（`/api/photos/upload`）
- [x] 已登录用户首页加载云端照片列表
- [x] 已登录用户删除云端照片

## 退出登录
- [x] 已登录用户可见退出登录入口
- [x] 退出后 localStorage token 被清除
- [x] 退出后页面跳转到登录页

## 单词本兼容
- [x] 未登录 → WordBookPage 从 IndexedDB 读取
- [x] 已登录 → WordBookPage 从云端 API 读取
- [x] WordDetailPage 同样适配两种数据源

## 边界情况
- [x] 网络异常时登录/上传操作有合理的错误提示
- [x] token 过期后自动跳转登录页
- [x] OSS 上传失败时提示用户重试
- [x] 从登录到首页的过渡动画流畅