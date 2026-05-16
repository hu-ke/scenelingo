# 微信小程序 Spec

## Why
将现有的 Scene Lingos（场景英语）网页版完整迁移到微信小程序平台，利用微信生态的原生能力（相机、相册、本地存储、语音合成等），让用户能够更方便地在微信内使用场景英语学习功能。

## What Changes
- 新建 `miniprogram/` 目录，与 `frontend/`、`backend/` 同级
- 使用 Taro 3 + React 框架，最大化复用网页版 React 组件和逻辑
- 适配微信小程序原生能力：相机拍照、相册选图、Canvas 绘图、TTS 语音合成、Storage 存储
- 复用现有后端 API（无需修改后端）
- 实现全部 7 个页面：登录、首页、复习、合并导出、单词本、单词详情、设置

## Impact
- Affected specs: 无（全新功能，不影响现有代码）
- Affected code: 新增 `miniprogram/` 目录，不修改 `frontend/` 和 `backend/`
- 后端 API 完全复用，无需改动

## ADDED Requirements

### Requirement: 项目初始化与工程搭建
系统应在 `miniprogram/` 目录下初始化一个 Taro 3 + React + TypeScript 的微信小程序项目，配置好构建工具链和 ESLint。

#### Scenario: 项目结构创建
- **WHEN** 开发者进入 `miniprogram/` 目录
- **THEN** 项目应包含 `src/pages/`、`src/components/`、`src/utils/`、`src/app.tsx`、`src/app.scss` 等标准 Taro 项目结构
- **AND** `package.json` 中依赖 Taro 及相关微信小程序插件
- **AND** `project.config.json` 已配置好微信小程序 AppID 占位符

### Requirement: 登录页（Login）
系统应提供邮箱验证码登录/注册页面，与网页版功能一致。

#### Scenario: 用户输入邮箱获取验证码
- **WHEN** 用户在登录页输入邮箱地址并点击发送验证码
- **THEN** 调用后端 `/api/auth/send-code` 发送验证码
- **AND** 界面显示60秒倒计时冷却

#### Scenario: 用户输入验证码完成登录
- **WHEN** 用户输入收到的6位验证码并点击登录
- **THEN** 调用后端 `/api/auth/verify` 验证
- **AND** 登录成功后将 Token 和 Email 持久化到微信 Storage
- **AND** 跳转至首页

#### Scenario: 用户暂不登录
- **WHEN** 用户点击"暂不登录"按钮
- **THEN** 直接以未登录状态进入首页

### Requirement: 首页（Home）
系统应提供首页，展示用户的照片集合、统计数据、提供拍照/上传入口。

#### Scenario: 首页展示照片集合
- **WHEN** 已登录用户进入首页
- **THEN** 从后端 `/api/photos/list` 加载照片列表
- **AND** 按采集日期分组展示照片缩略图网格
- **AND** 显示总照片数和总单词数统计
- **AND** 每张照片展示其标注图（annotatedUrl）

#### Scenario: 未登录用户首页
- **WHEN** 未登录用户进入首页
- **THEN** 从微信 Storage 加载本地保存的照片
- **AND** 最多保存10张，超出时引导登录

#### Scenario: 拍照上传新照片
- **WHEN** 用户点击首页右下角 FAB "+" 按钮
- **THEN** 弹出选择菜单：拍照 / 从相册选择
- **AND** 使用微信 `wx.chooseMedia` 或 `wx.chooseImage` API
- **AND** 选择照片后进入复习页开始识别流程

#### Scenario: 底部合并栏
- **WHEN** 用户选中一张或多张照片（勾选左上角选择框）
- **THEN** 底部浮现合并栏，显示已选数量和"合并导出"按钮
- **AND** 点击"合并导出"跳转至合并页

### Requirement: 复习/识别页（Review）
系统应提供复习识别页面，用户上传照片后逐张进行AI识别并展示标注结果。

#### Scenario: 上传照片触发识别
- **WHEN** 用户选择照片进入复习页
- **THEN** 照片显示在识别区域
- **AND** 自动调用后端 `/api/recognize` 进行AI识别
- **AND** 显示加载动画

#### Scenario: 识别结果展示
- **WHEN** AI识别完成返回物体列表
- **THEN** 在照片上使用 Canvas 绘制气泡标注（物体名称 + 音标 + 发音图标 + 小尾巴指向物体位置）
- **AND** 下方展示单词卡片（英文名、中文含义、音标、发音按钮、可展开例句）
- **AND** 点击发音按钮使用微信 `wx.createInnerAudioContext` 或插件播放TTS发音

#### Scenario: 复习操作按钮
- **WHEN** 用户查看当前识别结果
- **THEN** 显示操作按钮组：重试（重新识别）、保存、下载/分享、跳过
- **AND** 点击"保存"将标注图和元数据保存到本地，登录用户同步到云端
- **AND** 点击"重试"重新调用识别API
- **AND** 点击"跳过"进入下一张照片

#### Scenario: 复习进度指示
- **WHEN** 用户正在复习多张照片
- **THEN** 顶部显示进度条（当前照片序号 / 总照片数）

#### Scenario: 全部识别完成
- **WHEN** 所有照片识别保存完成
- **THEN** 显示完成画面，可点击返回首页

### Requirement: 合并导出页（Merge）
系统应提供多张标注照片合并到一张画布并导出/分享的功能。

#### Scenario: 合并展示选中的照片
- **WHEN** 用户从首页选中多张照片并点击合并导出
- **THEN** 进入合并页，将选中的标注图垂直排列在 Canvas 上
- **AND** 显示下载/分享按钮

#### Scenario: 导出合并图
- **WHEN** 用户点击下载按钮
- **THEN** 将 Canvas 内容导出为图片
- **AND** 保存到相册（使用 `wx.saveImageToPhotosAlbum`）或分享给朋友

### Requirement: 单词本（WordBook）
系统应提供单词本页面，展示所有已识别过的单词，支持按掌握状态分类。

#### Scenario: 单词本展示
- **WHEN** 用户进入单词本页
- **THEN** 展示两个 Tab：生词表 / 已掌握
- **AND** 生词表 Tab 显示所有未掌握的单词，按字母排序
- **AND** 已掌握 Tab 显示所有已掌握的单词，按字母排序
- **AND** 每个单词显示英文名、中文含义、音标

#### Scenario: 点击单词查看详情
- **WHEN** 用户点击某个单词
- **THEN** 跳转至单词详情页

### Requirement: 单词详情页（WordDetail）
系统应提供单词详情页，展示单词的完整信息。

#### Scenario: 单词详情展示
- **WHEN** 用户进入单词详情页
- **THEN** 展示单词英文名、中文释义、音标、例句
- **AND** 展示该单词关联的照片缩略图列表
- **AND** 提供发音按钮
- **AND** 提供"标记为已掌握"/"取消掌握"按钮

### Requirement: 设置页（Settings）
系统应提供设置页面，用户可配置语言偏好和主题风格。

#### Scenario: 设置页面展示
- **WHEN** 用户进入设置页
- **THEN** 显示母语设置（固定中文，只读展示）
- **AND** 显示目标学习语言选择器（en/ja/ko/fr/de/es/pt/ru/ar）
- **AND** 显示主题风格选择器（暖橙/海蓝/森绿/雅紫/暗夜，共5种）

#### Scenario: 修改设置并保存
- **WHEN** 用户修改目标语言或主题
- **THEN** 界面即时生效
- **AND** 偏好保存到微信 Storage
- **AND** 已登录用户同步到后端 `/api/user/language` 和 `/api/user/theme`

### Requirement: 全局设计系统
系统应提供与网页版一致的设计系统，包括CSS变量、5套主题、动画效果。

#### Scenario: 主题切换
- **WHEN** 用户在设置页切换主题
- **THEN** 所有页面的颜色 / 背景 / 文字色即时切换
- **AND** 支持暖橙、海蓝、森绿、雅紫、暗夜（深色模式）共5套主题

#### Scenario: 动画效果
- **WHEN** 页面切换或元素出现
- **THEN** 应包含淡入、上滑、缩放、呼吸发光、庆祝动画等效果

### Requirement: 本地存储
系统应使用微信 Storage API 进行本地数据持久化，替代网页版的 IndexedDB 和 localStorage。

#### Scenario: 照片本地存储
- **WHEN** 用户识别并保存一张照片
- **THEN** 照片的信息（ID、日期、标注图、识别对象）保存到微信 Storage
- **AND** 图片文件暂存到微信文件系统（`wx.env.USER_DATA_PATH`）

#### Scenario: 单词掌握状态
- **WHEN** 用户标记/取消标记某个单词为已掌握
- **THEN** 状态保存到微信 Storage

### Requirement: API 通信
系统应通过 HTTP 请求与后端 API 通信，与网页版使用相同的端点。

#### Scenario: API 请求鉴权
- **WHEN** 用户已登录
- **THEN** 所有需要鉴权的API请求携带 `Authorization: Bearer <token>` 头
- **AND** 收到 401 时清除本地 Token 并引导重新登录

#### Scenario: 图片上传
- **WHEN** 上传照片到后端 `/api/photos/upload`
- **THEN** 使用 `wx.uploadFile` 以 `multipart/form-data` 格式上传原图和标注图
- **AND** 元数据作为表单字段 `metadata` 一并上传