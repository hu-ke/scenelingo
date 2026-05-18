# Tasks

- [x] Task 1: 修复 API 层（`utils/api.ts`）和构建配置
  对齐后端实际端点，修复 BASE_URL 配置，删除不存在的异步识别 API，新增缺失的 API 方法。
  - [x] SubTask 1.1: 在 `config/dev.ts` 和 `config/prod.ts` 中通过 `defineConstants` 注入 `BASE_URL` 环境变量，`api.ts` 中读取
  - [x] SubTask 1.2: 删除 `recognizeAsync`、`getRecognitionStatus`、`getRecognitionStatusBatch` 三个不存在的 API 方法
  - [x] SubTask 1.3: 修复 `recognize` 方法，使用 `Taro.uploadFile` 向 `/api/recognize` 发送同步识别请求
  - [x] SubTask 1.4: 新增 `uploadPending` 方法，使用 `Taro.uploadFile` 向 `/api/photos/upload-pending` 上传原图
  - [x] SubTask 1.5: 新增 `uploadAnnotated` 方法，使用 `Taro.uploadFile` 向 `/api/photos/upload-annotated` 上传标注图
  - [x] SubTask 1.6: 修复 `uploadPhoto` 方法，同时上传原图（`original`）和标注图（`annotated`）及 metadata，支持 `original_url` 参数
  - [x] SubTask 1.7: 新增 `getApiBaseUrl` 导出函数
  - [x] SubTask 1.8: 新增 `imageProxy` 方法，构建图片代理 URL

- [x] Task 2: 修复 AppContext（`context/AppContext.tsx`）
  对齐前端 ReviewContext 的数据结构和 Action，删除异步识别相关字段。
  - [x] SubTask 2.1: 修改 `PhotoItem` 接口：`status` 改为可选（`status?: 'pending' | 'processing' | 'completed'`），删除 `taskId`、`errorMessage`、`collectionDate` 字段
  - [x] SubTask 2.2: 删除 `updatePhotoStatus`、`setSubmitting`、`removePhoto` Action 类型
  - [x] SubTask 2.3: 新增 `removeSelected`、`cleanSelection` Action 类型及 reducer 实现
  - [x] SubTask 2.4: 删除 `isSubmitting` 状态字段
  - [x] SubTask 2.5: Provider 名称改回 `ReviewProvider`（可选，保持与前端一致）

- [x] Task 3: 修复工具函数
  修复 languagePrefs、wordMastery、uuid、theme 工具函数。
  - [x] SubTask 3.1: 修复 `languagePrefs.ts`：`getLanguagePrefs` 强制返回 `nativeLang: 'zh'`，导出 `LanguagePrefs` 接口
  - [x] SubTask 3.2: 修复 `wordMastery.ts`：Storage Key 统一为 `scene_lingo_mastered_words`
  - [x] SubTask 3.3: 修复 `uuid.ts`：使用 `crypto.getRandomValues` 替代 `Math.random()`
  - [x] SubTask 3.4: 修复 `theme.ts`：`applyTheme` 通过 Taro 页面 `page.setStyle` 注入 CSS 变量，确保主题切换实际生效

- [x] Task 4: 修复 LoginPage（`pages/login/index.tsx`）
  登录成功后同步服务端偏好，修复验证码校验。
  - [x] SubTask 4.1: 登录成功后从 `api.verify` 返回值中提取 `targetLang` 和 `theme`，调用 `setLanguagePrefs` + `dispatch setLanguage` 和 `setTheme` + `dispatch setTheme`
  - [x] SubTask 4.2: 验证码长度校验从 `< 4` 改为 `< 6`
  - [x] SubTask 4.3: 验证码输入添加数字过滤（`replace(/\D/g, '')`）

- [x] Task 5: 修复 HomePage（`pages/home/index.tsx`）
  对齐前端首页逻辑，修复云端照片映射、上传流程、底部操作栏。
  - [x] SubTask 5.1: 修复 `mapApiPhoto`：`dataUrl` 映射为 `p.originalUrl`，`annotatedDataUrl` 映射为 `p.annotatedUrl`
  - [x] SubTask 5.2: 已登录用户上传：压缩图片 → `uploadPending` 逐张上传原图 → 显示进度弹窗 → 完成后刷新列表
  - [x] SubTask 5.3: 未登录用户上传：压缩图片 → 本地存储 → 跳转 ReviewPage 同步识别
  - [x] SubTask 5.4: 新增图片压缩工具（使用 `Taro.compressImage`）
  - [x] SubTask 5.5: 底部栏从"合并导出"改为"删除选中 (N)"，实现批量删除
  - [x] SubTask 5.6: 添加 AI 识别耗时提示条
  - [x] SubTask 5.7: 云端照片缺少标注图时自动补传（渲染标注图 → `uploadAnnotated`）

- [x] Task 6: 修复 ReviewPage（`pages/review/index.tsx`）
  改为同步识别流程，逐张审查模式，对齐前端 ReviewPage。
  - [x] SubTask 6.1: 删除异步识别轮询逻辑（`startPolling`、`stopPolling`、`getRecognitionStatusBatch`）
  - [x] SubTask 6.2: 实现同步识别：进入页面自动调用 `api.recognize`，显示加载动画
  - [x] SubTask 6.3: 实现逐张审查模式：进度条（当前/总数）、重新识别、保存、跳过按钮
  - [x] SubTask 6.4: 保存逻辑：未登录用户保存到本地 Storage，已登录用户调用 `uploadPhoto` 上传
  - [x] SubTask 6.5: 完成画面：全部识别完成后显示"全部完成"+ 返回首页按钮

- [x] Task 7: 修复 SettingsPage（`pages/settings/index.tsx`）
  主题切换即时生效。
  - [x] SubTask 7.1: 主题选择即时调用 `setTheme` + `applyTheme` + dispatch `setTheme`，无需保存按钮
  - [x] SubTask 7.2: 已登录用户主题变更同步调用 `api.updateTheme`

- [x] Task 8: 修复 WordDetailPage（`pages/worddetail/index.tsx`）
  实现 TTS 发音功能。
  - [x] SubTask 8.1: `handleSpeak` 使用 `Taro.createInnerAudioContext` 播放 Google TTS 音频 URL
  - [x] SubTask 8.2: 使用 `getTtsLang` 获取目标语言对应的 TTS 语言代码

- [x] Task 9: 修复 WordBookPage（`pages/wordbook/index.tsx`）
  修复字段映射和导航。
  - [x] SubTask 9.1: 云端照片字段映射改为 `originalUrl`/`annotatedUrl`
  - [x] SubTask 9.2: 返回首页改用 `Taro.navigateBack()` 替代 `navigateTo`

- [x] Task 10: 修复 AnnotatedImage 组件
  添加点击发音交互，修复文字宽度测量。
  - [x] SubTask 10.1: 点击喇叭图标触发 TTS 发音
  - [x] SubTask 10.2: 使用 `Taro.createSelectorQuery` 测量文字宽度替代估算

- [x] Task 11: 修复 App.tsx 和 AppLogo
  主题初始化和 Logo 主题适配。
  - [x] SubTask 11.1: App.tsx 启动时调用 `applyTheme(getTheme())` 初始化主题
  - [x] SubTask 11.2: AppLogo 颜色跟随当前主题（从 AppContext 读取 theme 颜色）

- [x] Task 12: 编译验证
  确保所有修改后小程序可正常编译。
  - [x] SubTask 12.1: 运行 `npm run build:weapp` 确认无编译错误

# Task Dependencies
- Task 1（API 层）是所有页面修复的前置依赖
- Task 2（AppContext）是 Task 4-11 的前置依赖
- Task 3（工具函数）是 Task 4-11 的前置依赖
- Task 4（LoginPage）依赖 Task 1、2、3
- Task 5（HomePage）依赖 Task 1、2、3
- Task 6（ReviewPage）依赖 Task 1、2、3
- Task 7-11 可并行开发，均依赖 Task 1、2、3
- Task 12 依赖 Task 4-11 全部完成
