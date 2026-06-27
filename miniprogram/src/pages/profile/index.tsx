import { useCallback, useState, useEffect } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { View, Text, Image } from '@tarojs/components';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../utils/api';
import './index.scss';

const CDN = 'https://scenelingo.oss-cn-hangzhou.aliyuncs.com/assets/mine';

export default function ProfilePage() {
  const themeStyle = useTheme();
  const { state: authState } = useAuth();
  const [quota, setQuota] = useState<number | null>(null);
  const [rewardQuota, setRewardQuota] = useState(10);

  useEffect(() => {
    api.getUserQuota().then(res => setQuota(res.quota)).catch(() => {});
    api.getShareRewardInfo().then(res => setRewardQuota(res.reward_quota)).catch(() => {});
  }, []);

  useDidShow(() => {
    api.getUserQuota().then(res => setQuota(res.quota)).catch(() => {});
  });

  const handleQuota = useCallback(() => {
    Taro.showModal({
      title: '剩余识别次数',
      content: `当前剩余 ${quota ?? '--'} 次识别机会\n\n分享首页给好友，好友通过你的分享进入小程序，你即可获得 ${rewardQuota} 次识别机会！`,
      showCancel: false,
      confirmText: '知道了',
    });
  }, [quota, rewardQuota]);

  const handleLanguage = useCallback(() => {
    Taro.navigateTo({ url: '/pages/settings/index' });
  }, []);

  const handleFeedback = useCallback(() => {
    Taro.setClipboardData({ data: '403392669@qq.com' }).then(() => {
      Taro.showModal({
        title: '意见反馈',
        content: '作者邮箱：403392669@qq.com\n已复制到剪贴板',
        showCancel: false,
        confirmText: '知道了',
      });
    }).catch(() => {
      Taro.showModal({
        title: '意见反馈',
        content: '作者邮箱：403392669@qq.com\n请通过此邮箱联系作者',
        showCancel: false,
        confirmText: '知道了',
      });
    });
  }, []);

  const handleUserAgreement = useCallback(() => {
    Taro.navigateTo({ url: '/pages/user-agreement/index' });
  }, []);

  const handlePrivacyPolicy = useCallback(() => {
    Taro.navigateTo({ url: '/pages/privacy-policy/index' });
  }, []);

  return (
    <View
      className="profile-page"
      style={{ ...themeStyle, backgroundImage: `url(${CDN}/background.png)` }}
    >
      {/* 用户信息 — 直接置于背景图上，无白底 */}
      <View className="profile-header">
        <View className="profile-avatar">
          <Text className="profile-avatar-text">👤</Text>
        </View>
        <View className="profile-info">
          <Text className="profile-nickname">
            {authState.isLoggedIn && authState.userInfo?.nickName
              ? authState.userInfo.nickName
              : '场景外语用户'}
          </Text>
          <Text className="profile-subtitle">记录每一个语言探索的瞬间</Text>
        </View>
      </View>

      {/* 菜单列表 — 所有项合并在一个卡片中，项之间无间隔 */}
      <View className="profile-menu">
        <View className="profile-menu-item" onClick={handleQuota}>
          <View className="profile-menu-item-left">
            <Image className="profile-menu-item-icon" src={`${CDN}/camera.png`} mode="aspectFit" />
            <Text className="profile-menu-item-text">剩余识别次数</Text>
          </View>
          <View className="profile-menu-item-right">
            <Text className="profile-menu-item-value">{quota !== null ? quota : '...'}</Text>
            <Text className="profile-menu-item-arrow">›</Text>
          </View>
        </View>

        <View className="profile-menu-item" onClick={handleLanguage}>
          <View className="profile-menu-item-left">
            <Image className="profile-menu-item-icon" src={`${CDN}/globe.png`} mode="aspectFit" />
            <Text className="profile-menu-item-text">语言&主题色</Text>
          </View>
          <View className="profile-menu-item-right">
            <Text className="profile-menu-item-arrow">›</Text>
          </View>
        </View>

        <View className="profile-menu-item" onClick={handleFeedback}>
          <View className="profile-menu-item-left">
            <Image className="profile-menu-item-icon" src={`${CDN}/feedback.png`} mode="aspectFit" />
            <Text className="profile-menu-item-text">意见反馈</Text>
          </View>
          <View className="profile-menu-item-right">
            <Text className="profile-menu-item-arrow">›</Text>
          </View>
        </View>

        <View className="profile-menu-item" onClick={handleUserAgreement}>
          <View className="profile-menu-item-left">
            <Image className="profile-menu-item-icon" src={`${CDN}/agreement.png`} mode="aspectFit" />
            <Text className="profile-menu-item-text">用户协议</Text>
          </View>
          <View className="profile-menu-item-right">
            <Text className="profile-menu-item-arrow">›</Text>
          </View>
        </View>

        <View className="profile-menu-item" onClick={handlePrivacyPolicy}>
          <View className="profile-menu-item-left">
            <Image className="profile-menu-item-icon" src={`${CDN}/lock.png`} mode="aspectFit" />
            <Text className="profile-menu-item-text">隐私政策</Text>
          </View>
          <View className="profile-menu-item-right">
            <Text className="profile-menu-item-arrow">›</Text>
          </View>
        </View>
      </View>

      {/* 底部版本信息 */}
      <View className="profile-footer">
        <Text className="profile-footer-text">场景外语 v1.0.0</Text>
      </View>
    </View>
  );
}
