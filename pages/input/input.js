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
        { label: '偏瘦', value: 10 },
        { label: '匀称', value: 15 },
        { label: '标准', value: 20 },
        { label: '饱满', value: 28 },
        { label: '偏胖', value: 35 }
      ]
    },
    // 当前简单版选中的索引
    selectedIndices: {
      age: 1,
      height: 2,
      weight: 2,
      fat: 1
    }
  },

  onLoad() {
    const bodyData = wx.getStorageSync('bodyData');
    if (bodyData) {
      this.setData(bodyData);
    } else {
      // 初始计算一次
      this.calculateResults();
    }

    // 自动弹出使用说明 (如果是第一次打开，或者你可以根据需求调整为每次都弹)
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
    
    const updateData = {};
    updateData['selectedIndices.' + type] = index;
    updateData[key] = item.value;
    this.setData(updateData);
    this.calculateResults();
  },

  onGenderChange(e) {
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

  calculateResults(resetFat = false) {
    const { gender, weight, height, age } = this.data;
    if (!weight || !height || !age) return;
    
    const bmi = util.calculateBMI(weight, height);
    const bmr = util.calculateBMR(gender, weight, height, age);
    const tdee = util.calculateTDEE(bmr);
    
    const updateData = { bmi, bmr, tdee };
    if (resetFat || this.data.bodyFat === 0) {
      updateData.bodyFat = util.estimateBodyFat(gender, age, bmi);
    }
    
    this.setData(updateData);
    this.calculateLBM();
  },

  calculateLBM() {
    const { weight, bodyFat } = this.data;
    const lbm = util.calculateLBM(weight, bodyFat);
    this.setData({ lbm });
  },

  saveAndNext() {
    const { 
      gender, age, height, weight, bmi, bmr, tdee, bodyFat, lbm,
      isSimpleMode, selectedIndices 
    } = this.data;
    
    const bodyData = { 
      gender, age, height, weight, bmi, bmr, tdee, bodyFat, lbm,
      isSimpleMode, selectedIndices 
    };
    wx.setStorageSync('bodyData', bodyData);
    wx.switchTab({
      url: '/pages/target/target'
    });
  }
})