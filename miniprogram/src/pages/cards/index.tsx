import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Image } from '@tarojs/components';
import './index.scss';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8022/scenelingo-service';

interface CategoryNode {
  name: string;
  path: string[];
  children: CategoryNode[];
  grids?: GridRecord[];
}

interface GridRecord {
  grid_index: number;
  image_url: string;
  thumbnail_url: string;
  oss_key: string;
  word_count: number;
  words: WordItem[];
}

interface WordItem {
  word: string;
  row: number;
  col: number;
}

export default function CardsPage() {
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategoryTree();
  }, []);

  const fetchCategoryTree = async () => {
    try {
      setLoading(true);
      const res = await Taro.request({
        url: `${BASE_URL}/api/category-grids/tree`,
        method: 'GET',
      });
      if (res.statusCode === 200) {
        const data = res.data as { categories: CategoryNode[] };
        setTree(data.categories || []);
      }
    } catch (err) {
      console.error('Failed to fetch category tree:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (pathKey: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(pathKey)) {
        next.delete(pathKey);
      } else {
        next.add(pathKey);
      }
      return next;
    });
  };

  const pathToKey = (path: string[]) => path.join('/');

  const renderGrids = (grids: GridRecord[], categoryPath: string[]) => {
    const pathStr = encodeURIComponent(categoryPath.join(','));
    return (
      <View className="category-grids">
        {grids.map((grid) => (
          <View
            key={grid.grid_index}
            className="grid-card"
            onClick={() => {
              Taro.navigateTo({
                url: `/pages/card-detail/index?category_path=${pathStr}&grid_index=${grid.grid_index}`,
              });
            }}
          >
            <Image
              className="grid-thumbnail"
              src={grid.thumbnail_url || grid.image_url}
              mode="widthFix"
            />
            <View className="grid-thumb-info">
              <Text className="grid-thumb-label">共 {grid.word_count} 个词汇</Text>
              <View className="grid-thumb-words">
                {grid.words.slice(0, 4).map((w, idx) => (
                  <Text key={idx} className="thumb-word-tag">{w.word}</Text>
                ))}
                {grid.words.length > 4 && (
                  <Text className="thumb-word-more">+{grid.words.length - 4}</Text>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderNode = (node: CategoryNode, depth: number) => {
    const pathKey = pathToKey(node.path);
    const isExpanded = expandedPaths.has(pathKey);
    const hasChildren = node.children && node.children.length > 0;
    const hasGrids = node.grids && node.grids.length > 0;

    return (
      <View key={pathKey} className="category-node">
        <View
          className="category-node-header"
          style={{ paddingLeft: `${20 + depth * 40}rpx` }}
          onClick={() => toggleExpand(pathKey)}
        >
          {(hasChildren || hasGrids) && (
            <View className={`category-node-arrow ${isExpanded ? 'expanded' : ''}`}>
              <Text>▶</Text>
            </View>
          )}
          {!hasChildren && !hasGrids && <View className="category-node-arrow" />}
          <Text className="category-node-name">{node.name}</Text>
        </View>
        {isExpanded && hasChildren && (
          <View className="category-node-children">
            {node.children.map(child => renderNode(child, depth + 1))}
          </View>
        )}
        {isExpanded && hasGrids && renderGrids(node.grids, node.path)}
      </View>
    );
  };

  if (loading) {
    return (
      <View className="cards-page">
        <View className="cards-loading">加载中...</View>
      </View>
    );
  }

  return (
    <View className="cards-page">
      <View className="cards-header">卡片识词</View>
      {tree.length === 0 ? (
        <View className="cards-empty">暂无类目数据</View>
      ) : (
        <View className="category-tree">
          {tree.map(node => renderNode(node, 0))}
        </View>
      )}
    </View>
  );
}