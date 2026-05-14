# Tasks

- [x] Task 1: 修复 `auth.py` 中 `send_email()` 函数，根据端口选择 SMTP_SSL 或 SMTP+STARTTLS 连接方式
  - 端口为 465 时使用 `smtplib.SMTP_SSL()`
  - 端口为其他时保持 `smtplib.SMTP()` + `starttls()`

- [x] Task 2: 将用户的 SMTP 配置写入 `backend/.env` 文件
  - SMTP_HOST=smtp.qq.com
  - SMTP_PORT=465
  - SMTP_USER=403392669@qq.com
  - SMTP_PASSWORD=ryykahdurufqcaad
  - SMTP_FROM=403392669@qq.com

# Task Dependencies
- 无依赖，两个任务可并行执行
