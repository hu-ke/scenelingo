# Checklist

## wordMastery.ts 工具模块
- [x] `getMasteredWords()` 从 `scene_lingo_mastered_words` 正确读取并返回数组
- [x] `isMastered(word)` 正确判断单词是否在列表中（大小写不敏感）
- [x] `toggleMastered(word)` 正确添加/移除并写入 localStorage
- [x] localStorage 数据损坏时返回空数组不报错

## WordBookPage Tab 分类
- [x] 页面默认显示"生词表"Tab
- [x] "生词表"和"已掌握"两个 Tab 标签正确显示
- [x] Tab 标签上显示对应分类的单词数量
- [x] 点击 Tab 可切换显示对应分类的单词列表
- [x] 生词表为空时显示"太棒了，所有单词都已掌握！🎉"
- [x] 已掌握为空时显示"还没有已掌握的单词，继续加油💪"
- [x] Tab 切换有选中高亮样式

## WordBookPage 状态切换
- [x] 生词表中每个单词卡片显示"✓ 已掌握"按钮
- [x] 已掌握中每个单词卡片显示"↩ 移回生词表"按钮
- [x] 点击"✓ 已掌握"按钮后，单词从生词表移到已掌握，计数更新
- [x] 点击"↩ 移回生词表"按钮后，单词从已掌握移到生词表，计数更新
- [x] 切换后 localStorage 同步更新
- [x] 切换操作即时生效，无需刷新

## WordDetailPage 掌握状态
- [x] 详情页正确显示当前单词的掌握状态
- [x] 未掌握时显示"标记为已掌握"按钮
- [x] 已掌握时显示"✅ 该单词已掌握"并可点击取消
- [x] 点击切换后状态即时更新，localStorage 同步
- [x] 返回单词本后分类已同步更新

## 边界情况
- [x] localStorage 中无 `scene_lingo_mastered_words` 时所有单词显示在生词表中
- [x] 新学到的单词自动归入生词表
- [x] 所有单词都已掌握后生词表显示空状态
- [x] 页面刷新后掌握状态正确恢复