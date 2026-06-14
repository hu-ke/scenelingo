# Tasks

- [x] Task 1: 创建分享卡片 Canvas 生成工具
  - [x] 在 `miniprogram/src/utils/` 下新建 `shareCard.ts`
  - [x] 使用 `Taro.createCanvasContext` 创建 Canvas（500×400px）
  - [x] 绘制渐变背景（#4A90D9 → #7EC8E3）
  - [x] 绘制白色半透明圆角卡片内框，增加层次感
  - [x] 绘制小程序名称「场景外语」（白色大号粗体，居中）
  - [x] 绘制 Slogan「拍照学外语，所见即所学」（白色小号，名称下方）
  - [x] 绘制功能引导语「📸 拍张照 → 🔍 识别物品 → 📝 学习单词」
  - [x] 绘制底部装饰元素（装饰圆点 + 相机图形）
  - [x] 导出 Canvas 为临时图片文件路径并返回

- [x] Task 2: 在首页接入分享功能
  - [x] 在 `miniprogram/src/pages/home/index.tsx` 中引入 `useShareAppMessage` 和 `useShareTimeline`
  - [x] 实现 `useShareAppMessage`：标题使用「我发现一个超实用的拍照学外语小程序！拍张照就能学单词，快来试试~」，图片调用 Task 1 的分享卡片生成工具，路径指向首页
  - [x] 实现 `useShareTimeline`：标题使用「场景外语 - 拍照学外语，所见即所学」，图片调用 Task 1 的分享卡片生成工具，路径指向首页
  - [x] 分享卡片图片预生成并缓存，避免每次分享时重新绘制

- [x] Task 3: 验证与测试
  - [x] 确认首页右上角菜单出现"转发"和"分享到朋友圈"选项（使用 `useShareAppMessage` 和 `useShareTimeline` 自动启用）
  - [x] 确认分享卡片视觉效果符合设计规格（Canvas 500×400px，渐变背景，名称/Slogan/引导语/相机图形）
  - [x] 确认分享路径正确指向首页（`/pages/home/index`）
  - [x] 构建通过，无编译错误

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3 依赖 Task 1 和 Task 2