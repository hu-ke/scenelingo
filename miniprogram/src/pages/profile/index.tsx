import { useCallback, useState, useEffect } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../utils/api';
import './index.scss';

export default function ProfilePage() {
  const themeStyle = useTheme();
  const { state: authState } = useAuth();
  const [quota, setQuota] = useState<number | null>(null);
  const [rewardQuota, setRewardQuota] = useState(10);

  useEffect(() => {
    api.getUserQuota().then(res => setQuota(res.quota)).catch(() => {});
    api.getShareRewardInfo().then(res => setRewardQuota(res.reward_quota)).catch(() => {});
  }, []);

  // 每次切到"我的"页面时刷新识别次数
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
    <View className="profile-page" style={themeStyle}>
      {/* 用户信息区域 */}
      <View className="profile-header">
        <View className="profile-avatar">
          <Text className="profile-avatar-icon">👤</Text>
        </View>
        <Text className="profile-nickname">
          {authState.isLoggedIn && authState.userInfo?.nickName
            ? authState.userInfo.nickName
            : '场景外语用户'}
        </Text>
      </View>

      {/* 菜单区域 */}
      <View className="profile-menu">
        <View className="profile-menu-item" onClick={handleQuota}>
          <View className="profile-menu-item-left">
            <Text className="profile-menu-item-icon">📸</Text>
            <Text className="profile-menu-item-text">剩余识别次数</Text>
          </View>
          <Text className="profile-menu-item-arrow">{quota !== null ? quota : '...'} ›</Text>
        </View>

        <View className="profile-menu-item" onClick={handleLanguage}>
          <View className="profile-menu-item-left">
            <Text className="profile-menu-item-icon">🌐</Text>
            <Text className="profile-menu-item-text">语言&主题色</Text>
          </View>
          <Text className="profile-menu-item-arrow">›</Text>
        </View>

        <View className="profile-menu-item" onClick={handleFeedback}>
          <View className="profile-menu-item-left">
            <Text className="profile-menu-item-icon">💬</Text>
            <Text className="profile-menu-item-text">意见反馈</Text>
          </View>
          <Text className="profile-menu-item-arrow">›</Text>
        </View>

        <View className="profile-menu-item" onClick={handleUserAgreement}>
          <View className="profile-menu-item-left">
            <Text className="profile-menu-item-icon">📄</Text>
            <Text className="profile-menu-item-text">用户协议</Text>
          </View>
          <Text className="profile-menu-item-arrow">›</Text>
        </View>

        <View className="profile-menu-item" onClick={handlePrivacyPolicy}>
          <View className="profile-menu-item-left">
            <Text className="profile-menu-item-icon">🔒</Text>
            <Text className="profile-menu-item-text">隐私政策</Text>
          </View>
          <Text className="profile-menu-item-arrow">›</Text>
        </View>
      </View>

      <View className="profile-footer">
        <Text className="profile-footer-text">场景外语 v1.0.0</Text>
      </View>
    </View>
  );
}