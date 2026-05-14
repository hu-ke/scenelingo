# Checklist

## 后端 API
- [x] `/api/recognize` 返回的每个 object 包含 `phonetic` 和 `examples` 字段
- [x] `examples` 是包含 2 个英文例句的字符串数组

## 类型与 Context
- [x] `RecognizedObject` 接口新增 `phonetic` 和 `examples` 字段
- [x] `AppPage` 新增 `'wordbook'` 和 `'worddetail'`
- [x] Context 中 `wordDetailWord` 状态和 `setWordDetail` action 正常工作

## 气泡标注
- [x] 照片上的物体用圆角气泡标注而非矩形框
- [x] 气泡带彩色边框 + 底部三角尾巴指向物体
- [x] 每个物体气泡颜色不同（调色板循环）
- [x] 气泡内显示英文单词（加粗）+ 音标（小字灰色）
- [x] 气泡右侧有喇叭图标按钮

## 发音功能
- [x] 点击喇叭图标触发浏览器 TTS 朗读英文单词
- [x] 播放期间喇叭有脉动动画
- [x] 发音使用 `lang='en-US'`

## 批量限制
- [x] 选择超过 10 张时弹出提示并只取前 10 张
- [x] 选择 ≤10 张时正常进入审核流程

## 重新处理
- [x] 点击 Collection 中的照片缩略图进入单独审核模式
- [x] 重新处理后保存覆盖原记录（同一 ID）
- [x] 覆盖后首页 Collection 中照片更新

## 审核页音标展示
- [x] 照片下方展示识别到的单词小卡片（英文 + 音标）
- [x] 每个单词卡片可点击展开显示 2 个例句
- [x] 每个单词卡片有发音喇叭按钮

## 单词本页
- [x] 点击"单词累计"卡片进入单词本页
- [x] 单词列表去重展示（英文 + 音标 + 来源照片数）
- [x] 点击单词进入单词详情页
- [x] 空状态显示引导文案
- [x] 有返回按钮回到首页
- [x] 空状态时"单词累计"卡片不可点击

## 单词详情页
- [x] 展示该单词的关联照片缩略图
- [x] 展示 2 个英文例句
- [x] 发音按钮可用
- [x] 有返回按钮回到单词本

## 移除 TabBar
- [x] 底部不再显示 TabBar
- [x] TabBar 组件代码已删除
- [x] App.tsx 恢复简单 switch 路由
- [x] .page 的 padding-bottom 不再预留 tab-bar 高度

## 路由
- [x] home → review / merge / wordbook
- [x] wordbook → worddetail
- [x] worddetail → wordbook
- [x] 所有页面可正常返回首页