# 单词本生词表/已掌握分类 规格说明

## Why
当前单词本将所有学过的单词混在一起展示，用户无法区分哪些单词还需要复习、哪些已经掌握。增加"生词表"和"已掌握"两个分类，方便用户管理学习进度。

## What Changes
- 单词本页面新增两个 Tab：**生词表**（默认）和 **已掌握**
- 每个单词卡片新增"标记为已掌握"/"标记为生词"按钮，可在两个分类间切换
- 掌握状态使用 `localStorage` 持久化（key: `scene_lingo_mastered_words`，存储为 JSON 字符串数组），登录和未登录用户均可用
- 单词详情页也新增掌握/取消掌握按钮
- 单词本 Header 中显示当前 Tab 的单词数量

## Impact
- Affected specs: scene-english-learning（原有单词本功能）
- Affected code:
  - `frontend/src/pages/WordBookPage.tsx` — 新增 Tab 切换 UI、掌握状态切换按钮、掌握状态读写逻辑
  - `frontend/src/pages/WordDetailPage.tsx` — 新增掌握状态切换按钮
  - `frontend/src/utils/wordMastery.ts` — **新增**：封装掌握状态的读写工具函数

---
## ADDED Requirements

### Requirement 1: 单词本 Tab 分类
系统 SHALL 在单词本页面提供"生词表"和"已掌握"两个 Tab，用户可切换查看。

#### Scenario 1.1: 默认显示生词表
- **WHEN** 用户打开单词本页面
- **THEN** 默认显示"生词表"Tab，列出所有未被标记为已掌握的单词

#### Scenario 1.2: 切换到已掌握
- **WHEN** 用户点击"已掌握"Tab
- **THEN** 显示所有已标记为掌握的单词列表

#### Scenario 1.3: Tab 显示数量
- **WHEN** 任一 Tab 处于激活状态
- **THEN** Tab 标签上显示对应分类的单词数量，如"生词表 (12)"、"已掌握 (5)"

#### Scenario 1.4: 空状态
- **WHEN** 某个分类下没有单词（如所有单词都已掌握，生词表为空）
- **THEN** 显示对应的空状态提示：生词表空 → "太棒了，所有单词都已掌握！🎉"，已掌握空 → "还没有已掌握的单词，继续加油！"

---
### Requirement 2: 单词掌握状态切换
系统 SHALL 支持用户将单词在"生词表"和"已掌握"之间切换。

#### Scenario 2.1: 标记为已掌握
- **WHEN** 用户点击生词表中某个单词的"✓ 已掌握"按钮
- **THEN** 该单词从生词表移除，出现在已掌握列表中，按钮变为"↩ 移回生词表"

#### Scenario 2.2: 取消已掌握
- **WHEN** 用户点击已掌握列表中某个单词的"↩ 移回生词表"按钮
- **THEN** 该单词从已掌握列表移除，出现在生词表中，按钮变为"✓ 已掌握"

#### Scenario 2.3: 操作即时反馈
- **WHEN** 用户切换单词状态
- **THEN** 界面即时更新，无需刷新页面；单词数量计数同步更新

---
### Requirement 3: 掌握状态持久化
系统 SHALL 将掌握的单词列表持久化到 localStorage。

#### Scenario 3.1: 保存状态
- **WHEN** 用户标记某个单词为已掌握
- **THEN** 该单词名（小写）添加到 localStorage `scene_lingo_mastered_words` 的 JSON 数组中

#### Scenario 3.2: 恢复状态
- **WHEN** 用户下次打开单词本
- **THEN** 从 localStorage 读取已掌握单词列表，正确分类显示

#### Scenario 3.3: 取消掌握
- **WHEN** 用户取消某单词的已掌握状态
- **THEN** 从 localStorage 的 JSON 数组中移除该单词

---
### Requirement 4: 单词详情页掌握状态
系统 SHALL 在单词详情页也提供掌握状态切换功能。

#### Scenario 4.1: 显示当前状态
- **WHEN** 用户进入单词详情页
- **THEN** 页面显示该单词的当前掌握状态（已掌握显示"该单词已掌握 ✓"，未掌握显示"标记为已掌握"按钮）

#### Scenario 4.2: 详情页切换
- **WHEN** 用户在详情页点击掌握状态按钮
- **THEN** 切换掌握状态并更新 UI，返回单词本后分类已同步更新