# 修复 SMTP QQ邮箱 465 端口发送失败 & 环境变量配置 规格说明

## Why
当前 `send_email()` 函数对所有端口统一使用 `smtplib.SMTP()` + `starttls()` 方式连接，该方式仅适用于 **587 端口 (STARTTLS)**。QQ邮箱的 465 端口使用的是 **SSL 直连**，需要用 `smtplib.SMTP_SSL()` 连接。导致配置了正确的 QQ邮箱 SMTP 信息后，目标邮箱依然收不到验证码。同时用户需要将 SMTP 配置项填入 `.env` 文件使其生效。

## What Changes
- 根据 `SMTP_PORT` 自动选择 `SMTP_SSL`（465）或 `SMTP + STARTTLS`（587 等）
- 修复后正确发送验证码邮件到目标邮箱
- 将用户的 SMTP 配置写入 `backend/.env` 文件

## Impact
- Affected specs: email-auth-mongodb
- Affected code:
  - `backend/auth.py` — `send_email()` 函数连接逻辑
  - `backend/.env` — 填写 SMTP 配置项

---
## MODIFIED Requirements

### Requirement: SMTP 连接支持 465(SSL) 和 587(STARTTLS) 双模式
系统 SHALL 根据 `SMTP_PORT` 环境变量自动选择正确的 SMTP 连接方式：
- 当端口为 `465` 时，使用 `smtplib.SMTP_SSL()` 直接建立 SSL 连接
- 当端口为其他（如 `587`）时，使用 `smtplib.SMTP()` + `starttls()` 升级为加密连接

#### Scenario: QQ邮箱 465 端口发送成功
- **WHEN** SMTP 配置为 QQ邮箱（host: `smtp.qq.com`, port: `465`），用户点击"获取验证码"
- **THEN** 后端使用 `SMTP_SSL` 连接，邮件成功发送，目标邮箱收到验证码

#### Scenario: 587 端口发送仍然正常
- **WHEN** SMTP 配置为 587 端口（如 Outlook）
- **THEN** 后端使用 `SMTP + STARTTLS` 连接，邮件成功发送

### Requirement: SMTP 环境变量配置填入 .env
系统 SHALL 在 `backend/.env` 文件中包含完整的 SMTP 配置项并填写用户的真实值。

#### Scenario: .env 包含完整 SMTP 配置
- **WHEN** 后端启动
- **THEN** `os.environ.get("SMTP_HOST")` 等能读取到正确的值，验证码邮件正常发送
