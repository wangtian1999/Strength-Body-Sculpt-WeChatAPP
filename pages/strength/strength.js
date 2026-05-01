const util = require('../../utils/util.js');

Page({
  data: {
    bodyData: null,
    targetData: null,
    levels: ['新手', '初级', '中级', '高级'],
    estimatedSBD: { squat: 0, bench: 0, deadlift: 0 },
    strengthLevel: { label: '未入门', class: 'untrained' },
    wilksScore: 0,
    startRange: {
      squatMin: 0, squatMax: 0,
      benchMin: 0, benchMax: 0,
      deadliftMin: 0, deadliftMax: 0
    }
  },

  onShow() {
    const bodyData = wx.getStorageSync('bodyData');
    const targetData = wx.getStorageSync('targetData');
    
    if (!bodyData || !targetData) {
      wx.showModal({
        title: '提示',
        content: '请先完成前两步录入',
        showCancel: false,
        success: () => {
          wx.switchTab({ url: '/pages/input/input' });
        }
      });
      return;
    }

    this.setData({ bodyData, targetData });
    this.calculateStrength();
  },

  calculateStrength() {
    const { bodyData, targetData } = this.data;
    const levelKey = targetData.levelIndex <= 1 ? 'beginner' : 'intermediate';
    
    const sbd = util.estimateSBD(bodyData.gender, bodyData.weight, levelKey);
    const total = sbd.squat + sbd.bench + sbd.deadlift;
    const strengthLevel = util.getStrengthLevel(bodyData.gender, bodyData.weight, total);
    const wilksScore = util.calculateWilks(bodyData.gender, bodyData.weight, total);
    
    // 起步重量建议 (5x5 训练重量通常为 1RM 的 60% - 70%)
    const startRange = {
      squatMin: Math.round(sbd.squat * 0.6),
      squatMax: Math.round(sbd.squat * 0.75),
      benchMin: Math.round(sbd.bench * 0.6),
      benchMax: Math.round(sbd.bench * 0.75),
      deadliftMin: Math.round(sbd.deadlift * 0.6),
      deadliftMax: Math.round(sbd.deadlift * 0.75)
    };

    this.setData({
      estimatedSBD: sbd,
      strengthLevel,
      wilksScore,
      startRange
    });
  },

  onWeightAdj(e) {
    const key = e.currentTarget.dataset.key;
    const val = e.detail.value;
    const startRange = this.data.startRange;
    startRange[key] = val;
    this.setData({ startRange });
  },

  saveAndNext() {
    const { estimatedSBD, startRange } = this.data;
    wx.setStorageSync('strengthData', { estimatedSBD, startRange });
    wx.switchTab({
      url: '/pages/plan/plan'
    });
  }
})