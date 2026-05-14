# 登录模块 & OSS 云存储 规格说明

## Why
当前 App 无登录机制，所有照片纯本地存储，无法跨设备同步，无法在卸载后恢复。引入手机号+验证码登录后，登录用户照片上传至阿里云 OSS，支持云端存储和跨设备访问。同时为未登录用户保留本地存储，但限制最多 10 张，引导用户登录。

## What Changes
- 新增登录/注册页面：手机号 + 短信验证码登录（阿里云短信服务）
- 未登录用户：IndexedDB 本地存储，最多保存 10 张照片，超出时弹出登录引导提示
- 登录用户：照片保存到阿里云 OSS（`scenelingo.oss-cn-hangzhou.aliyuncs.com`），支持查看云端照片列表、下载照片
- 后端新增 `/api/auth/send-code`（发送验证码）、`/api/auth/verify`（验证登录）接口
- 后端新增 `/api/photos/upload`（上传到 OSS）、`/api/photos/list`（云端照片列表）、`/api/photos/delete`（删除云端照片）
- 前端新增 AuthContext 管理登录状态（token 持久化到 localStorage）
- 前端新增 LoginPage 页面、AppPage 新增 `'login'` 路由
- **BREAKING**：保存照片逻辑需根据登录状态分流（本地 vs OSS）
- 敏感信息（阿里云 AccessKey、短信签名/模板）从环境变量读取

## Impact
- Affected specs: scene-english-learning, ui-redesign-daily-collections, bubble-annotation-phonetics
- Affected code:
  - `backend/main.py` — 新增 `/api/auth/send-code`、`/api/auth/verify`、OSS 相关接口；新增阿里云 SDK 依赖
  - `backend/requirements.txt` — 新增 `oss2`、`pyjwt`（或简单 token）、阿里云短信 SDK
  - `frontend/src/context/AuthContext.tsx` — **新增**：登录状态管理
  - `frontend/src/context/ReviewContext.tsx` — AppPage 新增 `'login'`
  - `frontend/src/pages/LoginPage.tsx` — **新增**：手机号+验证码登录页
  - `frontend/src/pages/HomePage.tsx` — 上传限制与登录引导、保存分流
  - `frontend/src/pages/ReviewPage.tsx` — 保存分流（本地 vs OSS 上传）
  - `frontend/src/App.tsx` — 引入 AuthProvider、login 路由、未登录用户首页重定向逻辑
  - `frontend/src/App.css` — 登录页样式
  - `frontend/src/utils/indexedDB.ts` — 新增 `countPhotos` 函数
  - `frontend/src/utils/api.ts` — **新增**：封装后端 API 请求

---

## ADDED Requirements

### Requirement 1: 手机号验证码登录
系统 SHALL 提供手机号 + 短信验证码的登录方式，使用阿里云短信服务发送验证码。

#### Scenario 1.1: 发送验证码
- **WHEN** 用户在登录页输入手机号并点击"获取验证码"
- **THEN** 前端调用 `POST /api/auth/send-code`，后端通过阿里云短信服务向该手机号发送 6 位数字验证码，60 秒内不可重复发送

#### Scenario 1.2: 验证登录
- **WHEN** 用户输入验证码并点击"登录"
- **THEN** 前端调用 `POST /api/auth/verify`，后端校验验证码，成功则返回 token（JWT 或简单随机 token），前端将 token 存入 localStorage

#### Scenario 1.3: 新用户自动注册
- **WHEN** 未注册的手机号验证通过
- **THEN** 系统自动创建用户记录，返回 token，用户无需额外注册步骤

#### Scenario 1.4: 验证码有效期
- **WHEN** 验证码超过 5 分钟未使用
- **THEN** 验证码失效，需重新获取

#### Scenario 1.5: 已登录状态
- **WHEN** App 启动时检测到 localStorage 中存在有效 token
- **THEN** 自动恢复登录状态，跳过登录页，直接进入首页（显示云端照片）

---

### Requirement 2: 未登录用户本地存储限制
系统 SHALL 限制未登录用户在本地最多保存 10 张照片，超出时引导登录。

#### Scenario 2.1: 10 张以内正常保存
- **WHEN** 未登录用户保存照片且本地已有照片数 < 10
- **THEN** 正常保存到 IndexedDB

#### Scenario 2.2: 达到 10 张上限
- **WHEN** 未登录用户尝试保存第 11 张照片
- **THEN** 前端弹出提示"本地最多保存10张照片，登录后可无限存储"，提供"去登录"按钮，照片不保存

#### Scenario 2.3: 上传时检查
- **WHEN** 未登录用户选择照片进入审核流程时本地已达 10 张
- **THEN** 同样弹出登录引导提示

---

### Requirement 3: OSS 云端存储
系统 SHALL 为已登录用户将照片（原图 + 标注图）上传至阿里云 OSS（`scenelingo.oss-cn-hangzhou.aliyuncs.com`）。

#### Scenario 3.1: 保存照片到 OSS
- **WHEN** 登录用户在审核页点击"保存"
- **THEN** 前端将原图 dataUrl 和标注后 dataUrl 转为 Blob，通过 `POST /api/photos/upload` 上传至 OSS，路径为 `photos/{phone}/{photoId}/original.jpg` 和 `photos/{phone}/{photoId}/annotated.jpg`

#### Scenario 3.2: 加载云端照片列表
- **WHEN** 登录用户进入首页
- **THEN** 前端调用 `GET /api/photos/list`，后端从 OSS 读取用户目录下的照片元数据列表（OSS object metadata 或单独维护的 JSON 文件），返回照片 ID、OSS URL、创建时间、collectionDate、objects 等

#### Scenario 3.3: 云端照片按日期分组
- **WHEN** 登录用户在首页查看 Collection
- **THEN** 云端照片同样按 `collectionDate` 分组展示，与本地照片行为一致

#### Scenario 3.4: 删除云端照片
- **WHEN** 登录用户在首页删除某张照片
- **THEN** 前端调用 `DELETE /api/photos/delete?id={photoId}`，后端从 OSS 删除对应文件

#### Scenario 3.5: 重新处理云端照片
- **WHEN** 登录用户点击已保存云端照片进行重新处理
- **THEN** 前端下载 OSS 上的原图 dataUrl，进入审核模式，重新保存时覆盖 OSS 上的标注图

---

### Requirement 4: 登录页 UI
系统 SHALL 提供简洁美观的登录页面。

#### Scenario 4.1: 登录页布局
- **WHEN** 用户未登录打开 App
- **THEN** 显示登录页，包含：
  - App Logo 和名称"场景英语"
  - 手机号输入框（中国大陆手机号格式校验）
  - 验证码输入框 + "获取验证码"按钮（60 秒倒计时）
  - "登录"按钮

#### Scenario 4.2: 登录页跳过
- **WHEN** 用户不想登录
- **THEN** 登录页底部有"暂不登录，先体验"文字链接，点击后进入首页（本地模式，上限 10 张）

---

### Requirement 5: 登录状态切换
系统 SHALL 支持用户在已登录状态下退出登录，切换到本地模式。

#### Scenario 5.1: 退出登录
- **WHEN** 已登录用户点击首页某个入口的"退出登录"
- **THEN** 清除 localStorage 中的 token，刷新为未登录首页（展示本地 10 张限制提示或空状态，不显示云端照片）

---

## MODIFIED Requirements

### Requirement: 照片保存流程 (来自所有已有 specs)
保存照片时，系统 SHALL 根据登录状态选择存储方式：
- 未登录：保存到 IndexedDB（上限 10 张）
- 已登录：上传到 OSS

---

## 技术方案概要

### 后端新增接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/auth/send-code` | POST | 发送短信验证码，body: `{phone}` |
| `/api/auth/verify` | POST | 验证码登录，body: `{phone, code}`，返回 `{token}` |
| `/api/photos/upload` | POST | 上传照片到 OSS，form-data: file + metadata |
| `/api/photos/list` | GET | 获取用户云端照片列表，header: `Authorization: Bearer {token}` |
| `/api/photos/delete` | DELETE | 删除云端照片，query: `id` |

### 验证码存储
- 内存字典 `{phone: {code, expires_at}}`，5 分钟过期
- 生产环境建议 Redis，但当前阶段内存存储即可

### OSS 目录结构
```
scenelingo/
└── photos/
    └── {phone}/
        └── {photoId}/
            ├── original.jpg
            ├── annotated.jpg
            └── meta.json          # {objects, collectionDate, createdAt}
```

### 前端 AuthContext
```typescript
interface AuthState {
  token: string | null;
  phone: string | null;
  isLoggedIn: boolean;
}
```
- 从 localStorage 读取 token 初始化
- `login(phone, code)` → 调用后端 → 存 token
- `logout()` → 清除 token
- `AuthProvider` 包裹 `ReviewProvider`

### 环境变量
- `ALIBABA_CLOUD_ACCESS_KEY_ID`
- `ALIBABA_CLOUD_ACCESS_KEY_SECRET`
- `SMS_SIGN_NAME`（短信签名）
- `SMS_TEMPLATE_CODE`（短信模板代码）
- `OSS_BUCKET_NAME`（默认 scenelingo）
- `OSS_ENDPOINT`（默认 oss-cn-hangzhou.aliyuncs.com）
- `JWT_SECRET`（或 token 密钥）