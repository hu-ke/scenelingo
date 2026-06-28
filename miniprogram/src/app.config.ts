export default {
  pages: [
    'pages/home/index',
    'pages/review/index',
    'pages/merge/index',
    'pages/wordbook/index',
    'pages/worddetail/index',
    'pages/favorites/index',
    'pages/favorites/folder',
    'pages/cards/index',
    'pages/card-detail/index',
    'pages/settings/index',
    'pages/profile/index',
    'pages/user-agreement/index',
    'pages/privacy-policy/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#4A90D9',
    navigationBarTitleText: '场景外语',
    navigationBarTextStyle: 'white',
  },
  tabBar: {
    custom: true,
    color: '#A0AFBF',
    selectedColor: '#4A90D9',
    backgroundColor: '#FFFFFF',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
      },
      {
        pagePath: 'pages/wordbook/index',
        text: '生词本',
      },
      {
        pagePath: 'pages/favorites/index',
        text: '收藏夹',
      },
      {
        pagePath: 'pages/cards/index',
        text: '卡片识词',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
      },
    ],
  },
  permission: {
    'scope.camera': {
      desc: '需要使用摄像头拍摄照片来识别物体学习英语',
    },
    'scope.writePhotosAlbum': {
      desc: '需要保存标注图片到相册',
    },
  },
};