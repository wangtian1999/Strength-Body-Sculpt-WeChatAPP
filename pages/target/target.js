Page({
  data: {
    isSimpleMode: true, // 默认简单版
    goal: 'muscle',
    trainingMode: 'gym_strength', // 默认健身房三大项
    splitMode: 'full_body', // 默认全身分化
    targetWeight: 75,
    targetBodyFat: 15,
    dailyCalories: 0,
    estimatedDays: 0,
    estimatedWeeks: 0,
    calorieOffset: 0,
    macros: { protein: 0, fat: 0, carb: 0 }, // 新增营养配比
    bodyData: { gender: 'male' },
    showBFRef: false,

    // 简单版目标选择配置
    targetOptions: {
      muscle: [
        { label: '精干增肌', fat: 12, desc: '保持极低体脂，缓慢增肌' },
        { label: '标准增肌', fat: 15, desc: '兼顾围度与体脂' },
        { label: '强壮增肌', fat: 18, desc: '最大化肌肉量增长' }
      ]
    },
    selectedTargetIndex: 1
  },

  onShow() {
    const bodyData = wx.getStorageSync('bodyData');
    const existingTargetData = wx.getStorageSync('targetData');

    if (bodyData) {
      if (existingTargetData) {
        this.setData({
          bodyData,
          ...existingTargetData,
          goal: 'muscle' // 强制设定为增肌
        });
        this.calculateTarget();
        return;
      }

      const isMale = bodyData.gender === 'male';
      const defaultTargetFat = isMale ? 15 : 22;
      
      this.setData({ 
        bodyData,
        isSimpleMode: bodyData.isSimpleMode !== undefined ? bodyData.isSimpleMode : true,
        goal: 'muscle',
        targetBodyFat: defaultTargetFat
      });

      if (this.data.isSimpleMode) {
        this.selectTargetOption({ currentTarget: { dataset: { index: 1 } } });
      } else {
        this.calculateTargetByFat();
      }
    } else {
      wx.showModal({
        title: '提示',
        content: '请先在录入页面输入身材数据',
        showCancel: false,
        success: () => {
          wx.reLaunch({ url: '/pages/input/input' });
        }
      });
    }
  },

  toggleMode() {
    this.setData({ isSimpleMode: !this.data.isSimpleMode });
    if (this.data.isSimpleMode) {
      this.selectTargetOption({ currentTarget: { dataset: { index: this.data.selectedTargetIndex } } });
    } else {
      this.calculateTargetByFat();
    }
  },

  toggleBFRef() {
    this.setData({ showBFRef: !this.data.showBFRef });
  },

  previewRefImage() {
    const gender = this.data.bodyData.gender;
    const url = `/images/bf_${gender}.jpg`;
    wx.previewImage({
      urls: [url],
      current: url
    });
  },

  stopBubble() {
    // 阻止冒泡
  },

  // 简单版选择目标
  selectTargetOption(e) {
    wx.vibrateShort({ type: 'light' });
    const index = e.currentTarget.dataset.index;
    const option = this.data.targetOptions[this.data.goal][index];
    
    // 如果是女性，体脂率在预设基础上加 7%
    const genderOffset = this.data.bodyData.gender === 'female' ? 7 : 0;
    const targetFat = option.fat + genderOffset;

    this.setData({
      selectedTargetIndex: index,
      targetBodyFat: targetFat
    });
    this.calculateTargetByFat();
  },

  selectMode(e) {
    wx.vibrateShort({ type: 'light' });
    this.setData({ trainingMode: e.currentTarget.dataset.mode });
    this.calculateTarget();
  },

  selectSplit(e) {
    wx.vibrateShort({ type: 'light' });
    this.setData({ splitMode: e.currentTarget.dataset.split });
  },

  onFatChange(e) {
    wx.vibrateShort({ type: 'light' });
    this.setData({ targetBodyFat: Number(e.detail.value) });
    this.calculateTargetByFat();
  },

  onTargetWeightInput(e) {
    this.setData({ targetWeight: Number(e.detail.value) });
    this.calculateTarget();
  },

  // 基于期望体脂率推算目标体重
  calculateTargetByFat() {
    const { bodyData, targetBodyFat } = this.data;
    if (!bodyData) return;

    // 假设瘦体重保持不变（最稳健的推算法）
    // 目标体重 = 瘦体重 / (1 - 目标体脂率)
    const lbm = bodyData.lbm;
    let targetWeight = Number((lbm / (1 - targetBodyFat / 100)).toFixed(1));
    
    // 逻辑修正：增肌时，目标体重不应低于当前体重
    if (targetWeight < bodyData.weight) {
      targetWeight = Number((bodyData.weight + 2).toFixed(1)); // 强制设为当前体重 + 2kg 起步
    }
    
    this.setData({ targetWeight });
    this.calculateTarget();
  },

  calculateTarget() {
    const { bodyData } = this.data;
    if (!bodyData) return;

    const tdee = bodyData.tdee || 2000;
    const currentWeight = bodyData.weight || 70;
    
    // 专注增肌塑形：设定盈余 (300kcal 为高质量增肌基准)
    const calorieOffset = 300; 
    const dailyCalories = Math.max(1200, Math.round(tdee + calorieOffset)); 

    // 计算三大营养素 (硬核配比)
    // 蛋白质: 2.2g/kg (高强度训练需求)
    // 脂肪: 0.8g/kg (激素健康需求)
    // 碳水: 剩余热量 (能源供应)
    const protein = Math.round(currentWeight * 2.2);
    const fat = Math.round(currentWeight * 0.8);
    const carb = Math.round((dailyCalories - (protein * 4 + fat * 9)) / 4);

    this.setData({
      dailyCalories,
      estimatedWeeks: 12, 
      calorieOffset,
      macros: { protein, fat, carb }
    });
  },

  saveAndNext() {
    wx.vibrateShort({ type: 'medium' });
    const { goal, trainingMode, splitMode, targetWeight, targetBodyFat, levelIndex, dailyCalories, estimatedWeeks, isSimpleMode, macros } = this.data;
    const targetData = { goal, trainingMode, splitMode, targetWeight, targetBodyFat, levelIndex, dailyCalories, estimatedWeeks, isSimpleMode, macros };
    wx.setStorageSync('targetData', targetData);
    
    // 逻辑调整：完成前置引导，进入正式 TabBar 界面
    wx.reLaunch({
      url: '/pages/plan/plan'
    });
  },

  onShareAppMessage() {
    return {
      title: '健力塑身 - 科学规划你的理想身材',
      path: '/pages/input/input'
    };
  },

  onShareTimeline() {
    return {
      title: '健力塑身 - 科学规划你的理想身材'
    };
  }
})