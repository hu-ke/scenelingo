# Tasks

- [x] Task 1: 后端收藏夹 API 实现
  - [x] SubTask 1.1: 在 `auth.py` 中实现收藏夹业务逻辑函数（创建文件夹、获取子文件夹列表、重命名、级联删除、添加收藏项、获取收藏图片列表、移除收藏项）
  - [x] SubTask 1.2: 在 `main.py` 中新增收藏夹路由（POST/GET/PUT/DELETE `/favorites/folders`、POST/GET/DELETE `/favorites/items`），添加请求模型
  - [x] SubTask 1.3: 在 `db.py` 的 `init_db()` 中创建 `favorite_folders` 和 `favorite_photos` 集合的索引

- [x] Task 2: 底部菜单新增收藏夹 Tab
  - [x] SubTask 2.1: 在 `app.config.ts` 的 tabBar.list 中新增"收藏夹" Tab 项
  - [x] SubTask 2.2: 在 `custom-tab-bar/index.tsx` 的 TAB_LIST 中新增对应 Tab 项

- [x] Task 3: 收藏夹主页面（`pages/favorites/index`）
  - [x] SubTask 3.1: 创建页面文件（`index.tsx`、`index.scss`、`index.config.ts`）
  - [x] SubTask 3.2: 实现根目录文件夹列表展示（调用后端获取文件夹列表）
  - [x] SubTask 3.3: 实现新建文件夹功能（弹出输入框）
  - [x] SubTask 3.4: 实现文件夹重命名（长按菜单）
  - [x] SubTask 3.5: 实现文件夹删除（长按菜单 + 确认对话框）
  - [x] SubTask 3.6: 实现空状态提示

- [x] Task 4: 文件夹详情页（`pages/favorites/folder`）
  - [x] SubTask 4.1: 创建页面文件（`index.tsx`、`index.scss`、`index.config.ts`）
  - [x] SubTask 4.2: 实现子文件夹列表展示和点击进入
  - [x] SubTask 4.3: 实现已收藏图片网格展示（缩略图）
  - [x] SubTask 4.4: 实现面包屑导航 / 返回上级目录
  - [x] SubTask 4.5: 实现文件夹内新建子文件夹、重命名、删除功能
  - [x] SubTask 4.6: 实现图片取消收藏功能（长按菜单）

- [x] Task 5: 首页和复习页添加"收藏到文件夹"入口
  - [x] SubTask 5.1: 在首页照片卡片上添加操作入口（长按菜单或操作按钮），触发文件夹选择器
  - [x] SubTask 5.2: 在复习页添加收藏按钮，触发文件夹选择器
  - [x] SubTask 5.3: 实现文件夹选择器组件（递归展示文件夹树，支持展开/折叠，选择目标文件夹后提交）

- [x] Task 6: API 工具函数和前端对接
  - [x] SubTask 6.1: 在 `miniprogram/src/utils/api.ts` 中封装收藏夹相关 API 调用函数
  - [x] SubTask 6.2: 在所有新页面中对接后端 API

# Task Dependencies
- [Task 2] 依赖 [Task 1]（Tab 配置需要后端 API 就绪后整体联调，但配置本身可并行）
- [Task 3] 依赖 [Task 1]（页面数据加载依赖后端 API）
- [Task 4] 依赖 [Task 1]（页面数据加载依赖后端 API）
- [Task 5] 依赖 [Task 1]（文件夹选择器需要获取后端文件夹数据）
- [Task 6] 与 [Task 3]、[Task 4]、[Task 5] 紧密关联，可以在实现页面时一并完成
