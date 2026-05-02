App({
  onLaunch() {
    // 离线存储初始化，不做任何网络请求
    console.log('健力塑身已启动');

    // 启动自检逻辑：检查是否已经完成身体录入和目标规划
    const bodyData = wx.getStorageSync('bodyData');
    const targetData = wx.getStorageSync('targetData');

    if (!bodyData || !targetData) {
      // 如果没有数据，强制跳转到初始录入页（前置引导）
      wx.reLaunch({
        url: '/pages/input/input'
      });
    }
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