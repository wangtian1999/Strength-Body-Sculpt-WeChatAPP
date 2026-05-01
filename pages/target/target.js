Page({
  data: {
    isSimpleMode: true, // 默认简单版
    goal: 'muscle',
    trainingMode: 'gym_strength', // 默认健身房三大项
    targetWeight: 75,
    targetBodyFat: 15,
    levelIndex: 0,
    levels: ['新手 (0-6个月)', '初级 (6-12个月)', '中级 (1-2年)', '高级 (2年以上)'],
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
    if (bodyData) {
      // 继承录入页的模式设定
      const isSimpleMode = bodyData.isSimpleMode !== undefined ? bodyData.isSimpleMode : true;
      
      // 智能判断初始方向：如果 BMI > 25，默认推荐减脂；否则推荐增肌
      const initialGoal = bodyData.bmi > 25 ? 'fat_loss' : 'muscle';
      
      // 默认目标体脂设定：男 15%，女 22% (针对精细版)
      const defaultTargetFat = bodyData.gender === 'male' ? 15 : 22;
      
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

  // 简单版选择目标
  selectTargetOption(e) {
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

  onGoalChange(e) {
    this.setData({ 
      goal: e.detail.value,
      selectedTargetIndex: 1 // 切换目标时重置为中间选项
    });
    if (this.data.isSimpleMode) {
      this.selectTargetOption({ currentTarget: { dataset: { index: 1 } } });
    } else {
      this.calculateTarget();
    }
  },

  onModeChange(e) {
    this.setData({ trainingMode: e.detail.value });
  },

  onTargetWeightInput(e) {
    this.setData({ targetWeight: Number(e.detail.value) });
    this.calculateTarget();
  },

  onTargetFatChange(e) {
    this.setData({ targetBodyFat: Number(e.detail.value) });
    this.calculateTargetByFat();
  },

  onLevelChange(e) {
    this.setData({ levelIndex: Number(e.detail.value) });
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

    const tdee = bodyData.tdee;
    const currentWeight = bodyData.weight;
    let calorieOffset = 0;
    let weightChangeRate = 0; // kg per week

    if (goal === 'muscle') {
      calorieOffset = 250; // 盈余
      weightChangeRate = 0.2; // 建议每周增重 0.2kg (高质量增肌)
    } else {
      calorieOffset = -400; // 缺口
      weightChangeRate = 0.5; // 建议每周减重 0.5kg
    }

    const weightDiff = Math.abs(targetWeight - currentWeight);
    const estimatedWeeks = Math.ceil(weightDiff / weightChangeRate);
    const estimatedDays = estimatedWeeks * 7;
    const dailyCalories = Math.round(tdee + calorieOffset);

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
    const { goal, trainingMode, targetWeight, targetBodyFat, levelIndex, dailyCalories, estimatedDays, estimatedWeeks, isSimpleMode, macros } = this.data;
    const targetData = { goal, trainingMode, targetWeight, targetBodyFat, levelIndex, dailyCalories, estimatedDays, estimatedWeeks, isSimpleMode, macros };
    wx.setStorageSync('targetData', targetData);
    wx.switchTab({
      url: '/pages/strength/strength'
    });
  }
})