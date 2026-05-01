App({
  onLaunch() {
    // 离线存储初始化，不做任何网络请求
    console.log('健力塑身已启动');
  },
  globalData: {
    // 存储身材数据
    bodyData: null,
    // 存储目标数据
    targetData: null,
    // 存储力量推算
    strengthData: null
  }
})