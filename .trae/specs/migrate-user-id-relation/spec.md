# 数据库关联迁移：user_email → user_id

## Why
将 `photos` 和 `wordbooks` 表与 `users` 表的关联关系从 `user_email` 字符串改为 `users._id` 主键，同时将阿里云 OSS 文件夹路径从 `user_email` 目录改为 `user_id` 目录。用户已在数据库中为 `photos` 和 `wordbooks` 表手动添加了 `user_id` 字段并填好了值，OSS 文件夹也已重命名为 `user_id`。

## What Changes
- `db.py`: 将 `photos` 和 `wordbooks` 集合的索引从 `user_email` 改为 `user_id`
- `auth.py`: 所有 photo 和 wordbook 相关函数的参数从 `user_email` 改为使用 `user_id`，新增 `get_user_id_by_email()` 辅助函数
- `oss_client.py`: OSS 路径从 `photos/{email}/` 改为 `photos/{user_id}/`
- `main.py`: API 端点中调用 oss_client 和 auth 函数前，通过 email 解析出 `user_id` 再传入
- `worker.py`: 从 photo 文档读取 `user_id`，查询用户 email 后再调用语言偏好相关函数

## Impact
- Affected specs: scene-english-learning, email-auth-mongodb, login-oss-storage, async-recognition-worker, wordbook-mastered-categories
- Affected code: `backend/db.py`, `backend/auth.py`, `backend/oss_client.py`, `backend/main.py`, `backend/worker.py`
- Miniprogram: 无需修改（API 接口和 JWT 认证流程不变）

## ADDED Requirements

### Requirement: user_id 辅助查询函数
系统 SHALL 提供 `get_user_id_by_email(email)` 函数，通过 email 查找 users 表返回 `_id`。

#### Scenario: 通过 email 获取 user_id
- **WHEN** 传入一个已注册用户的 email
- **THEN** 返回该用户在 users 表中对应的 `_id` 值

#### Scenario: email 对应的用户不存在
- **WHEN** 传入一个未注册的 email
- **THEN** 返回 None

### Requirement: OSS 路径使用 user_id
`oss_client.py` 中所有 OSS 操作（upload_photo, upload_metadata, list_user_photos, delete_photo）SHALL 使用 `user_id` 作为 OSS 路径前缀 `photos/{user_id}/`。

#### Scenario: 上传照片到 OSS
- **WHEN** 调用 `upload_photo(user_id, photo_id, file_data, filename)`
- **THEN** 照片上传到 OSS 路径 `photos/{user_id}/{photo_id}/{filename}`

#### Scenario: 列出用户照片
- **WHEN** 调用 `list_user_photos(user_id)`
- **THEN** 列出 OSS 路径 `photos/{user_id}/` 下的所有照片元数据

## MODIFIED Requirements

### Requirement: Photo 数据库操作使用 user_id
`auth.py` 中所有 photo 相关函数（save_photo_record, save_pending_photo_record, list_user_photos_mongo, delete_photo_record）SHALL 使用 `user_id` 作为 MongoDB 查询条件和存储字段，而非 `user_email`。

#### Scenario: 保存照片记录
- **WHEN** 调用 `save_photo_record(user_id, photo_id, metadata)`
- **THEN** 在 photos 集合中插入文档，包含 `user_id` 字段（而非 `user_email`），OSS URL 路径使用 `user_id`

#### Scenario: 查询用户照片列表
- **WHEN** 调用 `list_user_photos_mongo(user_id, start_date, end_date)`
- **THEN** 按 `user_id` 查询 photos 集合，返回该用户的所有照片

#### Scenario: 删除照片记录
- **WHEN** 调用 `delete_photo_record(user_id, photo_id)`
- **THEN** 按 `user_id` 和 `photo_id` 从 photos 集合中删除对应文档

### Requirement: Wordbook 数据库操作使用 user_id
`auth.py` 中所有 wordbook 相关函数（get_user_wordbook, sync_user_wordbook, add_wordbook_word, remove_wordbook_word）SHALL 使用 `user_id` 作为 MongoDB 查询条件，而非 `user_email`。

#### Scenario: 获取生词本
- **WHEN** 调用 `get_user_wordbook(user_id)`
- **THEN** 在 wordbooks 集合中按 `user_id` 查询并返回单词列表

#### Scenario: 同步生词本
- **WHEN** 调用 `sync_user_wordbook(user_id, words)`
- **THEN** 在 wordbooks 集合中按 `user_id` 进行 upsert 操作

### Requirement: MongoDB 索引使用 user_id
`db.py` 中 `init_db()` 函数 SHALL 为 `photos` 和 `wordbooks` 集合创建基于 `user_id` 的索引，替代原有的 `user_email` 索引。

#### Scenario: 初始化数据库索引
- **WHEN** 应用启动调用 `init_db()`
- **THEN** photos 集合创建 `user_id` 索引，wordbooks 集合创建 `user_id` 唯一索引

### Requirement: Worker 适配 user_id
`worker.py` SHALL 从 photo 文档中读取 `user_id` 字段，通过查找 users 表获取 email 后再调用 `get_user_language()`。

#### Scenario: Worker 处理待处理照片
- **WHEN** Worker 从 photos 集合认领一条待处理文档
- **THEN** 从文档中读取 `user_id`，通过 users 表查找对应 email，再用 email 获取用户语言偏好

## REMOVED Requirements
无
