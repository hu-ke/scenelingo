import Taro from '@tarojs/taro';
import { CoverView } from '@tarojs/components';
import './index.scss';

const TAB_LIST = [
  {
    pagePath: 'pages/home/index',
    text: '首页',
    icon: '🏠',
  },
  {
    pagePath: 'pages/wordbook/index',
    text: '生词本',
    icon: '📖',
  },
  {
    pagePath: 'pages/favorites/index',
    text: '收藏夹',
    icon: '⭐',
  },
  {
    pagePath: 'pages/profile/index',
    text: '我的',
    icon: '👤',
  },
];

export default function CustomTabBar() {
  const currentPath = Taro.getCurrentPages().length
    ? Taro.getCurrentPages()[Taro.getCurrentPages().length - 1]?.route || ''
    : '';

  const handleSwitch = (pagePath: string) => {
    if (pagePath === currentPath) return;
    Taro.switchTab({ url: `/${pagePath}` });
  };

  return (
    <CoverView className="custom-tab-bar">
      {TAB_LIST.map((tab) => {
        const isActive = currentPath === tab.pagePath;
        return (
          <CoverView
            key={tab.pagePath}
            className={`custom-tab-bar-item ${isActive ? 'custom-tab-bar-item-active' : ''}`}
            onClick={() => handleSwitch(tab.pagePath)}
          >
            <CoverView className="custom-tab-bar-icon">{tab.icon}</CoverView>
            <CoverView className={`custom-tab-bar-text ${isActive ? 'custom-tab-bar-text-active' : ''}`}>
              {tab.text}
            </CoverView>
          </CoverView>
        );
      })}
    </CoverView>
  );
}