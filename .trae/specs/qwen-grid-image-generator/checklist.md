# Checklist

- [x] 脚本文件 `backend/scripts/generate_grids.py` 存在且可导入
- [x] 命令行参数解析正确：`category` 必填，`--num-grids`、`--output-dir`、`--cell-size` 可选且有默认值
- [x] `generate_item_list()` 能正确调用 qwen-plus 模型并返回指定数量的不重复物品名称
- [x] `generate_single_image()` 能通过 DashScope REST API 调用 qwen-image-plus 生成单品图片
- [x] 图片生成失败时执行最多 3 次重试，间隔逐次递增
- [x] `stitch_grid()` 能将 9 张单品图拼接为 3×3 九宫格，包含 4px 间距
- [x] 单品图不足 9 张时，空位用白色占位填充
- [x] 最终输出文件命名为 `{category}_grid{n}_{timestamp}.jpg`，保存到正确目录
- [x] 日志输出包含物品列表、图片生成进度、拼接完成、总耗时
- [x] 支持通过环境变量 `DASHSCOPE_API_KEY` 获取 API 密钥（与现有项目一致）
