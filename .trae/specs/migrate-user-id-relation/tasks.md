# Tasks

- [x] Task 1: 修改 `db.py` 索引定义，将 `user_email` 索引改为 `user_id` 索引
  - 将 `photos` 集合的 3 个 `user_email` 索引改为 `user_id`
  - 将 `wordbooks` 集合的 `user_email` 索引改为 `user_id`

- [x] Task 2: 修改 `oss_client.py`，将 OSS 路径从 email 改为 user_id
  - `upload_photo()` 参数名和路径改为使用 `user_id`
  - `upload_metadata()` 参数名和路径改为使用 `user_id`
  - `list_user_photos()` 参数名和路径改为使用 `user_id`
  - `delete_photo()` 参数名和路径改为使用 `user_id`

- [x] Task 3: 修改 `auth.py`，添加 `get_user_id_by_email()` 辅助函数，修改所有 photo/wordbook 函数
  - 新增 `get_user_id_by_email(email)` 辅助函数
  - 修改 `get_user_wordbook(user_email)` → `get_user_wordbook(user_id)`，查询条件改为 `user_id`
  - 修改 `sync_user_wordbook(user_email, words)` → `sync_user_wordbook(user_id, words)`，upsert 条件改为 `user_id`
  - 修改 `add_wordbook_word(user_email, word)` → `add_wordbook_word(user_id, word)`，查询条件改为 `user_id`
  - 修改 `remove_wordbook_word(user_email, word)` → `remove_wordbook_word(user_id, word)`，查询条件改为 `user_id`
  - 修改 `save_photo_record(user_email, photo_id, metadata)` → `save_photo_record(user_id, photo_id, metadata)`，存储字段和 OSS URL 使用 `user_id`
  - 修改 `save_pending_photo_record(user_email, photo_id)` → `save_pending_photo_record(user_id, photo_id)`，存储字段和 OSS URL 使用 `user_id`
  - 修改 `list_user_photos_mongo(user_email, ...)` → `list_user_photos_mongo(user_id, ...)`，查询条件改为 `user_id`
  - 修改 `delete_photo_record(user_email, photo_id)` → `delete_photo_record(user_id, photo_id)`，删除条件改为 `user_id`
  - `claim_pending_photo()` 中的日志输出从 `user_email` 改为 `user_id`
  - `complete_photo()`、`set_annotated_url()`、`reset_photo_to_pending()` 无需修改（不涉及 user 字段）

- [x] Task 4: 修改 `main.py`，在调用 oss_client 和 auth 函数前解析 email → user_id
  - 修改 `upload_photos` 端点：调用 `get_user_id_by_email(email)` 后传入 oss_client 和 auth 函数
  - 修改 `upload_pending` 端点：同上
  - 修改 `upload_annotated` 端点：同上，OSS URL 构造使用 `user_id`
  - 修改 `list_photos` 端点：同上
  - 修改 `delete_photos` 端点：同上
  - 修改 `list_wordbook` 端点：同上
  - 修改 `sync_wordbook` 端点：同上
  - 修改 `add_to_wordbook` 端点：同上
  - 修改 `remove_from_wordbook` 端点：同上

- [x] Task 5: 修改 `worker.py`，适配新的 user_id 字段
  - 从 photo 文档读取 `user_id` 字段
  - 通过 users 表按 `_id` 查找获取 email
  - 用 email 调用 `get_user_language()`

# Task Dependencies
- Task 3 依赖 Task 2（auth.py 中 photo 函数使用了 oss_client 的路径逻辑，但 auth.py 中 OSS URL 是直接拼接的，不调用 oss_client，所以实际上无硬依赖）
- Task 4 依赖 Task 2 和 Task 3（main.py 调用 oss_client 和 auth 的函数签名变更）
- Task 5 依赖 Task 3（worker.py 调用 auth 的函数签名变更）
- Task 1 独立，可与其他任务并行
