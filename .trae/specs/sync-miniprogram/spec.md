# 小程序对齐前端/后端逻辑 Spec

## Why
小程序代码与前端/后端当前逻辑严重脱节：小程序调用了后端不存在的异步识别 API（`/api/recognize/async`、`/api/recognize/status/batch`），云端照片字段映射错误（`dataUrl`/`annotatedDataUrl` vs 后端返回的 `originalUrl`/`annotatedUrl`），登录后不同步服务端语言/主题偏好，TTS 发音无效，BASE_URL 硬编码 localhost 无法连接生产环境，主题切换不生效等。需要全面对齐小程序与前端/后端的当前逻辑。

## What Changes
- 修复 API 层：BASE_URL 改为通过 Taro 构建配置注入环境变量；删除不存在的异步识别 API；新增 `uploadPending`、`uploadAnnotated`、`getApiBaseUrl`；修复 `uploadPhoto` 上传原图+标注图+metadata；修复 `recognize` 支持同步识别
- 修复 AppContext：删除异步识别相关字段（`taskId`、`errorMessage`、`isSubmitting`、`updatePhotoStatus`、`setSubmitting`、`removePhoto`），对齐前端 ReviewContext
- 修复 LoginPage：登录成功后同步服务端返回的 `targetLang` 和 `theme`；验证码长度校验改为6位；输入过滤仅数字
- 修复 HomePage：云端照片字段映射改为 `originalUrl`/`annotatedUrl`；已登录用户使用 `uploadPending` 上传原图；未登录用户使用同步识别流程；添加图片压缩；添加 AI 识别耗时提示；底部栏改为批量删除
- 修复 ReviewPage：改为同步识别流程（与前端一致）；支持 `photo_url` 远程图片识别
- 修复 SettingsPage：主题切换即时生效
- 修复 WordDetailPage：TTS 发音功能实现
- 修复 WordBookPage：云端照片字段映射；导航改用 `navigateBack`
- 修复 AnnotatedImage：添加点击喇叭图标发音交互
- 修复 theme.ts：`applyTheme` 实际生效（通过 CSS 变量注入页面）
- 修复 App.tsx：启动时调用 `applyTheme` 初始化主题
- 修复 languagePrefs.ts：`getLanguagePrefs` 强制 `nativeLang='zh'`
- 修复 wordMastery.ts：Storage Key 统一为 `scene_lingo_mastered_words`
- 修复 uuid.ts：使用更安全的随机数生成方式
- 修复 AppLogo：主题颜色跟随当前主题

## Impact
- Affected specs: wechat-miniprogram
- Affected code: `miniprogram/src/` 下所有文件

## ADDED Requirements

### Requirement: API 层对齐后端
小程序 API 层 SHALL 与后端当前实际提供的端点完全对齐。

#### Scenario: BASE_URL 使用构建配置
- **WHEN** 小程序编译为生产环境
- **THEN** BASE_URL 为 `https://scenelingo.today/scenelingo-service`
- **WHEN** 小程序编译为开发环境
- **THEN** BASE_URL 为 `http://localhost:8022/scenelingo-service`

#### Scenario: 同步识别 API
- **WHEN** 小程序调用 `api.recognize(nativeLang, targetLang, imagePath)`
- **THEN** 使用 `Taro.uploadFile` 向 `/api/recognize` 发送同步识别请求
- **AND** 返回 `{ objects: [...] }` 结果

#### Scenario: 上传原图（已登录用户异步处理）
- **WHEN** 已登录用户上传照片
- **THEN** 调用 `api.uploadPending` 向 `/api/photos/upload-pending` 上传原图
- **AND** 后端后台处理识别

#### Scenario: 上传标注图补传
- **WHEN** 云端照片缺少标注图但有 objects
- **THEN** 调用 `api.uploadAnnotated` 向 `/api/photos/upload-annotated` 补传标注图

#### Scenario: 完整照片上传
- **WHEN** 调用 `api.uploadPhoto` 上传完整照片
- **THEN** 同时上传原图（`original`）和标注图（`annotated`）及 metadata
- **AND** 支持传入 `original_url` 跳过原图重复上传

### Requirement: AppContext 对齐前端 ReviewContext
小程序 AppContext SHALL 与前端 ReviewContext 的数据结构和 Action 保持一致。

#### Scenario: PhotoItem 类型
- **WHEN** 定义 PhotoItem 接口
- **THEN** 包含 `id`、`dataUrl`、`annotatedDataUrl?`、`objects?`、`status?`（可选，值为 `'pending' | 'processing' | 'completed'`）
- **AND** 不包含 `taskId`、`errorMessage`、`collectionDate` 字段

#### Scenario: ReviewAction 类型
- **WHEN** 定义 ReviewAction 类型
- **THEN** 包含前端 ReviewContext 的所有 Action（`removeSelected`、`cleanSelection`）
- **AND** 不包含 `updatePhotoStatus`、`setSubmitting`、`removePhoto`

### Requirement: 登录流程对齐前端
小程序登录页 SHALL 在登录成功后同步服务端返回的语言偏好和主题。

#### Scenario: 登录成功后同步偏好
- **WHEN** 用户输入6位验证码并登录成功
- **THEN** 保存 token 和 email
- **AND** 如果服务端返回 `targetLang`，则调用 `setLanguagePrefs` 并 dispatch `setLanguage`
- **AND** 如果服务端返回 `theme`，则调用 `setTheme` 并 dispatch `setTheme`
- **AND** 跳转到首页

#### Scenario: 验证码输入过滤
- **WHEN** 用户在验证码输入框输入内容
- **THEN** 仅保留数字字符，过滤非数字输入

### Requirement: 首页流程对齐前端
小程序首页 SHALL 使用与前端一致的照片上传和展示逻辑。

#### Scenario: 云端照片字段映射
- **WHEN** 从 `/api/photos/list` 获取云端照片
- **THEN** 将 `p.originalUrl` 映射为 `dataUrl`
- **AND** 将 `p.annotatedUrl` 映射为 `annotatedDataUrl`

#### Scenario: 已登录用户上传照片
- **WHEN** 已登录用户选择照片上传
- **THEN** 压缩图片至最大1500px
- **AND** 调用 `uploadPending` 逐张上传原图
- **AND** 显示上传进度弹窗
- **AND** 上传完成后刷新照片列表

#### Scenario: 未登录用户上传照片
- **WHEN** 未登录用户选择照片上传
- **THEN** 压缩图片至最大1500px
- **AND** 将图片转为本地数据存入 PhotoItem
- **AND** 跳转到复习页进行同步识别

#### Scenario: 底部操作栏
- **WHEN** 用户选中一张或多张照片
- **THEN** 底部显示"删除选中 (N)"按钮
- **AND** 点击后批量删除选中照片

#### Scenario: AI 识别耗时提示
- **WHEN** 首页加载完成
- **THEN** 显示"每张图片AI识别大约需要5-10秒"提示条

### Requirement: 复习页同步识别流程
小程序复习页 SHALL 使用同步识别流程，与前端一致。

#### Scenario: 同步识别
- **WHEN** 用户进入复习页
- **THEN** 对当前照片调用 `api.recognize` 进行同步识别
- **AND** 显示加载动画
- **AND** 识别完成后展示标注图和单词卡片

#### Scenario: 逐张审查
- **WHEN** 用户查看当前识别结果
- **THEN** 显示进度条（当前序号/总数）
- **AND** 提供操作按钮：重新识别、保存、下载、跳过
- **AND** 保存后自动进入下一张

### Requirement: TTS 发音功能
小程序 SHALL 实现可用的 TTS 发音功能。

#### Scenario: 单词发音
- **WHEN** 用户点击单词的发音按钮或标注图上的喇叭图标
- **THEN** 使用微信 `InnerAudioContext` 播放该单词的 TTS 音频
- **AND** 音频 URL 使用 Google TTS 或其他可用的 TTS 服务

### Requirement: 主题系统生效
小程序主题切换 SHALL 实际生效。

#### Scenario: 主题初始化
- **WHEN** 小程序启动
- **THEN** App.tsx 调用 `applyTheme` 应用当前主题

#### Scenario: 主题切换即时生效
- **WHEN** 用户在设置页切换主题
- **THEN** 所有页面颜色即时更新
- **AND** 偏好保存到 Storage

### Requirement: 语言偏好 nativeLang 固定为中文
小程序 `getLanguagePrefs` SHALL 始终返回 `nativeLang: 'zh'`。

#### Scenario: 获取语言偏好
- **WHEN** 调用 `getLanguagePrefs()`
- **THEN** 返回 `{ nativeLang: 'zh', targetLang: <用户选择的目标语言> }`
- **AND** 忽略 Storage 中可能存储的旧 nativeLang 值

## MODIFIED Requirements

### Requirement: 小程序 API 通信
原 wechat-miniprogram spec 中的 API 通信需求修改为：仅使用后端实际存在的端点，删除不存在的异步识别端点，新增 `uploadPending`、`uploadAnnotated`、`imageProxy` 方法。

### Requirement: 小程序复习/识别页
原 wechat-miniprogram spec 中的复习页需求修改为：使用同步识别流程（`/api/recognize`），逐张审查模式，与前端 ReviewPage 一致。删除异步识别轮询逻辑。

## REMOVED Requirements

### Requirement: 异步识别 API
**Reason**: 后端不存在 `/api/recognize/async`、`/api/recognize/status/{taskId}`、`/api/recognize/status/batch` 端点，小程序不应调用不存在的 API。
**Migration**: 改用同步识别 `/api/recognize`，已登录用户使用 `uploadPending` 实现后台异步处理。
