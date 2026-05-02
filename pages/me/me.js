const util = require('../../utils/util.js');

Page({
  data: {
    bodyData: null,
    targetData: null,
    strengthData: null,
    showHelpModal: false
  },

  onShow() {
    const bodyData = wx.getStorageSync('bodyData');
    const targetData = wx.getStorageSync('targetData');
    const strengthData = wx.getStorageSync('strengthData');
    
    if (bodyData && targetData) {
      this.setData({ 
        bodyData, 
        targetData, 
        strengthData,
        strengthLevel: strengthData ? strengthData.strengthLevel : { label: '未入门' }
      });
    }
  },

  reOnboarding() {
    wx.navigateTo({
      url: '/pages/input/input?edit=true'
    });
  },

  reTargeting() {
    wx.navigateTo({
      url: '/pages/target/target?edit=true'
    });
  },

  showHelp() {
    this.setData({ showHelpModal: true });
  },

  hideHelp() {
    this.setData({ showHelpModal: false });
  },

  stopBubble() {
    // 阻止冒泡
  },

  resetSystem() {
    wx.showModal({
      title: '极其重要',
      content: '此操作将清空所有训练进度、身体记录和力量数据，且不可恢复。确定重置吗？',
      confirmColor: '#f44336',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          // 重置后下次进入依然显示引导
          wx.setStorageSync('hasShownHelp', false);
          wx.reLaunch({
            url: '/pages/input/input'
          });
        }
      }
    });
  }
})