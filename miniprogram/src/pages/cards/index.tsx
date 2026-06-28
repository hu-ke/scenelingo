import { useState, useEffect, useCallback } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Image } from '@tarojs/components';
import './index.scss';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8022/scenelingo-service';

type TabType = 'scenes' | 'objects';

interface TreeNode {
  name: string;
  path: string[];
  children: TreeNode[];
  grids?: GridRecord[];
  scenes?: SceneRecord[];
}

interface GridRecord {
  grid_index: number;
  image_url: string;
  thumbnail_url: string;
  oss_key: string;
  word_count: number;
  words: WordItem[];
}

interface SceneRecord {
  image_url: string;
  thumbnail_url: string;
  oss_key: string;
  word_count: number;
  words: WordItem[];
}

interface WordItem {
  word: string;
  row?: number;
  col?: number;
}

export default function CardsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('scenes');
  const [sceneTree, setSceneTree] = useState<TreeNode[]>([]);
  const [objectTree, setObjectTree] = useState<TreeNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchTree = useCallback(async (tab: TabType) => {
    try {
      setLoading(true);
      const endpoint = tab === 'scenes' ? '/api/scene-grids/tree' : '/api/category-grids/tree';
      const res = await Taro.request({
        url: `${BASE_URL}${endpoint}`,
        method: 'GET',
      });
      if (res.statusCode === 200) {
        const data = res.data as { scenes?: TreeNode[]; categories?: TreeNode[] };
        const tree = tab === 'scenes' ? (data.scenes || []) : (data.categories || []);
        if (tab === 'scenes') {
          setSceneTree(tree);
        } else {
          setObjectTree(tree);
        }
        // Auto-expand first item
        if (tree.length > 0) {
          const firstKey = tree[0].path.join('/');
          setExpandedPaths(prev => {
            const next = new Set(prev);
            next.add(firstKey);
            return next;
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch tree:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTree(activeTab);
  }, [activeTab, fetchTree]);

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

  const renderSceneCards = (scenes: SceneRecord[], scenePath: string[]) => {
    const pathStr = encodeURIComponent(scenePath.join(','));
    return (
      <View className="category-grids">
        {scenes.map((scene, idx) => (
          <View
            key={idx}
            className="grid-card"
            onClick={() => {
              Taro.navigateTo({
                url: `/pages/card-detail/index?type=scene&scene_path=${pathStr}`,
              });
            }}
          >
            <Image
              className="grid-thumbnail"
              src={scene.thumbnail_url || scene.image_url}
              mode="widthFix"
            />
            <View className="grid-thumb-info">
              <Text className="grid-thumb-label">共 {scene.word_count} 个词汇</Text>
              <View className="grid-thumb-words">
                {scene.words.slice(0, 4).map((w, idx2) => (
                  <Text key={idx2} className="thumb-word-tag">{w.word}</Text>
                ))}
                {scene.words.length > 4 && (
                  <Text className="thumb-word-more">+{scene.words.length - 4}</Text>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderObjectGrids = (grids: GridRecord[], categoryPath: string[]) => {
    const pathStr = encodeURIComponent(categoryPath.join(','));
    return (
      <View className="category-grids">
        {grids.map((grid) => (
          <View
            key={grid.grid_index}
            className="grid-card"
            onClick={() => {
              Taro.navigateTo({
                url: `/pages/card-detail/index?type=object&category_path=${pathStr}&grid_index=${grid.grid_index}`,
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

  const renderNode = (node: TreeNode, depth: number) => {
    const pathKey = pathToKey(node.path);
    const isExpanded = expandedPaths.has(pathKey);
    const hasChildren = node.children && node.children.length > 0;
    const hasGrids = node.grids && node.grids.length > 0;
    const hasScenes = node.scenes && node.scenes.length > 0;
    const hasContent = hasGrids || hasScenes;

    return (
      <View key={pathKey} className="category-node">
        <View
          className="category-node-header"
          style={{ paddingLeft: `${20 + depth * 40}rpx` }}
          onClick={() => toggleExpand(pathKey)}
        >
          {(hasChildren || hasContent) && (
            <View className={`category-node-arrow ${isExpanded ? 'expanded' : ''}`}>
              <Text>▶</Text>
            </View>
          )}
          {!hasChildren && !hasContent && <View className="category-node-arrow" />}
          <Text className="category-node-name">{node.name}</Text>
        </View>
        {isExpanded && hasChildren && (
          <View className="category-node-children">
            {node.children.map(child => renderNode(child, depth + 1))}
          </View>
        )}
        {isExpanded && hasScenes && renderSceneCards(node.scenes, node.path)}
        {isExpanded && hasGrids && renderObjectGrids(node.grids, node.path)}
      </View>
    );
  };

  const currentTree = activeTab === 'scenes' ? sceneTree : objectTree;

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

      {/* Tab bar */}
      <View className="cards-tabs">
        <View
          className={`cards-tab ${activeTab === 'scenes' ? 'active' : ''}`}
          onClick={() => setActiveTab('scenes')}
        >
          <Text>场景</Text>
        </View>
        <View
          className={`cards-tab ${activeTab === 'objects' ? 'active' : ''}`}
          onClick={() => setActiveTab('objects')}
        >
          <Text>物体</Text>
        </View>
      </View>

      {currentTree.length === 0 ? (
        <View className="cards-empty">暂无数据</View>
      ) : (
        <View className="category-tree">
          {currentTree.map(node => renderNode(node, 0))}
        </View>
      )}
    </View>
  );
}