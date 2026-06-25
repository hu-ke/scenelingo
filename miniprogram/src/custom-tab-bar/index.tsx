import Taro from '@tarojs/taro';
import { View } from '@tarojs/components';
import './index.scss';

const CDN = 'https://scenelingo.oss-cn-hangzhou.aliyuncs.com/assets';

const TAB_LIST = [
  {
    pagePath: 'pages/home/index',
    text: '首页',
    icon: `${CDN}/home.png`,
  },
  {
    pagePath: 'pages/wordbook/index',
    text: '生词本',
    icon: `${CDN}/wordbook.png`,
  },
  {
    pagePath: 'pages/favorites/index',
    text: '收藏夹',
    icon: null,
  },
  {
    pagePath: 'pages/profile/index',
    text: '我的',
    icon: `${CDN}/mine.png`,
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
    <View className="custom-tab-bar">
      {TAB_LIST.map((tab) => {
        const isActive = currentPath === tab.pagePath;
        return (
          <View
            key={tab.pagePath}
            className={`custom-tab-bar-item ${isActive ? 'custom-tab-bar-item-active' : ''}`}
            onClick={() => handleSwitch(tab.pagePath)}
          >
            {tab.icon ? (
              <View
                className="custom-tab-bar-icon-img"
                style={{ backgroundImage: `url(${tab.icon})` }}
              />
            ) : (
              <View className="custom-tab-bar-icon-fav">⭐</View>
            )}
            <View className={`custom-tab-bar-text ${isActive ? 'custom-tab-bar-text-active' : ''}`}>
              {tab.text}
            </View>
          </View>
        );
      })}
    </View>
  );
}