export default {
  pages: [
    'pages/home/index',
    'pages/login/index',
    'pages/review/index',
    'pages/merge/index',
    'pages/wordbook/index',
    'pages/worddetail/index',
    'pages/settings/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#4A90D9',
    navigationBarTitleText: '场景外语',
    navigationBarTextStyle: 'white',
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