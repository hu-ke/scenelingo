import { useCallback } from 'react';
import Taro from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import './index.scss';

export default function ProfilePage() {
  const themeStyle = useTheme();
  const { state: authState } = useAuth();

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