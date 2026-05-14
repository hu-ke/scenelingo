# Tasks

## Task 1: 升级 IndexedDB Schema，新增 collectionDate 字段
更新 IndexedDB 存储结构，新增 `collectionDate` 字段和索引，处理旧数据兼容。同时新增按日期查询的辅助函数。

- [x] SubTask 1.1: 将 DB_VERSION 升级为 2，在 `onupgradeneeded` 中新增 `collectionDate` 索引，旧记录自动填充 `collectionDate` 为 `"earlier"`
- [x] SubTask 1.2: 修改 `savePhoto` 函数，保存时自动添加当天日期 `collectionDate`（格式 `YYYY-MM-DD`）
- [x] SubTask 1.3: 新增 `getPhotosGroupedByDate` 工具函数，返回按 `collectionDate` 分组的数据结构 `Record<string, PhotoItem[]>`

**依赖**: 无

---

## Task 2: 重写全局样式（App.css）
将所有 CSS 变量、基础样式、组件样式替换为明亮活泼的学生风格。

- [x] SubTask 2.1: 替换 CSS 变量：暖色渐变主色调、柔和辅助色、浅暖灰背景、大圆角
- [x] SubTask 2.2: 重写基础元素样式（body, button, input, .card, .page），移动端优先 max-width: 480px
- [x] SubTask 2.3: 新增动画关键帧（fadeIn, slideUp, breathe, confetti 等）
- [x] SubTask 2.4: 新增移动端适配媒体查询（≤480px 和 ≤360px 断点）
- [x] SubTask 2.5: 新增底部 Tab Bar 样式
- [x] SubTask 2.6: 新增首页统计卡片、Collection 列表、FAB 按钮样式
- [x] SubTask 2.7: 更新审核页进度条、胶囊按钮、完成动画样式
- [x] SubTask 2.8: 更新合并页样式以匹配新主题

**依赖**: 无（可与 Task 1 并行）

---

## Task 3: 重构首页（HomePage.tsx）
将首页从"上传入口 + 扁平照片列表"改为"统计卡片 + Collection 分组 + FAB 上传"。

- [x] SubTask 3.1: 添加顶部 Header 区域（App 名称 + 装饰元素）
- [x] SubTask 3.2: 实现学习统计卡片区域（学习天数、照片总数、单词累计）
- [x] SubTask 3.3: 实现 Collection 列表：调用 `getPhotosGroupedByDate` 获取分组数据，渲染日期卡片
- [x] SubTask 3.4: 实现 Collection 卡片展开/收起交互（点击展开显示照片网格，再点击收起）
- [x] SubTask 3.5: 实现 FAB 上传按钮（固定在右下角，相机图标，替代原来的上传区域）
- [x] SubTask 3.6: 实现空状态设计（无照片时显示插画 + 鼓励文案 + FAB 呼吸动画）
- [x] SubTask 3.7: 保留照片选择（checkbox）、删除、合并导出功能（移动端适配）

**依赖**: Task 1, Task 2

---

## Task 4: 重构 App.tsx + 底部 Tab Bar
引入底部 Tab Bar 导航，管理页面切换和 Tab Bar 显隐。

- [x] SubTask 4.1: 创建底部 TabBar 组件（"首页 🏠"和"学习记录 📚"两个 Tab），SVG 图标 + 标签文字
- [x] SubTask 4.2: 在 `App.tsx` 中集成 TabBar，根据 `page` 状态决定显示/隐藏（审核页和合并页隐藏 TabBar）
- [x] SubTask 4.3: 实现 Tab 切换动画（图标缩放 + 颜色过渡）
- [x] SubTask 4.4: "学习记录"Tab 复用 Collection 列表视图（或先展示 Coming Soon 占位，后续扩展）

**依赖**: Task 2, Task 3

---

## Task 5: 重写审核页 UI（ReviewPage.tsx）
优化审核页的视觉风格和交互体验。

- [x] SubTask 5.1: 替换进度指示器：从"第 X/N 张"改为顶部渐变进度条 + 数字标签
- [x] SubTask 5.2: 替换操作按钮样式：圆角胶囊按钮，主色"保存"、次要"重新识别"、边框"跳过"
- [x] SubTask 5.3: 保存时传递 `collectionDate`（当天日期）
- [x] SubTask 5.4: 实现识别中加载动画（跳动圆点或骨架屏）
- [x] SubTask 5.5: 实现完成动画（撒花效果 + 恭喜弹窗 + 统计信息）
- [x] SubTask 5.6: 实现顶部返回按钮（退出审核，回到首页）

**依赖**: Task 1, Task 2

---

## Task 6: 更新合并导出页 UI（MergePage.tsx）
将合并导出页视觉风格统一为新主题。

- [x] SubTask 6.1: 更新页面头部样式（返回按钮 + 标题）
- [x] SubTask 6.2: 更新 Canvas 预览区样式（圆角边框 + 新主题阴影）
- [x] SubTask 6.3: 更新下载导出按钮样式（渐变胶囊按钮）
- [x] SubTask 6.4: 更新空状态/错误提示样式

**依赖**: Task 2

---

## Task 7: 更新标注组件样式（AnnotatedImage.tsx）
调整标注绘制的颜色和字体以匹配新主题。

- [x] SubTask 7.1: 更新边界框颜色为辅助色系（如柔和紫 #A29BFE）
- [x] SubTask 7.2: 更新标签背景和文字样式（圆角标签、加粗字体）
- [x] SubTask 7.3: 更新"未识别到物体"提示样式

**依赖**: Task 2

---

# Task Dependencies
- Task 1 与 Task 2 可并行开发
- Task 3 依赖 Task 1 + Task 2
- Task 4 依赖 Task 2 + Task 3
- Task 5 依赖 Task 1 + Task 2
- Task 6 依赖 Task 2
- Task 7 依赖 Task 2
- Task 3 与 Task 5 可并行开发（Task 1 和 Task 2 完成后）
- Task 6 与 Task 7 可并行开发