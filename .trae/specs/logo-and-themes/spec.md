# Logo 重设计 & 多主题切换 Spec

## Why
1. 当前 logo 使用 🎓（学术帽）emoji，与"通过拍照学习语言"的产品定位不匹配——用户拍的是身边场景，不是课堂
2. 目前仅有一套硬编码的暖橙色主题，缺乏个性化选择，且不支持暗色模式，夜间使用体验差

## What Changes
- **新 Logo**：设计一个融合"探索/发现"+"语言/文字"概念的 SVG Logo，统一替换所有位置的 🎓 emoji 和 favicon
- **5 套主题**：暖橙（默认）、海蓝、森绿、雅紫、暗夜，通过 CSS 变量一键切换
- **主题选择器**：集成到 SettingsPage，点击色块即可预览切换
- **主题持久化**：localStorage（未登录）+ MongoDB users 集合（已登录）

## Impact
- Affected specs: settings-multilang（SettingsPage 新增主题选择器）
- Affected code:
  - `frontend/public/favicon.svg` — 替换
  - `frontend/src/components/AppLogo.tsx` — 新建 SVG Logo 组件
  - `frontend/src/pages/LoginPage.tsx` — 替换 🎓 → `<AppLogo />`
  - `frontend/src/pages/SettingsPage.tsx` — 替换 🎓 + 新增主题选择器
  - `frontend/src/pages/HomePage.tsx` — header 添加 Logo（目前没有）
  - `frontend/src/App.css` — 重构为多主题 CSS 变量体系
  - `frontend/src/utils/theme.ts` — 新建主题工具函数
  - `frontend/src/context/ReviewContext.tsx` — state 新增 theme
  - `frontend/src/utils/api.ts` — 新增 updateTheme API
  - `backend/auth.py` — users 集合新增 theme 字段

## ADDED Requirements

### Requirement: 新 App Logo
系统 SHALL 使用一个 SVG Logo 替代当前的 🎓 emoji，该 Logo 应体现"探索拍摄 + 语言学习"的产品核心概念。

#### Scenario: Logo 在所有入口统一显示
- **WHEN** 用户访问登录页、设置页、首页
- **THEN** 各页面顶部均显示相同的 SVG Logo 组件

#### Scenario: Logo 有呼吸动画
- **WHEN** Logo 渲染在登录页/设置页
- **THEN** Logo 带有微妙的缩放或脉冲动画效果

#### Scenario: 浏览器标签页图标为 Logo
- **WHEN** 用户在浏览器中打开应用
- **THEN** 浏览器标签页显示与 Logo 一致的 favicon

### Requirement: 多主题系统
系统 SHALL 提供 5 套预定义主题，用户可在设置页切换。

#### 5 套主题定义
| 主题 | 名称 | 主色 | 风格 |
|------|------|------|------|
| warm-orange | 暖橙 | 珊瑚红→橙 | 温暖活泼（默认） |
| ocean-blue | 海蓝 | 天蓝→深蓝 | 清爽冷静 |
| forest-green | 森绿 | 翠绿→薄荷绿 | 自然清新 |
| royal-purple | 雅紫 | 紫色→粉紫 | 优雅柔和 |
| midnight-dark | 暗夜 | 深灰→暗蓝 | 护眼暗色模式 |

#### Scenario: 主题切换即时生效
- **WHEN** 用户在设置页点击主题色块
- **THEN** 页面立即切换到对应主题，无需刷新

#### Scenario: 主题选择持久化
- **WHEN** 用户切换主题后关闭浏览器再打开
- **THEN** 之前选择的主题仍然生效

#### Scenario: 已登录用户跨设备同步主题
- **WHEN** 已登录用户在 A 设备切换主题
- **THEN** 在 B 设备登录后自动应用该主题

#### Scenario: 暗色模式影响所有页面
- **WHEN** 用户选择暗夜主题
- **THEN** 所有页面背景变为深色，文字变为浅色，卡片/按钮适配暗色

### Requirement: 主题选择器 UI
系统 SHALL 在 SettingsPage 提供直观的主题选择器。

#### Scenario: 色块式选择器
- **WHEN** 用户进入设置页
- **THEN** 在语言设置下方看到一行圆形色块，每个色块代表一个主题

#### Scenario: 当前主题高亮
- **WHEN** 某个主题被选中
- **THEN** 该色块外围显示选中边框或勾号

## MODIFIED Requirements
### Requirement: SettingsPage（原 settings-multilang）
SettingsPage SHALL 在语言选择器下方新增"主题风格"选择器区域。

## REMOVED Requirements
无。