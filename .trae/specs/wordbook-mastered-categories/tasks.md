# Tasks

## Task 1: 新增 wordMastery.ts 工具模块

创建 `frontend/src/utils/wordMastery.ts`，封装掌握状态的读写操作。

- [x] SubTask 1.1: 创建 `getMasteredWords(): string[]` 函数：从 `localStorage` 读取 key `scene_lingo_mastered_words`，解析 JSON 数组返回（小写单词名），若不存在则返回空数组
- [x] SubTask 1.2: 创建 `isMastered(word: string): boolean` 函数：检查某单词（小写）是否在已掌握列表中
- [x] SubTask 1.3: 创建 `toggleMastered(word: string): boolean` 函数：切换某单词的掌握状态，返回切换后的状态（true=已掌握，false=未掌握），同步写入 localStorage
- [x] SubTask 1.4: 异常处理：localStorage 数据损坏时返回空数组，不影响正常使用

**依赖**: 无

---

## Task 2: 重写 WordBookPage.tsx（Tab 分类 + 状态切换）

重构单词本页面，新增 Tab 分类和单词掌握状态切换功能。

- [x] SubTask 2.1: 新增 Tab 状态管理：`activeTab` state（`'new' | 'mastered'`），默认 `'new'`
- [x] SubTask 2.2: 新增 Tab 切换 UI：在 Header 下方添加两个 Tab 按钮（生词表/已掌握），带选中高亮样式和单词数量显示
- [x] SubTask 2.3: 单词数据分类：加载单词时根据 localStorage 掌握状态分为两类
- [x] SubTask 2.4: 每个单词卡片右侧新增切换按钮（生词表中显示"✓ 已掌握"，已掌握中显示"↩ 移回生词表"），点击后即时切换分类并更新 localStorage
- [x] SubTask 2.5: 空状态文案：生词表空显示"太棒了，所有单词都已掌握！🎉"，已掌握空显示"还没有已掌握的单词，继续加油💪"
- [x] SubTask 2.6: 切换 Tab 时平滑过渡，保持现有动画效果

**依赖**: Task 1

---

## Task 3: 更新 WordDetailPage.tsx（掌握状态按钮）

单词详情页新增掌握/取消掌握按钮。

- [x] SubTask 3.1: 页面加载时从 `wordMastery.ts` 读取当前单词的掌握状态
- [x] SubTask 3.2: 在单词卡片中新增掌握状态按钮：已掌握显示"✅ 该单词已掌握"（灰色样式，点击取消），未掌握显示"标记为已掌握"按钮
- [x] SubTask 3.3: 点击按钮切换状态后即时更新 UI，同步写入 localStorage

**依赖**: Task 1

---

# Task Dependencies

- Task 1 可独立开发
- Task 2 依赖 Task 1
- Task 3 依赖 Task 1
- Task 2 和 Task 3 可并行开发