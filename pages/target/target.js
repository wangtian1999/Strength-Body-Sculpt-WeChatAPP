Page({
  data: {
    isSimpleMode: true, // 默认简单版
    goal: 'muscle',
    trainingMode: 'gym_strength', // 默认健身房三大项
    targetWeight: 75,
    targetBodyFat: 15,
    dailyCalories: 0,
    estimatedDays: 0,
    estimatedWeeks: 0,
    calorieOffset: 0,
    macros: { protein: 0, fat: 0, carb: 0 }, // 新增营养配比
    bodyData: null,
    showBFRef: false,

    // 简单版目标选择配置
    targetOptions: {
      muscle: [
        { label: '精干增肌', fat: 12, desc: '保持极低体脂，缓慢增肌' },
        { label: '标准增肌', fat: 15, desc: '兼顾围度与体脂' },
        { label: '强壮增肌', fat: 18, desc: '最大化肌肉量增长' }
      ],
      fat_loss: [
        { label: '极度脱脂', fat: 10, desc: '追求肌肉线条极致清晰' },
        { label: '运动健美', fat: 13, desc: '保持健康较低体脂' },
        { label: '日常减脂', fat: 16, desc: '回归正常健康身形' }
      ]
    },
    selectedTargetIndex: 1
  },

  onShow() {
    const bodyData = wx.getStorageSync('bodyData');
    const existingTargetData = wx.getStorageSync('targetData');

    if (bodyData) {
      // 如果本地已有 targetData，优先读取已保存的数据，避免重复重置
      if (existingTargetData) {
        this.setData({
          bodyData,
          ...existingTargetData
        });
        // 渲染完数据后，手动执行一次计算以同步 UI
        this.calculateTarget();
        return;
      }

      // 只有在没有历史数据时，才执行初始化逻辑
      const isSimpleMode = bodyData.isSimpleMode !== undefined ? bodyData.isSimpleMode : true;
      const initialGoal = bodyData.bmi > 25 ? 'fat_loss' : 'muscle';
      const isMale = bodyData.gender === 'male';
      const defaultTargetFat = initialGoal === 'muscle' 
        ? (isMale ? 15 : 22) 
        : (isMale ? 12 : 20);
      
      this.setData({ 
        bodyData,
        isSimpleMode,
        goal: initialGoal,
        targetBodyFat: defaultTargetFat
      });

      if (isSimpleMode) {
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
          wx.switchTab({ url: '/pages/input/input' });
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

  // 8.0 Apple 风格选择处理
  selectGoal(e) {
    wx.vibrateShort({ type: 'light' });
    const goal = e.currentTarget.dataset.goal;
    this.setData({ 
      goal,
      selectedTargetIndex: 1 
    });
    if (this.data.isSimpleMode) {
      this.selectTargetOption({ currentTarget: { dataset: { index: 1 } } });
    } else {
      this.calculateTargetByFat();
    }
  },

  selectMode(e) {
    wx.vibrateShort({ type: 'light' });
    this.setData({ trainingMode: e.currentTarget.dataset.mode });
    this.calculateTarget();
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
    const { bodyData, targetBodyFat, goal } = this.data;
    if (!bodyData) return;

    // 假设瘦体重保持不变（最稳健的推算法）
    // 目标体重 = 瘦体重 / (1 - 目标体脂率)
    const lbm = bodyData.lbm;
    let targetWeight = Number((lbm / (1 - targetBodyFat / 100)).toFixed(1));
    
    // 逻辑修正：增肌时，目标体重不应低于当前体重；减脂时，目标体重不应高于当前体重
    if (goal === 'muscle' && targetWeight < bodyData.weight) {
      targetWeight = Number((bodyData.weight + 2).toFixed(1)); // 强制设为当前体重 + 2kg 起步
    } else if (goal === 'fat_loss' && targetWeight > bodyData.weight) {
      targetWeight = Number((bodyData.weight - 2).toFixed(1)); // 强制设为当前体重 - 2kg 起步
    }
    
    this.setData({ targetWeight });
    this.calculateTarget();
  },

  calculateTarget() {
    const { goal, targetWeight, bodyData } = this.data;
    if (!bodyData || !targetWeight) return;

    const tdee = bodyData.tdee || 2000;
    const currentWeight = bodyData.weight || 70;
    let calorieOffset = 0;
    let weightChangeRate = 0; // kg per week

    if (goal === 'muscle') {
      calorieOffset = 250; // 盈余
      weightChangeRate = 0.2; // 建议每周增重 0.2kg (高质量增肌)
    } else {
      // 严谨性：如果 BMI 已经很低，不建议激进减脂
      const currentBMI = bodyData.bmi || 22;
      calorieOffset = currentBMI < 19 ? -200 : -400; 
      weightChangeRate = currentBMI < 19 ? 0.2 : 0.5;
    }

    const weightDiff = Math.abs(targetWeight - currentWeight);
    const estimatedWeeks = Math.max(4, Math.ceil(weightDiff / weightChangeRate)); // 最少4周计划
    const estimatedDays = estimatedWeeks * 7;
    const dailyCalories = Math.max(1200, Math.round(tdee + calorieOffset)); // 严谨性：每日摄入不低于 1200kcal 安全线

    // 计算三大营养素 (硬核配比)
    // 蛋白质: 增肌 2.2g/kg, 减脂 2.0g/kg
    // 脂肪: 0.8g/kg
    // 碳水: 剩余热量
    const pFactor = goal === 'muscle' ? 2.2 : 2.0;
    const protein = Math.round(currentWeight * pFactor);
    const fat = Math.round(currentWeight * 0.8);
    const carb = Math.round((dailyCalories - (protein * 4 + fat * 9)) / 4);

    this.setData({
      dailyCalories,
      estimatedDays,
      estimatedWeeks,
      calorieOffset: Math.abs(calorieOffset),
      macros: { protein, fat, carb }
    });
  },

  saveAndNext() {
    wx.vibrateShort({ type: 'medium' });
    const { goal, trainingMode, targetWeight, targetBodyFat, levelIndex, dailyCalories, estimatedDays, estimatedWeeks, isSimpleMode, macros } = this.data;
    const targetData = { goal, trainingMode, targetWeight, targetBodyFat, levelIndex, dailyCalories, estimatedDays, estimatedWeeks, isSimpleMode, macros };
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