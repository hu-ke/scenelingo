# 气泡标注 & 音标发音 & 单词本 & 重新处理 规格说明

## Why
当前照片中的物体使用生硬的矩形框标注，不够可爱；翻译缺少音标和发音支持；已保存的照片无法再次点击处理；缺少单词学习回顾功能；"学习记录"Tab 无内容显得多余；没有批量上传数量限制。

## What Changes
- 标注样式：从矩形框改为可爱的小气泡（圆角矩形 + 小尾巴指向物体）
- 后端 API：识别结果新增 `phonetic`（音标）字段和 `examples`（2个英文例句）字段
- 前端：单词标注旁显示音标，新增发音按钮（Web Speech API TTS）
- 首页：已处理照片可点击进入单独审核模式重新识别/重新标注
- 首页：点击"单词累计"卡片进入单词本页面，展示所有学过的单词，点击单词可查看关联照片和例句
- **BREAKING**：一次最多选取 10 张图片上传
- 移除底部 TabBar 中的"学习记录"Tab（无内容）
- 更新 `ui-redesign-daily-collections` specs 中的相关变更

## Impact
- Affected specs: scene-english-learning, ui-redesign-daily-collections
- Affected code:
  - `backend/main.py` — 扩展 `/api/recognize` 返回 phonetic 和 examples，新增 `/api/examples` 接口
  - `frontend/src/context/ReviewContext.tsx` — RecognizedObject 新增 phonetic、examples 字段，新增 `reviewSinglePhoto` action
  - `frontend/src/components/AnnotatedImage.tsx` — 矩形框改为气泡绘制
  - `frontend/src/pages/HomePage.tsx` — 照片点击重新处理、上传10张限制、单词卡片点击跳转
  - `frontend/src/pages/ReviewPage.tsx` — 音标展示 + 发音按钮、单词例句展示
  - `frontend/src/App.tsx` — 移除 TabBar，"学习记录"Tab 删除
  - `frontend/src/App.css` — 气泡标注相关样式更新
  - 新增 `frontend/src/pages/WordBookPage.tsx` — 单词本页面
  - 新增 `frontend/src/pages/WordDetailPage.tsx` — 单词详情页（照片+例句）

---

## ADDED Requirements

### Requirement 1: 可爱气泡标注
系统 SHALL 用可爱的小气泡风格替代矩形框来标注照片中的物体。

#### Scenario 1.1: 气泡绘制
- **WHEN** 识别结果展示在照片上
- **THEN** 每个物体用一个圆角气泡框标注（白色背景 + 柔和彩色边框），气泡底部带一个小三角尾巴指向物体中心

#### Scenario 1.2: 气泡内容
- **WHEN** 气泡标注渲染
- **THEN** 气泡内显示英文单词（加粗），下方小字显示音标

---

### Requirement 2: 音标与发音
系统 SHALL 为每个识别的英文单词提供音标展示和一键发音功能。

#### Scenario 2.1: 音标返回
- **WHEN** 后端 `/api/recognize` 返回识别结果
- **THEN** 每个 object 包含 `phonetic` 字段（如 "/ˈæp.l/"），前端在气泡中显示

#### Scenario 2.2: 发音按钮
- **WHEN** 用户查看标注气泡
- **THEN** 气泡内有一个小喇叭图标按钮，点击后使用浏览器 Web Speech API 朗读该单词

#### Scenario 2.3: 发音反馈
- **WHEN** 用户点击发音按钮
- **THEN** 喇叭图标播放期间有脉动动画，朗读完成后恢复

---

### Requirement 3: 已处理照片重新处理
系统 SHALL 允许用户在首页点击已保存照片的缩略图，进入该照片的单独审核/重新识别模式。

#### Scenario 3.1: 点击照片进入审核
- **WHEN** 用户在 Collection 展开的网格中点击某张照片
- **THEN** 进入审核页，照片队列只有这一张，可以重新识别、保存标注覆盖原图

#### Scenario 3.2: 重新处理后保存
- **WHEN** 用户对已保存照片重新识别并保存
- **THEN** 新的标注结果覆盖原有记录（同一 ID 更新），返回首页后 Collection 中照片已更新

---

### Requirement 4: 批量上传数量限制
系统 SHALL 限制一次最多选取 10 张照片进行批量处理。

#### Scenario 4.1: 超过10张
- **WHEN** 用户选择超过 10 张照片
- **THEN** 系统提示"一次最多选择10张照片"，只取前 10 张进入审核队列

#### Scenario 4.2: 10张以内
- **WHEN** 用户选择 ≤10 张照片
- **THEN** 正常进入审核流程，无额外提示

---

### Requirement 5: 单词本功能
系统 SHALL 提供单词本页面，汇总所有学过的英文单词，支持查看每个单词的关联照片和英文例句。

#### Scenario 5.1: 进入单词本
- **WHEN** 用户在首页点击"单词累计"统计卡片
- **THEN** 进入单词本页面，展示所有学过的单词列表（去重），每个单词显示英文 + 音标

#### Scenario 5.2: 单词详情
- **WHEN** 用户点击单词本中的某个单词
- **THEN** 进入单词详情页，展示：
  - 该单词
  - 学习该单词时的原始照片（带气泡标注）
  - 2 个英文例句（来自后端返回的 examples 字段）

#### Scenario 5.3: 空单词本
- **WHEN** 用户尚未保存任何照片（无单词记录）
- **THEN** 单词本页面显示空状态提示

#### Scenario 5.4: 从单词本返回首页
- **WHEN** 用户在单词本或单词详情页点击返回
- **THEN** 回到首页

---

### Requirement 6: 移除"学习记录"Tab
系统 SHALL 从底部导航栏中移除"学习记录"Tab。

#### Scenario 6.1: TabBar 简化
- **WHEN** 用户在首页
- **THEN** 底部不再显示 TabBar，仅保留页面本身内容

---

## MODIFIED Requirements

### Requirement: 识别结果数据结构 (来自 scene-english-learning)
`RecognizedObject` 接口变更为：
```typescript
interface RecognizedObject {
  name: string;           // 英文单词
  phonetic: string;       // 音标，如 "/ˈæp.l/"
  bbox: [number, number, number, number];  // 边界框坐标
  examples: string[];     // 2个英文例句
}
```

### Requirement: 首页导航方式 (来自 ui-redesign-daily-collections)
移除底部 TabBar，首页不再有 Tab 切换。首页 → 审核页 → 合并页 → 单词本 → 单词详情的导航通过 Context 的 `page` 状态管理：
- `home`: 首页
- `review`: 审核页
- `merge`: 合并预览页
- `wordbook`: 单词本页
- `worddetail`: 单词详情页

---

## 技术方案概要

### 气泡标注 Canvas 绘制
- 计算物体中心点作为气泡尾巴指向位置
- 气泡主体：白色圆角矩形（rx=10）+ 柔和彩色描边（每个物体不同颜色）
- 尾巴：小三角形指向物体中心
- 气泡内两行文字：英文单词（bold）+ 音标（small, gray）
- 右侧喇叭图标 SVG 绘制（点击触发 TTS）

### 发音实现
- 使用浏览器内置 `SpeechSynthesisUtterance` API
- `speechSynthesis.speak(new SpeechSynthesisUtterance(word))` 设置 `lang='en-US'`

### 后端扩展
- 修改 prompt，要求 AI 返回 `phonetic`、`examples` 字段
- 数据结构：
```json
{
  "name": "apple",
  "phonetic": "/ˈæp.l/",
  "bbox": [100, 200, 300, 400],
  "examples": ["I ate a red apple.", "The apple fell from the tree."]
}
```

### 单词本数据来源
- 从 IndexedDB 所有照片的 `objects` 字段中提取所有单词（去重按 name）
- 每个单词关联其所在的照片和例句
- 无需额外存储，直接从已有数据聚合

### 重新处理流程
- 首页点击照片 → dispatch `setPhotos` 单张 + `setPage: 'review'`
- 保存时使用相同 ID → IndexedDB `put` 覆盖原记录