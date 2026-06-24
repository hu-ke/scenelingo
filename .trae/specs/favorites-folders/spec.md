# 收藏夹 Spec

## Why
用户需要将感兴趣的图片收藏到自定义文件夹中以便回顾，支持像目录树一样嵌套多层收藏夹，实现更灵活的分类管理。

## What Changes
- 底部菜单新增"收藏夹" Tab
- 新建 `pages/favorites/index` 页面（收藏夹列表页，展示根目录下的文件夹和子文件夹）
- 新建 `pages/favorites/folder` 页面（文件夹详情页，展示当前文件夹内的子文件夹和已收藏图片）
- 新建后端收藏夹 CRUD API（`/favorites/folders` 和 `/favorites/items`）
- 新建 MongoDB 集合 `favorite_folders` 和 `favorite_photos`
- 首页和复习页的图片上增加"收藏到文件夹"操作入口
- 支持文件夹的创建、重命名、删除（级联删除子文件夹和收藏项）

## Impact
- Affected specs: 无（全新功能）
- Affected code:
  - **Backend**: `backend/main.py`（新增路由）、`backend/auth.py`（新增业务逻辑）
  - **Mini-Program**: `miniprogram/src/app.config.ts`（Tab 配置）、`miniprogram/src/custom-tab-bar/index.tsx`（自定义 Tab 栏）、`miniprogram/src/pages/favorites/`（新页面）、`miniprogram/src/pages/home/index.tsx`（添加入口）、`miniprogram/src/pages/review/index.tsx`（添加入口）

## ADDED Requirements

### Requirement: 底部收藏夹 Tab
系统 SHALL 在底部导航栏新增"收藏夹" Tab，点击后跳转到收藏夹主页面。

#### Scenario: 点击收藏夹 Tab
- **WHEN** 用户在底部导航栏点击"收藏夹"
- **THEN** 跳转到收藏夹主页面，显示用户的根目录文件夹列表

### Requirement: 多层级文件夹管理
系统 SHALL 支持创建多层级的收藏文件夹，每个文件夹可以包含子文件夹和收藏的图片。

#### Scenario: 创建根目录文件夹
- **WHEN** 用户在收藏夹主页点击"新建文件夹"
- **THEN** 弹出输入框，用户输入文件夹名称后确认，新建的文件夹出现在根目录列表中

#### Scenario: 在文件夹内创建子文件夹
- **WHEN** 用户进入某个文件夹后点击"新建子文件夹"
- **THEN** 弹出输入框，用户输入名称后确认，子文件夹出现在当前文件夹内

#### Scenario: 重命名文件夹
- **WHEN** 用户长按或左滑文件夹，选择"重命名"
- **THEN** 弹出输入框预填当前名称，用户修改后确认，文件夹名称更新

#### Scenario: 删除文件夹
- **WHEN** 用户长按或左滑文件夹，选择"删除"
- **THEN** 弹出确认对话框，确认后级联删除该文件夹、所有子文件夹及其中的收藏项

#### Scenario: 空文件夹提示
- **WHEN** 当前目录下没有任何文件夹和收藏图片
- **THEN** 显示空状态提示"暂无收藏，去首页收藏喜欢的图片吧"

### Requirement: 将图片加入收藏夹
系统 SHALL 支持从首页照片列表和复习页将图片添加到指定收藏文件夹。

#### Scenario: 从首页添加图片到收藏夹
- **WHEN** 用户在首页长按照片卡片（或点击操作按钮），在弹出的菜单中选择"收藏到文件夹"
- **THEN** 显示文件夹选择器（展示多层文件夹树），用户选择目标文件夹后确认，图片被收藏到该文件夹

#### Scenario: 从复习页添加图片到收藏夹
- **WHEN** 用户在复习页点击收藏按钮
- **THEN** 显示文件夹选择器（展示多层文件夹树），用户选择目标文件夹后确认，图片被收藏到该文件夹

#### Scenario: 同一图片可收藏到多个文件夹
- **WHEN** 用户将同一张图片添加到不同文件夹
- **THEN** 系统允许该操作，每张图片可以存在于多个文件夹中

#### Scenario: 重复收藏提示
- **WHEN** 用户尝试将已存在于某文件夹的图片再次添加到同一文件夹
- **THEN** 系统提示"该图片已在此文件夹中"，不做重复添加

### Requirement: 文件夹内容浏览
系统 SHALL 支持浏览文件夹内的子文件夹和已收藏图片。

#### Scenario: 查看文件夹内容
- **WHEN** 用户点击某个文件夹
- **THEN** 进入文件夹详情页，展示子文件夹列表（如有）和已收藏图片网格

#### Scenario: 返回上级目录
- **WHEN** 用户在子文件夹中点击返回按钮
- **THEN** 返回到上一级目录

#### Scenario: 从文件夹移除图片
- **WHEN** 用户在文件夹详情页长按照片，选择"取消收藏"
- **THEN** 弹出确认对话框，确认后该图片从当前文件夹中移除

### Requirement: 后端收藏夹 API
系统 SHALL 提供 RESTful API 支持收藏夹的增删改查操作。

#### Scenario: 创建文件夹
- **WHEN** 客户端 POST `/favorites/folders` 传入 `name` 和可选 `parent_id`
- **THEN** 服务端创建文件夹记录并返回 `{ folder_id, name, parent_id, created_at }`

#### Scenario: 获取文件夹列表
- **WHEN** 客户端 GET `/favorites/folders?parent_id=xxx`（不传则获取根目录）
- **THEN** 服务端返回该层级下的所有子文件夹列表

#### Scenario: 重命名文件夹
- **WHEN** 客户端 PUT `/favorites/folders/{folder_id}` 传入 `name`
- **THEN** 服务端更新文件夹名称

#### Scenario: 删除文件夹
- **WHEN** 客户端 DELETE `/favorites/folders/{folder_id}`
- **THEN** 服务端级联删除该文件夹、所有子孙文件夹及其中收藏项

#### Scenario: 添加收藏项
- **WHEN** 客户端 POST `/favorites/items` 传入 `folder_id` 和 `photo_id`
- **THEN** 服务端创建收藏记录（如已存在则返回 409）

#### Scenario: 获取文件夹内收藏图片列表
- **WHEN** 客户端 GET `/favorites/items?folder_id=xxx`
- **THEN** 服务端返回该文件夹内所有收藏图片的 `photo_id` 列表，并附带图片的缩略图 URL 和基本信息

#### Scenario: 移除收藏项
- **WHEN** 客户端 DELETE `/favorites/items` 传入 `folder_id` 和 `photo_id`
- **THEN** 服务端删除该收藏记录
