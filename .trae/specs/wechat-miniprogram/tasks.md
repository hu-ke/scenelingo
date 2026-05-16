# Tasks

- [ ] Task 1: 项目初始化与工程搭建
  在 `miniprogram/` 目录下使用 Taro CLI 创建 React + TypeScript 微信小程序项目，配置 `project.config.json`、ESLint、路径别名，确认 `npm run dev:weapp` 可正常编译。
  - [ ] SubTask 1.1: 使用 `npx @tarojs/cli init` 初始化 Taro 项目（选择 React + TypeScript + Webpack5 模板）
  - [ ] SubTask 1.2: 配置 `project.config.json`（设置 AppID 占位符、项目名称 Scene Lingo）
  - [ ] SubTask 1.3: 在 `src/app.config.ts` 中声明全部 7 个页面路由和 tabBar 配置
  - [ ] SubTask 1.4: 验证 `npm run dev:weapp` 编译通过

- [ ] Task 2: 全局基础设施搭建
  实现全局状态管理（Reactive Context）、API 通信层、本地存储工具、设计系统（CSS变量与5套主题）、公共组件（AppLogo、AnnotatedImage、WordCard）。
  - [ ] SubTask 2.1: 创建 `src/utils/api.ts`，封装 Taro.request 实现与后端全部 API 的通信（含 Token 注入、401 处理）
  - [ ] SubTask 2.2: 创建 `src/utils/storage.ts`，封装微信 Storage API（读写 Token、邮件、语言偏好、主题、已掌握单词）
  - [ ] SubTask 2.3: 创建 `src/utils/theme.ts`，实现5套主题 CSS 变量动态注入（复用网页版 theme.ts 的颜色配置）
  - [ ] SubTask 2.4: 创建 `src/context/AuthContext.tsx`，管理登录状态（Token、Email）
  - [ ] SubTask 2.5: 创建 `src/context/AppContext.tsx`，管理全局应用状态（页面路由、照片列表、语言偏好、主题等）
  - [ ] SubTask 2.6: 创建 `src/app.scss`，迁移网页版 CSS 变量系统与全局样式（适配小程序 rpx 单位）
  - [ ] SubTask 2.7: 迁移 `AppLogo` 组件到 `src/components/AppLogo.tsx`（适配 Taro 组件）
  - [ ] SubTask 2.8: 迁移 `AnnotatedImage` 组件到 `src/components/AnnotatedImage.tsx`（使用 Taro Canvas API 替代 HTML Canvas）
  - [ ] SubTask 2.9: 迁移 `WordCard` 组件到 `src/components/WordCard.tsx`

- [ ] Task 3: 登录页实现
  实现邮箱验证码登录/注册页面，包含邮箱输入、验证码发送倒计时、验证码输入、登录/跳过功能。
  - [ ] SubTask 3.1: 创建 `src/pages/login/index.tsx` 和 `src/pages/login/index.scss`
  - [ ] SubTask 3.2: 实现邮箱输入框和发送验证码按钮（60秒倒计时冷却）
  - [ ] SubTask 3.3: 实现验证码输入框和登录按钮
  - [ ] SubTask 3.4: 调用 `/api/auth/send-code` 和 `/api/auth/verify` 接口
  - [ ] SubTask 3.5: 实现"暂不登录"跳过功能

- [ ] Task 4: 设置页实现
  实现设置页面，包含母语显示（只读）、目标语言选择器、主题风格选择器。
  - [ ] SubTask 4.1: 创建 `src/pages/settings/index.tsx` 和 `src/pages/settings/index.scss`
  - [ ] SubTask 4.2: 实现语言选择器（支持 en/ja/ko/fr/de/es/pt/ru/ar）
  - [ ] SubTask 4.3: 实现主题选择器（暖橙/海蓝/森绿/雅紫/暗夜，共5种）
  - [ ] SubTask 4.4: 偏好即时生效并持久化到 Storage，已登录用户同步后端

- [ ] Task 5: 首页实现
  实现首页，包含顶部 Header + 统计数据 + 按日期分组的照片集合 + FAB 拍照入口 + 底部合并栏 + 登录引导弹窗。
  - [ ] SubTask 5.1: 创建 `src/pages/home/index.tsx` 和 `src/pages/home/index.scss`
  - [ ] SubTask 5.2: 实现顶部 Header（Logo、设置按钮、单词本按钮）
  - [ ] SubTask 5.3: 实现统计数据展示（总照片数、总单词数）
  - [ ] SubTask 5.4: 实现按日期分组的照片集合网格展示
  - [ ] SubTask 5.5: 实现 FAB "+" 按钮及其弹出菜单（拍照 / 从相册选择）
  - [ ] SubTask 5.6: 实现底部合并栏（选中照片 + 合并导出按钮）
  - [ ] SubTask 5.7: 实现未登录用户引导弹窗（超过10张照片时）

- [ ] Task 6: 复习/识别页实现
  实现复习识别页面，包含图片展示、AI识别调用、Canvas标注渲染、单词卡片、操作按钮组、进度条。
  - [ ] SubTask 6.1: 创建 `src/pages/review/index.tsx` 和 `src/pages/review/index.scss`
  - [ ] SubTask 6.2: 实现照片选择传入 → 显示 → 自动调用 `/api/recognize`
  - [ ] SubTask 6.3: 实现加载动画（识别中状态）
  - [ ] SubTask 6.4: 集成 AnnotatedImage 组件展示标注结果
  - [ ] SubTask 6.5: 集成 WordCard 组件展示单词信息
  - [ ] SubTask 6.6: 实现发音功能（使用微信 TTS 插件或网络音频）
  - [ ] SubTask 6.7: 实现操作按钮组（重试、保存、下载、跳过）及进度条
  - [ ] SubTask 6.8: 实现全部识别完成画面

- [ ] Task 7: 单词本 & 单词详情页实现
  实现单词本页面（生词表/已掌握两个Tab）和单词详情页（完整单词信息 + 关联照片）。
  - [ ] SubTask 7.1: 创建 `src/pages/wordbook/index.tsx` 和 `src/pages/wordbook/index.scss`
  - [ ] SubTask 7.2: 实现 Tab 切换（生词表/已掌握）、字母排序展示
  - [ ] SubTask 7.3: 创建 `src/pages/worddetail/index.tsx` 和 `src/pages/worddetail/index.scss`
  - [ ] SubTask 7.4: 实现单词详情展示（英文、中文、音标、发音按钮、例句）
  - [ ] SubTask 7.5: 实现关联照片缩略图展示
  - [ ] SubTask 7.6: 实现标记/取消掌握状态按钮

- [ ] Task 8: 合并导出页实现
  实现合并导出页面，将选中的多张标注照片合并到 Canvas 上并导出。
  - [ ] SubTask 8.1: 创建 `src/pages/merge/index.tsx` 和 `src/pages/merge/index.scss`
  - [ ] SubTask 8.2: 将选中的标注图加载并垂直排列绘制到 Canvas
  - [ ] SubTask 8.3: 实现导出功能（保存到相册 + 分享）

- [ ] Task 9: 端到端集成测试
  编译完整小程序代码，确认所有页面可正常编译，跑通核心流程。
  - [ ] SubTask 9.1: 验证 `npm run build:weapp` 编译无错误
  - [ ] SubTask 9.2: 在微信开发者工具中预览，验证所有页面渲染正常

# Task Dependencies
- Task 2 依赖 Task 1 完成
- Task 3、Task 4 可并行开发，均依赖 Task 2
- Task 5 依赖 Task 2 完成
- Task 6 依赖 Task 2（AnnotatedImage、WordCard 组件）完成
- Task 7 可独立开发，依赖 Task 2 完成
- Task 8 依赖 Task 2（Canvas 能力）完成
- Task 9 依赖 Task 3-8 全部完成