const util = require('../../utils/util.js');

Page({
  data: {
    isSimpleMode: true, // 默认简单版
    gender: 'male',
    age: 25,
    height: 175,
    weight: 70,
    bodyFat: 15,
    bmi: 0,
    bmr: 0,
    tdee: 0,
    lbm: 0,
    showBFRef: false, // 是否显示体脂参考图
    showHelpModal: false, // 是否显示使用说明
    levels: ['新手 (0-6个月)', '初级 (6-12个月)', '中级 (1-2年)', '高级 (2年以上)'],
    levelIndex: 0,

    // 简单版选择配置
    ranges: {
      age: [
        { label: '18-24', value: 21 },
        { label: '25-34', value: 30 },
        { label: '35-44', value: 40 },
        { label: '45-54', value: 50 },
        { label: '55+', value: 60 }
      ],
      height: [
        { label: '<160', value: 155 },
        { label: '160-170', value: 165 },
        { label: '170-180', value: 175 },
        { label: '180-190', value: 185 },
        { label: '>190', value: 195 }
      ],
      weight: [
        { label: '<55', value: 50 },
        { label: '55-65', value: 60 },
        { label: '65-75', value: 70 },
        { label: '75-85', value: 80 },
        { label: '85-95', value: 90 },
        { label: '>95', value: 105 }
      ],
      fat: [
        { label: '偏瘦', value: 10, male: '男: 8-12% 极低体脂', female: '女: 15-18% 纤细/紧致' },
        { label: '匀称', value: 15, male: '男: 13-16% 腹肌隐现', female: '女: 19-22% 平坦/匀称' },
        { label: '标准', value: 20, male: '男: 17-21% 正常/健康', female: '女: 23-27% 曲线/标准' },
        { label: '饱满', value: 28, male: '男: 22-26% 稍有赘肉', female: '女: 28-32% 丰满/圆润' },
        { label: '偏胖', value: 35, male: '男: 27%+ 腹部堆积', female: '女: 33%+ 偏胖/丰满' }
      ]
    },
    // 当前简单版选中的索引
    selectedIndices: {
      age: 1,
      height: 2,
      weight: 2,
      fat: 1
    },
    // 5.0 力量推算数据 (合并至录入页)
    estimatedSBD: { squat: 0, bench: 0, deadlift: 0 },
    strengthLevel: { label: '未入门', class: 'untrained' },
    startRange: {
      squatMin: 0, squatMax: 0,
      benchMin: 0, benchMax: 0,
      deadliftMin: 0, deadliftMax: 0
    }
  },

  onLoad() {
    const bodyData = wx.getStorageSync('bodyData');
    const strengthData = wx.getStorageSync('strengthData');
    
    if (bodyData) {
      this.setData(bodyData);
    }
    
    if (strengthData) {
      this.setData({
        levelIndex: strengthData.levelIndex || 0,
        startRange: strengthData.startRange || this.data.startRange
      });
    }

    if (!bodyData && !strengthData) {
      this.calculateResults();
    }

    // 统一首次进入引导逻辑
    const hasShownHelp = wx.getStorageSync('hasShownHelp');
    if (!hasShownHelp) {
      this.setData({ showHelpModal: true });
      wx.setStorageSync('hasShownHelp', true);
    }
  },

  toggleMode() {
    this.setData({ isSimpleMode: !this.data.isSimpleMode });
  },

  toggleBFRef() {
    this.setData({ showBFRef: !this.data.showBFRef });
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

  // 简单版选择处理
  selectRange(e) {
    const { type, index } = e.currentTarget.dataset;
    const item = this.data.ranges[type][index];
    const key = type === 'fat' ? 'bodyFat' : type;
    
    // Apple 触感反馈
    wx.vibrateShort({ type: 'light' });

    const updateData = {};
    updateData['selectedIndices.' + type] = index;
    updateData[key] = item.value;
    this.setData(updateData);
    this.calculateResults();
  },

  onGenderChange(e) {
    wx.vibrateShort({ type: 'medium' });
    this.setData({ gender: e.detail.value });
    this.calculateResults();
  },

  onAgeInput(e) {
    this.setData({ age: Number(e.detail.value) });
    this.calculateResults();
  },

  onHeightInput(e) {
    this.setData({ height: Number(e.detail.value) });
    this.calculateResults();
  },

  onWeightInput(e) {
    this.setData({ weight: Number(e.detail.value) });
    this.calculateResults(true); // 只有在主要数据变动时才重置估算体脂
  },

  onFatInput(e) {
    const bodyFat = Number(e.detail.value);
    this.setData({ bodyFat });
    this.calculateLBM();
  },

  onFatChange(e) {
    const bodyFat = Number(e.detail.value.toFixed(1));
    this.setData({ bodyFat });
    this.calculateLBM();
  },

  onLevelChange(e) {
    const levelIndex = Number(e.detail.value);
    wx.vibrateShort({ type: 'light' });
    this.setData({ levelIndex }, () => {
      this.calculateStrength();
    });
  },

  previewRefImage() {
    const gender = this.data.gender;
    const url = `/images/bf_${gender}.jpg`;
    wx.previewImage({
      urls: [url],
      current: url
    });
  },

  calculateResults(resetFat = false) {
    const { gender, weight, height, age } = this.data;
    if (!weight || !height || !age) return;
    
    const bmi = util.calculateBMI(weight, height);
    const bmr = util.calculateBMR(gender, weight, height, age);
    const tdee = util.calculateTDEE(bmr, bmi);
    
    const updateData = { bmi, bmr, tdee };
    if (resetFat || this.data.bodyFat === 0) {
      updateData.bodyFat = util.estimateBodyFat(gender, age, bmi);
    }
    
    this.setData(updateData, () => {
      this.calculateLBM();
      this.calculateStrength(); // 每次身材变动自动重算力量推算
    });
  },

  calculateLBM() {
    const { weight, bodyFat } = this.data;
    const lbm = util.calculateLBM(weight, bodyFat);
    this.setData({ lbm });
  },

  calculateStrength() {
    const { gender, weight, bmi, age, levelIndex } = this.data;
    // 映射 UI 等级到算法等级
    const levelMap = ['beginner', 'beginner', 'intermediate', 'intermediate'];
    const levelKey = levelMap[levelIndex] || 'beginner';
    
    const sbd = util.estimateSBD(gender, weight, bmi, age, levelKey);
    const total = sbd.squat + sbd.bench + sbd.deadlift;
    const strengthLevel = util.getStrengthLevel(gender, weight, bmi, total);
    
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
      startRange
    });
  },

  onWeightAdj(e) {
    const key = e.currentTarget.dataset.key;
    const val = e.detail.value;
    const startRange = this.data.startRange;
    
    // 触感反馈
    if (val !== startRange[key]) {
      wx.vibrateShort({ type: 'light' });
    }

    startRange[key] = val;
    this.setData({ startRange });
  },

  saveAndNext() {
    wx.vibrateShort({ type: 'medium' });
    const { 
      gender, age, height, weight, bmi, bmr, tdee, bodyFat, lbm,
      isSimpleMode, selectedIndices, estimatedSBD, startRange, strengthLevel,
      levelIndex
    } = this.data;
    
    const bodyData = { 
      gender, age, height, weight, bmi, bmr, tdee, bodyFat, lbm,
      isSimpleMode, selectedIndices 
    };
    // 合并力量数据到本地存储
    const strengthData = { estimatedSBD, startRange, strengthLevel, levelIndex };
    
    wx.setStorageSync('bodyData', bodyData);
    wx.setStorageSync('strengthData', strengthData);
    
    // 逻辑调整：从 switchTab 改为线性跳转，作为前置引导
    wx.navigateTo({
      url: '/pages/target/target'
    });
  },

  onShareAppMessage() {
    return {
      title: '健力塑身 - 0基础小白的数字健身教练',
      path: '/pages/input/input'
    };
  },

  onShareTimeline() {
    return {
      title: '健力塑身 - 0基础小白的数字健身教练'
    };
  }
})