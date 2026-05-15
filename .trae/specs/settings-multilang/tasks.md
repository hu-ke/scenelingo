# Tasks

- [x] Task 1: 定义语言类型与偏好存储工具
  - 在 `frontend/src/utils/` 创建 `languagePrefs.ts`，定义语言选项常量、语言偏好类型（`nativeLang`、`targetLang`），导出读写 localStorage 的工具函数（`getLanguagePrefs`、`setLanguagePrefs`）
  - 定义 `TTS_LANG_MAP` 映射（语言码 → TTS lang 字符串，如 `en` → `en-US`、`ja` → `ja-JP`），导出 `getTtsLang(targetLang)` 工具函数
  - 定义 `getPromptDescription(nativeLang, targetLang)` 工具函数

- [x] Task 2: 创建 SettingsPage 页面组件
  - 新建 `frontend/src/pages/SettingsPage.tsx`，实现语言选择器 UI（母语和目标语言各一个下拉选择框），展示当前设置，有"保存"和"返回"按钮
  - 页面底部显示当前生效的语言偏好摘要

- [x] Task 3: 注册 settings 路由和导航
  - 在 `ReviewContext.tsx` 的 `AppPage` 类型中新增 `'settings'`
  - 在 `App.tsx` 的 switch 中新增 `case 'settings': return <SettingsPage />`
  - 在 `HomePage.tsx` header 区域（用户名右边）添加一个齿轮图标按钮 ⚙️，点击 dispatch `setPage: 'settings'`
  - 在 `SettingsPage` 的"返回"按钮中 dispatch `setPage: 'home'`

- [x] Task 4: 后端语言偏好存储与同步
  - 在 `backend/auth.py` 中修改 `get_or_create_user()` 返回值，附带已存储的 `nativeLang`/`targetLang`
  - 在 `auth.py` 中新增 `update_user_language(email, nativeLang, targetLang)` 函数，更新 MongoDB users 集合
  - 在 `main.py` 中新增 `POST /api/user/language` 端点（接收 `{ nativeLang, targetLang }`）
  - 在 `auth/verify` 接口返回中附带已有语言偏好
  - 在 `frontend/src/utils/api.ts` 中新增 `updateLanguage(nativeLang, targetLang)` 调用

- [x] Task 5: AI Prompt 动态化
  - 修改 `backend/main.py` 的 `recognize` 接口，接收前端传来的 `nativeLang`/`targetLang` 参数（可选，默认 `zh`/`en`）
  - 根据语言对动态构建 prompt 文本（替换硬编码的 "English"/"Chinese"）

- [x] Task 6: 前端 TTS 语音合成动态化
  - 修改 `frontend/src/components/AnnotatedImage.tsx` 中的 `utterance.lang`，从 `languagePrefs` 获取目标语言的 TTS lang
  - 修改 `frontend/src/pages/ReviewPage.tsx` 中的 `u.lang`，同上
  - 修改 `frontend/src/pages/WordDetailPage.tsx` 中的 `utterance.lang`，同上

- [x] Task 7: 前端语言偏好全局状态与同步
  - 在 `ReviewContext.tsx` 的 state 中新增 `nativeLang`/`targetLang` 字段
  - 在 App 启动时从 localStorage 读取语言偏好并写入全局 state
  - 已登录用户在登录成功后调用后端获取语言偏好，覆盖本地值
  - SettingsPage 保存时同时更新 localStorage、全局 state、以及（登录时）调用后端 API

- [x] Task 8: 验证构建通过
  - 运行 `npm run build` 确保前端编译通过
  - 运行后端语法检查确保无报错

# Task Dependencies
- Task 2 依赖 Task 1（语言工具函数）
- Task 3 依赖 Task 2（页面组件）
- Task 4 独立，可并行
- Task 5 依赖 Task 1 和 Task 4（需要语言偏好端点）
- Task 6 依赖 Task 1（TTS 映射）
- Task 7 依赖 Task 1、Task 2、Task 4
- Task 8 依赖所有前序任务
