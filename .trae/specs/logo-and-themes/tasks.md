# Tasks

- [x] Task 1: 创建 AppLogo SVG 组件
  - 新建 `frontend/src/components/AppLogo.tsx`，设计一个 SVG Logo：
    - 核心图形：一个圆形放大镜（代表"探索/发现"），镜片内有一个字母"A"（代表"语言学习"），放大镜手柄处融入相机快门叶片元素
    - 接受 `size` prop（默认 56px）和 `animated` prop（是否播放脉冲动画）
    - 使用当前主题的主色（`var(--color-primary-start)` → `var(--color-primary-mid)` 渐变填充）
    - 导出为 React 组件，类型安全

- [x] Task 2: 创建 favicon.svg
  - 将 AppLogo 的设计转化为独立 SVG 文件，写入 `frontend/public/favicon.svg`
  - 使用默认暖橙主题色，确保在浏览器标签页中清晰可辨

- [x] Task 3: 替换所有页面中的 Logo
  - 在 `LoginPage.tsx` 中：替换 🎓 emoji 为 `<AppLogo size={56} animated />`
  - 在 `SettingsPage.tsx` 中：替换 🎓 emoji 为 `<AppLogo size={56} animated />`
  - 在 `HomePage.tsx` 的 header 中：在"场景英语"标题左侧添加 `<AppLogo size={40} />`
  - 保持各页面的布局和间距不变

- [x] Task 4: 定义主题数据与工具函数
  - 新建 `frontend/src/utils/theme.ts`：
    - 定义 `Theme` 接口：`{ id, name, colors: {...所有CSS变量} }`
    - 定义 5 套主题的完整色彩数据（暖橙/海蓝/森绿/雅紫/暗夜），每套覆盖所有 `--color-*` 变量
    - 导出工具函数：`getTheme()`（从 localStorage 读取）、`setTheme(id)`（写入 localStorage + 设置 CSS 变量）、`applyTheme(theme)`（遍历写入 `document.documentElement.style.setProperty`）
    - 导出常量：`THEMES: Theme[]`、`DEFAULT_THEME = 'warm-orange'`
    - `setTheme` 同时写入 `document.documentElement.dataset.theme` 以支持 CSS 选择器

- [x] Task 5: 重构 App.css 支持多主题
  - 将 `:root` 中的 CSS 变量值迁移到各主题数据中（Task 4），CSS 文件保留变量声明但不设默认值（或设暖橙为默认）
  - 添加 `:root[data-theme="midnight-dark"]` 等暗色主题的特殊样式覆盖（如输入框边框、disabled 状态等需要微调的非变量样式）
  - 确保暗夜主题下所有组件可读（输入框背景、卡片阴影、分割线等）

- [x] Task 6: 设置页添加主题选择器
  - 在 `SettingsPage.tsx` 中，语言选择器下方新增"主题风格"区域：
    - 一行 5 个圆形色块（直径约 40px），每个色块用对应主题的主色渐变填充
    - 当前选中的色块显示白色边框 + 勾号 `✓`
    - 点击色块调用 `setTheme(id)` + `dispatch({ type: 'setTheme', theme: id })`
    - 已登录用户同时调用 `api.updateTheme(id)` 同步到云端

- [x] Task 7: 全局状态与后端同步
  - 在 `ReviewContext.tsx` 的 `ReviewState` 中新增 `theme: string` 字段，初始值从 `getTheme()` 获取
  - 新增 `setTheme` action，reducer 中更新 state.theme
  - App 启动时（main.tsx 或 App.tsx）调用 `applyTheme(getTheme())` 初始化主题
  - 在 `api.ts` 中新增 `updateTheme(themeId: string)` 方法（POST `/api/user/theme`）
  - 在 `main.py` 中新增 `POST /api/user/theme` 端点
  - 在 `auth.py` 中新增 `update_user_theme(email, themeId)` 函数 + `get_or_create_user` 返回 theme
  - 在 `LoginPage.tsx` 登录后同步 theme：如果后端返回了 theme，调用 `setTheme()` + `applyTheme()` + `dispatch setTheme`

- [x] Task 8: 验证构建通过
  - 运行 `npm run build` 确保前端 TypeScript 编译通过
  - 运行后端语法检查确保无报错

# Task Dependencies
- Task 2 依赖 Task 1（Logo 设计）
- Task 3 依赖 Task 1（组件就绪）
- Task 5 依赖 Task 4（主题数据定义）
- Task 6 依赖 Task 4（主题工具函数）+ 依赖 Task 1（Logo 替换不冲突但可并行）
- Task 7 依赖 Task 4（主题工具函数）
- Task 8 依赖所有前序任务