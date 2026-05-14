# UI 重设计 & 按日期分 Collection 规格说明

## Why
当前 App 的 UI 风格偏中性/商务，首页展示的是"已处理照片"的扁平列表。对于以学生为主的移动端用户，需要更加明亮活泼的视觉风格和更直观的照片组织方式——按日期分 Collection 来管理每次拍照学习的成果。

## What Changes
- 整体 UI 风格重设计：明亮的渐变色主题、圆角卡片、活泼的配色和图标、移动端优先布局
- 首页按日期分组展示照片 Collection（如"5月13日 周一"），每个 Collection 可展开查看当天的照片
- IndexedDB 存储结构新增 `collectionDate` 字段，保存照片时自动归入当天的 Collection
- 首页顶部增加学习激励区域（如累计天数、单词量等统计卡片）
- 底部导航栏（Tab Bar）替换当前的单页切换方式，适配移动端操作习惯
- **BREAKING**：IndexedDB 版本号从 1 升级到 2，新增 `collectionDate` 索引

## Impact
- Affected specs: scene-english-learning（UI 层覆盖，功能逻辑不变）
- Affected code:
  - `frontend/src/App.css` — 全局样式重写（颜色、字体、间距、动画、移动端适配）
  - `frontend/src/App.tsx` — 引入底部 Tab Bar 导航
  - `frontend/src/pages/HomePage.tsx` — Collection 分组展示 + 统计卡片
  - `frontend/src/pages/ReviewPage.tsx` — 审核页 UI 改版，增加完成动画
  - `frontend/src/pages/MergePage.tsx` — 合并页 UI 改版
  - `frontend/src/context/ReviewContext.tsx` — 新增 collectionDate 相关状态和 action
  - `frontend/src/utils/indexedDB.ts` — Schema 升级、新增按日期查询、清理等接口
  - `frontend/src/components/AnnotatedImage.tsx` — 标注样式更新

---

## ADDED Requirements

### Requirement 1: 明亮活泼的 UI 主题
系统 SHALL 采用面向学生群体的明亮、活泼视觉风格，以渐变色彩、圆润卡片、柔和阴影和大号图标为核心设计语言。

#### Scenario 1.1: 整体配色
- **WHEN** 用户打开 App
- **THEN** 页面展示以暖色渐变（橙→粉/紫）为主色调，搭配白色卡片和柔和圆角

#### Scenario 1.2: 移动端优先
- **WHEN** 用户在手机上使用 App
- **THEN** 布局自适应移动端屏幕宽度（max-width: 480px 居中），按钮和交互元素尺寸适合手指触控（≥44px）

#### Scenario 1.3: 加载与过渡动画
- **WHEN** 页面切换或数据加载
- **THEN** 有平滑的过渡动画和加载动效，给用户轻盈活泼的感受

---

### Requirement 2: 底部 Tab Bar 导航
系统 SHALL 提供底部固定导航栏（Tab Bar），包含"首页"和"学习记录"两个 Tab，替换当前的状态切换方式。

#### Scenario 2.1: Tab 切换
- **WHEN** 用户点击底部 Tab
- **THEN** 页面切换到对应内容区域，Tab 图标高亮并带有微动效

#### Scenario 2.2: 审核模式和合并模式
- **WHEN** 用户进入审核页或合并页
- **THEN** 底部 Tab Bar 隐藏，以全屏模式进行操作；完成后返回首页 Tab

---

### Requirement 3: 首页学习激励区域
系统 SHALL 在首页顶部展示学习激励卡片，包含累计学习天数、已标注照片总数等统计信息。

#### Scenario 3.1: 统计展示
- **WHEN** 用户进入首页
- **THEN** 顶部展示"学习天数"、"照片总数"、"单词累计"三个统计卡片，以图标+数字的形式呈现

#### Scenario 3.2: 首次使用
- **WHEN** 新用户首次打开 App（无任何照片记录）
- **THEN** 统计卡片显示为 0，搭配鼓励性文案（如"开始你的第一次探索吧！"）

---

### Requirement 4: 按日期分 Collection 管理照片
系统 SHALL 将已处理的照片按保存日期自动归入当天的 Collection，首页按日期分组展示。

#### Scenario 4.1: 保存照片到当日 Collection
- **WHEN** 用户在审核页点击"保存"
- **THEN** 照片保存时自动带上当天日期（`collectionDate`），归入对应的 Collection

#### Scenario 4.2: 首页按日期分组展示
- **WHEN** 用户进入首页
- **THEN** 已处理照片按日期倒序分组显示，每个日期显示为一个 Collection 卡片，卡片上显示日期（如"5月13日 周一"）和该日照片数量

#### Scenario 4.3: 展开/收起 Collection
- **WHEN** 用户点击某个 Collection 卡片
- **THEN** 展开显示该日期下的所有照片缩略图（网格布局），再次点击收起

#### Scenario 4.4: 空 Collection 日
- **WHEN** 某天没有任何照片
- **THEN** 不显示该日期的 Collection

#### Scenario 4.5: 历史数据迁移
- **WHEN** 老用户升级 App（IndexedDB 中有旧格式数据，无 `collectionDate` 字段）
- **THEN** 旧数据自动以"更早的照片"分组展示，不影响正常使用

---

### Requirement 5: 首页上传入口优化
系统 SHALL 在首页提供更醒目、更有趣味性的上传入口。

#### Scenario 5.1: 拍照/上传按钮
- **WHEN** 用户在首页
- **THEN** 页面中下部展示一个大号浮动操作按钮（FAB），图标为相机，点击触发照片上传

#### Scenario 5.2: 上传引导动画
- **WHEN** 首页无照片时
- **THEN** 上传按钮带有呼吸灯动画，引导用户使用

---

### Requirement 6: 审核页 UI 优化
系统 SHALL 优化审核页的视觉风格，增加完成动画和进度展示。

#### Scenario 6.1: 审核页布局
- **WHEN** 用户进入审核页
- **THEN** 照片区域占主要面积，顶部进度条展示当前进度，底部操作按钮以圆角胶囊按钮呈现

#### Scenario 6.2: 完成动画
- **WHEN** 所有照片处理完毕
- **THEN** 展示撒花/庆祝动画，显示本次学习统计（保存数、跳过数），并提供"返回首页"按钮

---

## MODIFIED Requirements

### Requirement: 已处理照片管理（来自 scene-english-learning Requirement 5）
系统 SHALL 持久化保存已处理的照片到 IndexedDB，按日期分 Collection 管理，并提供查看/浏览/删除功能。

#### Scenario 5.1 改为: 查看已处理照片（按日期分组）
- **WHEN** 用户进入首页
- **THEN** 系统以日期 Collection 卡片形式展示所有已保存的照片，按日期倒序排列

#### Scenario 5.2 改为: 照片列表为空
- **WHEN** 用户尚未保存任何照片
- **THEN** 首页展示空状态插画和引导文案，上传 FAB 按钮带有呼吸动效

#### Scenario 5.3 保持不变: 删除已处理照片

---

## 技术方案概要

### 视觉设计
- **主色调**：暖色渐变（#FF6B6B → #FF8E53 → #FFA94D）
- **辅助色**：柔和紫 (#A29BFE)、清新绿 (#2ED573)、天空蓝 (#54A0FF)
- **背景色**：浅暖灰 (#FFF5F0) 
- **卡片**：纯白 + 大圆角(16px) + 柔和阴影
- **字体**：系统默认中文字体，标题加粗，字号偏大适合移动端阅读
- **图标**：Emoji 或 SVG 图标，风格统一

### 数据层
- IndexedDB `STORE_NAME = 'photos'`，新增 `collectionDate` 字段（ISO 日期字符串 `YYYY-MM-DD`），新增 `collectionDate` 索引
- DB Version 升级为 2，在 `onupgradeneeded` 中处理旧数据兼容

### 组件结构
- `App.tsx`：保留 Context Provider，新增底部 TabBar，根据 `page` 状态切换隐藏/显示
- `HomePage.tsx`：重构为统计卡片 + 日期 Collection 列表 + 上传 FAB
- `ReviewPage.tsx`：布局优化 + 完成动画
- `MergePage.tsx`：视觉统一