# Checklist

- [x] 场景照片生成：`scene_skill.py` 能成功生成单张场景照片（非九宫格），prompt 要求尽可能多地包含典型物品
- [x] 场景照片调用 qwen-image-plus 生成，图片质量符合预期，背景色 #fef8ed
- [x] OSS 上传：场景照片上传到 `assets/scenes/{parent}/{child}.jpg` 路径
- [x] 场景识别：qwen3-vl-plus 能正确识别照片中的物品，返回 bbox 坐标和英文单词
- [x] 音标/例句补充：场景照片中物品自动补充 chinese、phonetic、examples
- [x] 场景重复避免：已存在的 scene_path 跳过生成
- [x] 场景种子脚本：机场（候机室、跑道、飞机内部、行李提取处）和学校（教室、操场、图书馆、食堂）共 8 个子场景
- [x] MongoDB `scene_grids` 集合索引创建正确
- [x] 场景树 API `/api/scene-grids/tree` 返回正确的层级结构
- [x] 场景详情 API `/api/scene-grids/detail` 返回完整数据含音标例句
- [x] 场景重新标注 API `/api/scene-grids/re-annotate` 正常工作
- [x] 场景单词搜索 API `/api/scene-grids/search` 返回关联场景
- [x] 小程序卡片识词页面双 Tab 正常显示：场景 Tab 在前，物体 Tab 在后
- [x] 两个 Tab 进入后默认展开第一项
- [x] 场景缩略图点击跳转到详情页，详情页正常展示 bbox 标注
- [x] 从场景详情页添加生词后，单词本和单词详情页正常显示关联场景