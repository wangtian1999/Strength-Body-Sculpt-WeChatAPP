const util = require('../../utils/util.js');

Page({
  data: {
    isLoaded: false,
    bodyData: null,
    targetData: null,
    strengthData: null,
    strengthLevel: { label: '未入门', ratio: '0.00', class: 'untrained' },
    showHelpModal: false,
    showStrengthLevelModal: false,
    showEditModal: false,
    showStrengthModal: false,
    showProfileModal: false,
    showStartWeightModal: false,
    editType: '',
    editLabel: '',
    editUnit: '',
    editValue: '',
    tempProfile: { age: 0, height: 0, gender: 'male' },
    tempSBD: { squat: 0, bench: 0, deadlift: 0 },
    tempStartWeight: { squat: 0, bench: 0, deadlift: 0 }
  },

  onShow() {
    const bodyData = wx.getStorageSync('bodyData');
    const targetData = wx.getStorageSync('targetData');
    const strengthData = wx.getStorageSync('strengthData');
    
    const updateData = {
      isLoaded: true,
      targetData: targetData || null, 
      strengthData: strengthData || null,
      strengthLevel: strengthData ? strengthData.strengthLevel : { label: '未入门', ratio: '0.00', class: 'untrained' }
    };

    if (bodyData) {
      updateData.bodyData = bodyData;
    }

    this.setData(updateData);
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

  showStrengthLevelDetails() {
    wx.vibrateShort({ type: 'light' });
    this.setData({ showStrengthLevelModal: true });
  },

  hideStrengthLevelDetails() {
    this.setData({ showStrengthLevelModal: false });
  },

  editProfile() {
    const { bodyData } = this.data;
    wx.vibrateShort({ type: 'light' });
    this.setData({
      showProfileModal: true,
      tempProfile: {
        age: bodyData.age,
        height: bodyData.height,
        gender: bodyData.gender
      }
    });
  },

  onProfileInput(e) {
    const { key } = e.currentTarget.dataset;
    const { tempProfile } = this.data;
    tempProfile[key] = parseFloat(e.detail.value);
    this.setData({ tempProfile });
  },

  changeGender(e) {
    const { value } = e.currentTarget.dataset;
    const { tempProfile } = this.data;
    tempProfile.gender = value;
    this.setData({ tempProfile });
    wx.vibrateShort({ type: 'light' });
  },

  hideProfileModal() {
    this.setData({ showProfileModal: false });
  },

  saveProfile() {
    const { tempProfile, bodyData, strengthData, targetData } = this.data;
    
    if (!tempProfile.age || !tempProfile.height || tempProfile.age <= 0 || tempProfile.height <= 0) {
      wx.showToast({ title: '请输入有效数值', icon: 'none' });
      return;
    }

    const newBodyData = { 
      ...bodyData, 
      age: tempProfile.age, 
      height: tempProfile.height, 
      gender: tempProfile.gender 
    };
    
    // 重新计算相关指标
    newBodyData.bmi = util.calculateBMI(newBodyData.weight, newBodyData.height);
    const bmr = util.calculateBMR(newBodyData.gender, newBodyData.weight, newBodyData.height, newBodyData.age);
    newBodyData.tdee = util.calculateTDEE(bmr, newBodyData.bmi);
    
    // 重新估算体脂 (基于公式)
    newBodyData.bodyFat = util.estimateBodyFat(newBodyData.gender, newBodyData.age, newBodyData.bmi);
    
    // 更新力量等级 (因为性别/身高/年龄可能变了影响推算)
    let newStrengthLevel = this.data.strengthLevel;
    if (strengthData) {
      const total = strengthData.estimatedSBD.squat + strengthData.estimatedSBD.bench + strengthData.estimatedSBD.deadlift;
      newStrengthLevel = util.getStrengthLevel(newBodyData.gender, newBodyData.weight, newBodyData.bmi, total);
      strengthData.strengthLevel = newStrengthLevel;
      wx.setStorageSync('strengthData', strengthData);
    }

    // 更新营养配比 (如果存在)
    if (targetData) {
      const calorieOffset = targetData.calorieOffset || 0;
      const dailyCalories = newBodyData.tdee + calorieOffset;
      targetData.dailyCalories = dailyCalories;
      targetData.macros = {
        protein: Math.round(newBodyData.weight * 2),
        fat: Math.round(newBodyData.weight * 0.8),
        carb: Math.round((dailyCalories - (newBodyData.weight * 2 * 4) - (newBodyData.weight * 0.8 * 9)) / 4)
      };
      wx.setStorageSync('targetData', targetData);
    }

    wx.setStorageSync('bodyData', newBodyData);
    this.setData({ 
      bodyData: newBodyData, 
      strengthLevel: newStrengthLevel,
      targetData: targetData,
      strengthData: strengthData,
      showProfileModal: false 
    });
    
    wx.showToast({ title: '修改成功' });
  },

  editItem(e) {
    const type = e.currentTarget.dataset.type;
    const bodyData = this.data.bodyData;
    const labels = { age: '年龄', height: '身高', weight: '体重', bodyFat: '体脂率' };
    const units = { age: '岁', height: 'cm', weight: 'kg', bodyFat: '%' };
    
    wx.vibrateShort({ type: 'light' });
    this.setData({
      showEditModal: true,
      editType: type,
      editLabel: labels[type],
      editUnit: units[type],
      editValue: bodyData[type]
    });
  },

  onEditInput(e) {
    this.setData({ editValue: e.detail.value });
  },

  hideEditModal() {
    this.setData({ showEditModal: false });
  },

  saveEdit() {
    const { editType, editValue, bodyData, strengthData, targetData } = this.data;
    const val = parseFloat(editValue);
    
    if (isNaN(val) || val <= 0) {
      wx.showToast({ title: '请输入有效数值', icon: 'none' });
      return;
    }

    const newBodyData = { ...bodyData, [editType]: val };
    
    // 重新计算相关指标
    if (editType === 'weight' || editType === 'height') {
      newBodyData.bmi = util.calculateBMI(newBodyData.weight, newBodyData.height);
    }
    
    const bmr = util.calculateBMR(newBodyData.gender, newBodyData.weight, newBodyData.height, newBodyData.age);
    newBodyData.tdee = util.calculateTDEE(bmr, newBodyData.bmi);
    
    // 如果是修改了体重/年龄/身高，且体脂是自动计算的，则重新估算体脂
    // (这里简化逻辑：如果是手动修改体脂，则不再自动估算)
    if (editType !== 'bodyFat') {
      // 保持之前的体脂计算逻辑
      newBodyData.bodyFat = util.estimateBodyFat(newBodyData.gender, newBodyData.age, newBodyData.bmi);
    }
    
    // 更新力量等级 (因为体重变了)
    let newStrengthLevel = this.data.strengthLevel;
    if (strengthData) {
      const total = strengthData.estimatedSBD.squat + strengthData.estimatedSBD.bench + strengthData.estimatedSBD.deadlift;
      newStrengthLevel = util.getStrengthLevel(newBodyData.gender, newBodyData.weight, newBodyData.bmi, total);
      strengthData.strengthLevel = newStrengthLevel;
      wx.setStorageSync('strengthData', strengthData);
    }

    // 更新营养配比 (如果存在)
    if (targetData) {
      const calorieOffset = targetData.calorieOffset || 0;
      const dailyCalories = newBodyData.tdee + calorieOffset;
      targetData.dailyCalories = dailyCalories;
      targetData.macros = {
        protein: Math.round(newBodyData.weight * 2),
        fat: Math.round(newBodyData.weight * 0.8),
        carb: Math.round((dailyCalories - (newBodyData.weight * 2 * 4) - (newBodyData.weight * 0.8 * 9)) / 4)
      };
      wx.setStorageSync('targetData', targetData);
    }

    wx.setStorageSync('bodyData', newBodyData);
    this.setData({ 
      bodyData: newBodyData, 
      strengthLevel: newStrengthLevel,
      targetData: targetData,
      strengthData: strengthData,
      showEditModal: false 
    });
    
    wx.showToast({ title: '修改成功' });
  },

  editStrength() {
    const { strengthData } = this.data;
    if (!strengthData) return;
    
    wx.vibrateShort({ type: 'light' });
    this.setData({
      showStrengthModal: true,
      tempSBD: { ...strengthData.estimatedSBD },
      tempStartWeight: { 
        squat: strengthData.startRange.squatMin,
        bench: strengthData.startRange.benchMin,
        deadlift: strengthData.startRange.deadliftMin
      }
    });
  },

  onSBDInput(e) {
    const key = e.currentTarget.dataset.key;
    const tempSBD = this.data.tempSBD;
    tempSBD[key] = parseFloat(e.detail.value) || 0;
    this.setData({ tempSBD });
  },

  onStartWeightInput(e) {
    const key = e.currentTarget.dataset.key;
    const tempStartWeight = this.data.tempStartWeight;
    tempStartWeight[key] = parseFloat(e.detail.value) || 0;
    this.setData({ tempStartWeight });
  },

  hideStrengthModal() {
    this.setData({ showStrengthModal: false });
  },

  saveStrength() {
    const { tempSBD, tempStartWeight, strengthData, bodyData } = this.data;
    
    if (tempSBD.squat <= 0 || tempSBD.bench <= 0 || tempSBD.deadlift <= 0 ||
        tempStartWeight.squat <= 0 || tempStartWeight.bench <= 0 || tempStartWeight.deadlift <= 0) {
      wx.showToast({ title: '力量值需大于0', icon: 'none' });
      return;
    }

    const newStrengthData = { ...strengthData };
    newStrengthData.estimatedSBD = { ...tempSBD };
    newStrengthData.startRange = {
      squatMin: tempStartWeight.squat,
      benchMin: tempStartWeight.bench,
      deadliftMin: tempStartWeight.deadlift
    };
    newStrengthData.isManualSBD = true;

    // 重新计算等级
    const total = tempSBD.squat + tempSBD.bench + tempSBD.deadlift;
    const newStrengthLevel = util.getStrengthLevel(bodyData.gender, bodyData.weight, bodyData.bmi, total);
    newStrengthLevel.ratio = (total / bodyData.weight).toFixed(2);
    
    newStrengthData.strengthLevel = newStrengthLevel;

    wx.setStorageSync('strengthData', newStrengthData);
    this.setData({
      strengthData: newStrengthData,
      strengthLevel: newStrengthLevel,
      showStrengthModal: false
    });

    wx.showToast({ title: '力量数据已更新' });
    
    wx.showModal({
      title: '同步提醒',
      content: '力量数据已修改。建议前往“目标规划”重新点击“一键生成训练计划”，以确保 12 周进阶矩阵应用新重量。',
      showCancel: false
    });
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
  },

  onShareAppMessage() {
    return {
      title: '健力塑身 - 你的数字健身教练',
      path: '/pages/input/input'
    };
  },

  onShareTimeline() {
    return {
      title: '健力塑身 - 快速进化，量化进步'
    };
  }
})