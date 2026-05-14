# Tasks

## Task 1: 扩展后端 API 返回音标和例句
修改 `/api/recognize` 接口的 prompt，要求 AI 返回 `phonetic` 和 `examples` 字段。

- [x] SubTask 1.1: 修改 `main.py` 中的 prompt，要求 AI 为每个物体返回 `phonetic`（英文音标）和 `examples`（2个英文例句的字符串数组）
- [x] SubTask 1.2: 确认返回的 JSON 结构为 `[{name, phonetic, bbox, examples}]`，兼容前端新接口

**依赖**: 无

---

## Task 2: 更新类型定义和 Context
更新 `RecognizedObject` 接口和 Context 状态管理，新增单词本/单词详情页面路由。

- [x] SubTask 2.1: 更新 `RecognizedObject` 接口，新增 `phonetic: string` 和 `examples: string[]` 字段
- [x] SubTask 2.2: 新增 `AppPage` 类型成员 `'wordbook'` 和 `'worddetail'`
- [x] SubTask 2.3: 新增 `ReviewState` 字段 `wordDetailWord: string | null` 存储单词详情当前单词
- [x] SubTask 2.4: 新增 action `setWordDetail` 用于设置当前查看的单词

**依赖**: Task 1

---

## Task 3: 重写标注组件为气泡风格（AnnotatedImage.tsx）
将 Canvas 绘制从矩形框改为可爱气泡 + 音标 + 发音按钮。

- [x] SubTask 3.1: 实现气泡绘制函数：白色圆角矩形 + 彩色边框 + 底部三角尾巴指向物体中心
- [x] SubTask 3.2: 气泡内绘制英文单词（bold）+ 音标（small gray）
- [x] SubTask 3.3: 气泡右侧绘制喇叭 SVG 图标，点击触发 `SpeechSynthesis` TTS 发音
- [x] SubTask 3.4: 每个物体使用不同颜色（预设柔和调色板：紫、蓝、绿、橙、粉循环）
- [x] SubTask 3.5: 喇叭播放状态脉动动画

**依赖**: Task 2

---

## Task 4: 实现批量上传10张限制
在 HomePage 上传逻辑中限制最多 10 张。

- [x] SubTask 4.1: 在 `handleFileChange` 中截取前 10 张，超过时 `alert` 提示用户

**依赖**: 无

---

## Task 5: 实现已保存照片重新处理
在首页 Collection 网格中点击照片进入单独审核模式。

- [x] SubTask 5.1: Collection 网格中照片缩略图添加 `onClick` 事件
- [x] SubTask 5.2: 点击后将该照片作为单张队列，dispatch `setPhotos` + `setPage: 'review'`
- [x] SubTask 5.3: 保存时使用相同 ID，IndexedDB 中覆盖更新

**依赖**: Task 2

---

## Task 6: 审核页增加音标展示和单词例句
在审核页中展示音标，并可查看当前识别物体的例句。

- [x] SubTask 6.1: 在照片卡片下方展示当前识别到的单词列表（英文 + 音标，小卡片排列）
- [x] SubTask 6.2: 每个单词卡片点击可展开显示 2 个例句
- [x] SubTask 6.3: 每个单词卡片包含发音小喇叭按钮

**依赖**: Task 2, Task 3

---

## Task 7: 创建单词本页面（WordBookPage.tsx）
从已保存的照片数据中聚合所有单词，展示单词列表。

- [x] SubTask 7.1: 创建 `WordBookPage.tsx`，从 IndexedDB `getAllPhotos` 中提取所有 `objects`，去重按 name 聚合
- [x] SubTask 7.2: 展示单词列表：每个单词一行（英文 + 音标 + 来源照片数量）
- [x] SubTask 7.3: 点击单词 → dispatch `setWordDetail` + `setPage: 'worddetail'`
- [x] SubTask 7.4: 空状态展示（无单词时显示引导文案）
- [x] SubTask 7.5: 顶部返回按钮，点击回到首页

**依赖**: Task 2

---

## Task 8: 创建单词详情页（WordDetailPage.tsx）
展示单个单词的关联照片和例句。

- [x] SubTask 8.1: 创建 `WordDetailPage.tsx`，从 Context 获取当前单词
- [x] SubTask 8.2: 从 IndexedDB 所有照片中筛选出包含该单词的照片
- [x] SubTask 8.3: 展示关联照片（带气泡标注的缩略图）
- [x] SubTask 8.4: 展示该单词的 2 个英文例句
- [x] SubTask 8.5: 发音按钮 + 顶部返回按钮

**依赖**: Task 2, Task 7

---

## Task 9: 首页单词累计改为可点击
将"单词累计"统计卡片改为可交互按钮，点击进入单词本。

- [x] SubTask 9.1: 在 `handleToggleSelect` 同级添加点击统计卡片的处理函数
- [x] SubTask 9.2: "单词累计"卡片添加 `cursor: pointer` 和点击动效
- [x] SubTask 9.3: 空状态时卡片不可点击（灰色显示）

**依赖**: Task 7

---

## Task 10: 移除"学习记录"Tab
从 App.tsx 中删除 TabBar 组件和相关状态。

- [x] SubTask 10.1: 删除 `TabBar` 组件定义和渲染代码
- [x] SubTask 10.2: 删除 `activeTab` 状态
- [x] SubTask 10.3: 更新 `AppContent` 渲染逻辑，恢复简单的 switch 页面切换
- [x] SubTask 10.4: 更新 App.css：移除 `.tab-bar`、`.tab-bar__item` 等 Tab Bar 相关样式
- [x] SubTask 10.5: 新增 `wordbook` 和 `worddetail` 页面的路由 case
- [x] SubTask 10.6: 调整 `.page` 的 `padding-bottom`（移除 tab-bar 高度预留）

**依赖**: Task 7, Task 8

---

# Task Dependencies
- Task 1 可独立开发
- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 可独立开发
- Task 5 依赖 Task 2
- Task 6 依赖 Task 2, Task 3
- Task 7 依赖 Task 2
- Task 8 依赖 Task 2, Task 7
- Task 9 依赖 Task 7
- Task 10 依赖 Task 7, Task 8
- Task 4 可与 Task 1, Task 3 并行
- Task 5, Task 6, Task 7 可在 Task 2 完成后并行