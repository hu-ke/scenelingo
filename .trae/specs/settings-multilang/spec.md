# Settings 页与多语言配置 Spec

## Why
当前应用硬编码为"母语中文、学习英语"，所有 UI 文案、AI 识别 prompt、语音合成都写死了语言。引入 Settings 页面后，用户可以配置母语和目标语言，使应用支持更多语言对（如中文母语学日语、日语母语学英语等），为国际化打下基础。

## What Changes
- 新增 Settings 页面（`settings`），入口放在 HomePage header 右上角（用户名旁）
- 支持配置**母语**（native language）和**要学习的语言**（target language）
- 默认值：母语=中文，目标语言=英语
- 语言偏好存入 localStorage（未登录）或 MongoDB users 集合（已登录），登录时自动同步
- AI 识别 prompt 根据语言配置动态生成，替换硬编码的 "English"/"Chinese"
- 语音合成 TTS 的 `lang` 属性也根据目标语言动态设置

## Impact
- Affected specs: scene-english-learning（核心识别流程）
- Affected code:
  - `frontend/src/context/ReviewContext.tsx` — 新增 `AppPage` 类型、语言相关 state
  - `frontend/src/App.tsx` — 新增 settings 路由
  - `frontend/src/pages/SettingsPage.tsx` — 新建
  - `frontend/src/pages/HomePage.tsx` — header 添加设置入口
  - `frontend/src/components/AnnotatedImage.tsx` — TTS lang 动态化
  - `frontend/src/pages/ReviewPage.tsx` — TTS lang 动态化
  - `frontend/src/pages/WordDetailPage.tsx` — TTS lang 动态化
  - `backend/main.py` — AI prompt 动态化
  - `backend/auth.py` — 语言偏好读写

## ADDED Requirements

### Requirement: Settings 页面
系统 SHALL 提供一个 Settings 页面，用户可以在此配置语言偏好。

#### Scenario: 从首页进入设置
- **WHEN** 用户在 HomePage header 点击设置按钮
- **THEN** 页面切换到 Settings 页面

#### Scenario: 设置母语
- **WHEN** 用户在 Settings 页面选择母语（如中文、日语、韩语）
- **THEN** 母语偏好被保存，后续 AI 识别结果的翻译字段使用该母语

#### Scenario: 设置目标语言
- **WHEN** 用户在 Settings 页面选择要学习的语言（如英语、日语、韩语）
- **THEN** 目标语言偏好被保存，AI 识别返回该语言的单词和音标，语音合成使用该语言

#### Scenario: 默认语言配置
- **WHEN** 用户首次使用且未配置语言
- **THEN** 系统默认母语为"中文"，目标语言为"英语"

### Requirement: 语言偏好持久化
系统 SHALL 持久化用户的语言偏好，跨设备/浏览器同步（已登录用户）。

#### Scenario: 未登录用户保存到 localStorage
- **WHEN** 未登录用户在 Settings 页面修改语言偏好
- **THEN** 偏好存入 localStorage，刷新页面后仍然保留

#### Scenario: 已登录用户保存到 MongoDB
- **WHEN** 已登录用户在 Settings 页面修改语言偏好
- **THEN** 偏好同时存入 MongoDB users 集合和 localStorage，下次登录时自动恢复

#### Scenario: 登录时同步语言偏好
- **WHEN** 用户登录成功（auth/verify 返回）
- **THEN** 后端返回用户的 language 偏好，前端写入 localStorage 和全局状态

### Requirement: AI 识别 Prompt 动态适配
系统 SHALL 根据用户配置的语言对，动态生成 AI 识别 prompt。

#### Scenario: 默认中文→英语
- **WHEN** 母语=中文，目标语言=英语
- **THEN** prompt 中要求 name 为 English、phonetic 为 English 音标、翻译为 Chinese、例句为 English

#### Scenario: 自定义语言对
- **WHEN** 母语=中文，目标语言=日语
- **THEN** prompt 中要求 name 为 Japanese、phonetic 为 Japanese 音标（罗马字）、翻译为 Chinese、例句为 Japanese

### Requirement: 语音合成语言动态适配
系统 SHALL 根据目标语言设置 TTS 语音的语言。

#### Scenario: 目标语言为英语
- **WHEN** 目标语言=英语
- **THEN** TTS 使用 `en-US`

#### Scenario: 目标语言为日语
- **WHEN** 目标语言=日语
- **THEN** TTS 使用 `ja-JP`

## MODIFIED Requirements

### Requirement: RecognizedObject 接口（原 ReviewContext）
`RecognizedObject` 接口中新增 `native` 字段（原 `chinese` 字段保留兼容但语义调整为"翻译"），同时新增 `targetLang` 和 `nativeLang` 上下文信息。

#### Scenario: 兼容旧数据
- **WHEN** 系统加载旧照片的数据（只有 chinese 字段）
- **THEN** 正常显示翻译文本，不做数据迁移

## REMOVED Requirements
无。
