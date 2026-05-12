const util = require('../../utils/util.js');

Page({
  data: {
    currentWeek: 1,
    strengthData: null,
    targetData: null,
    bodyData: null,
    weeklyPlan: [],
    completedTasks: {}, // { 'W1-DayA-Ex0': true }
    foodExchange: null,
    swappedExercises: {}, // { 'W1-A-0': 'Leg Press' }
    growthPrediction: null,
    deloadWeeks: {}, // { 'W6': true }
    isDeload: false,
    globalProgress: 0,
    progressMatrix: [], // [{week: 1, status: 'done'}]
    timerActive: false,
    timerDisplay: '03:00',
    restTime: 0, // 休息计时
    timer: null,
    energyScore: 3,
    strengthLevel: { label: '未入门', class: 'untrained' },
    showBFRef: false
  },

  onUnload() {
    if (this.data.timer) clearInterval(this.data.timer);
  },

  onShow() {
    const strengthData = wx.getStorageSync('strengthData');
    const targetData = wx.getStorageSync('targetData');
    const bodyData = wx.getStorageSync('bodyData');
    const completedTasks = wx.getStorageSync('completedTasks') || {};
    const swappedExercises = wx.getStorageSync('swappedExercises') || {};
    const deloadWeeks = wx.getStorageSync('deloadWeeks') || {};
    
    if (!strengthData || !targetData || !strengthData.startRange) {
      wx.reLaunch({ url: '/pages/input/input' });
      return;
    }

    const isDeload = !!deloadWeeks[`W${this.data.currentWeek}`];

    this.setData({ 
      strengthData, 
      targetData, 
      bodyData,
      completedTasks, 
      swappedExercises, 
      deloadWeeks,
      isDeload,
      strengthLevel: strengthData.strengthLevel || { label: '未入门', class: 'untrained' }
    }, () => {
      this.calculateProgress();
      this.generatePlan(this.data.currentWeek);
    });
  },

  selectWeek(e) {
    const week = e.currentTarget.dataset.week;
    const isDeload = !!this.data.deloadWeeks[`W${week}`];
    this.setData({ currentWeek: week, isDeload });
    this.generatePlan(week);
  },

  calculateProgress() {
    const { targetData, completedTasks } = this.data;
    if (!targetData) return;
    
    const weeks = targetData.estimatedWeeks || 12;
    let totalExercises = 0;
    let completedCount = 0;
    const matrix = [];

    for (let w = 1; w <= weeks; w++) {
      const wTasks = Object.keys(completedTasks).filter(k => k.startsWith(`W${w}-`));
      const wCompleted = wTasks.filter(k => completedTasks[k]).length;
      const wTotal = 6; // 每周假设 2 天训练，每天 3 个动作
      
      totalExercises += wTotal;
      completedCount += wCompleted;
      
      matrix.push({
        week: w,
        status: wCompleted === 0 ? 'pending' : (wCompleted >= wTotal ? 'done' : 'half')
      });
    }

    this.setData({
      globalProgress: Math.round((completedCount / totalExercises) * 100),
      progressMatrix: matrix
    });
  },

  generatePlan(week) {
    const { strengthData, targetData, bodyData } = this.data;
    if (!strengthData || !targetData || !bodyData) return;

    const currentPlanMode = targetData.trainingMode || 'gym_strength';
    let plan = [];
    
    if (currentPlanMode.includes('gym')) {
      plan = this.generateGymPlan(week, strengthData.startRange);
    } else if (currentPlanMode.includes('home')) {
      plan = this.generateBodyweightPlan(week);
    } else if (currentPlanMode.includes('cardio')) {
      plan = this.generateCardioPlan(week);
    }

    const foodExchange = util.getFoodExchange(targetData.macros, 'meat'); // 默认肉类，后续可从 me 页面读取偏好

    this.setData({ 
      weeklyPlan: plan,
      foodExchange
    });
  },

  generateGymPlan(week, start) {
    if (!start) return [];
    const { targetData, swappedExercises, deloadWeeks, bodyData, energyScore } = this.data;
    const isMuscle = targetData.goal === 'muscle';
    const isDeload = deloadWeeks[`W${week}`];
    const recovery = util.getRecoveryAdjustment(energyScore);
    
    const squatInc = util.getWeightIncrement(start.squatMin, bodyData.gender, bodyData.age, bodyData.bmi);
    const benchInc = util.getWeightIncrement(start.benchMin, bodyData.gender, bodyData.age, bodyData.bmi);
    const deadliftInc = util.getWeightIncrement(start.deadliftMin, bodyData.gender, bodyData.age, bodyData.bmi);

    let multiplier = isMuscle ? 1 : 0.5;
    if (isDeload) multiplier = 0; 
    
    if (bodyData.bmi > 28 && targetData.goal === 'fat_loss') {
      multiplier *= 0.5;
    }

    const baseWeights = {
      squat: (start.squatMin + (week - 1) * squatInc * multiplier) * recovery.weightMult,
      bench: (start.benchMin + (week - 1) * benchInc * multiplier) * recovery.weightMult,
      deadlift: (start.deadliftMin + (week - 1) * deadliftInc * multiplier) * recovery.weightMult
    };

    if (isDeload) {
      Object.keys(baseWeights).forEach(k => baseWeights[k] *= 0.9);
    }

    const setsAdjust = (defaultSets) => Math.max(1, Math.round(defaultSets * recovery.setsMult));

    const getExData = (id, defaultName, baseWeight) => {
      const name = swappedExercises[id] || defaultName;
      const weightMultiplier = util.getWeightMultiplier(defaultName, name);
      const finalWeight = (baseWeight * weightMultiplier).toFixed(1);
      const detail = util.getExerciseDetail(name);
      return { id, name, weight: finalWeight, ...detail };
    };

    return [
      {
        day: isDeload ? `减载周 A 恢复训练` : (isMuscle ? '训练日 A 深蹲+卧推' : '力量维持 A 深蹲+卧推'),
        exercises: [
          { ...getExData(`W${week}-A-0`, '深蹲', baseWeights.squat), sets: setsAdjust(isDeload ? 3 : 5), reps: 5, restSec: 180 },
          { ...getExData(`W${week}-A-1`, '卧推', baseWeights.bench), sets: setsAdjust(isDeload ? 3 : 5), reps: 5, restSec: 180 },
          { id: `W${week}-A-2`, name: '辅助动作 划船/引体', sets: setsAdjust(3), reps: '8-12', weight: '-', restSec: 60, tip: '控制节奏，感受拉伸。' }
        ]
      },
      {
        day: isDeload ? `减载周 B 恢复训练` : (isMuscle ? '训练日 B 硬拉+推举' : '力量维持 B 硬拉+推举'),
        exercises: [
          { ...getExData(`W${week}-B-0`, '硬拉', baseWeights.deadlift), sets: 1, reps: 5, restSec: 240 },
          { ...getExData(`W${week}-B-1`, '站姿推举', baseWeights.bench * 0.7), sets: setsAdjust(isDeload ? 3 : 5), reps: 5, restSec: 120 },
          { id: `W${week}-B-2`, name: '辅助动作 核心/小肌群', sets: setsAdjust(3), reps: '10-15', weight: '-', restSec: 60, tip: '加强核心稳定性。' }
        ]
      }
    ];
  },

  generateBodyweightPlan(week) {
    const level = week <= 4 ? '入门' : (week <= 8 ? '进阶' : '挑战');
    const pushups = 10 + (week - 1) * 2;
    const squats = 15 + (week - 1) * 3;
    
    const getExData = (id, name, reps) => {
      const detail = util.getExerciseDetail(name);
      return { id, name, reps, weight: '自重', ...detail };
    }

    return [
      {
        day: `自重训练 A ${level}`,
        exercises: [
          { ...getExData(`W${week}-H-A0`, '俯卧撑', pushups), sets: 3, restSec: 90 },
          { ...getExData(`W${week}-H-A1`, '自重深蹲', squats), sets: 3, restSec: 90 },
          { id: `W${week}-H-A2`, ...getExData(`W${week}-H-A2`, '平板支撑', (45 + week * 5) + 's'), sets: 3, restSec: 60 }
        ]
      }
    ];
  },

  generateCardioPlan(week) {
    const { bodyData } = this.data;
    const level = week <= 4 ? '基础耐力' : (week <= 8 ? '心肺进阶' : '燃脂爆发');
    const baseDistance = bodyData.bmi > 28 ? 2.0 : 3.0;
    const distance = (baseDistance + (week - 1) * 0.3).toFixed(1);

    const getExData = (id, name, reps, weight) => {
      const detail = util.getExerciseDetail(name);
      return { id, name, reps, weight, ...detail };
    }

    return [
      {
        day: `有氧 A ${level}`,
        exercises: [
          { ...getExData(`W${week}-C-A0`, '慢跑', distance + ' km', '持续'), sets: 1, restSec: 0 },
          { ...getExData(`W${week}-C-A1`, '拉伸', '10 min', '-'), sets: 1, restSec: 0 }
        ]
      },
      {
        day: `有氧 B ${level}`,
        exercises: [
          { ...getExData(`W${week}-C-B0`, 'HIIT 间歇训练', '30s 冲刺 / 60s 慢走', '全力'), sets: week + 4, restSec: 60 }
        ]
      }
    ];
  },

  startTimer(e) {
    const { sec } = e.currentTarget.dataset;
    if (this.data.timer) clearInterval(this.data.timer);
    
    this.setData({ 
      restTime: sec,
      timerActive: true,
      timerDisplay: this.formatTime(sec)
    });
    
    const timer = setInterval(() => {
      if (this.data.restTime <= 0) {
        clearInterval(timer);
        this.setData({ timerActive: false, timer: null });
        wx.vibrateLong();
        wx.showModal({ title: '休息结束', content: '开始下一组！', showCancel: false });
        return;
      }
      const newTime = this.data.restTime - 1;
      this.setData({ 
        restTime: newTime,
        timerDisplay: this.formatTime(newTime)
      });
    }, 1000);
    
    this.setData({ timer });
  },

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  },

  stopTimer() {
    if (this.data.timer) clearInterval(this.data.timer);
    this.setData({ restTime: 0, timer: null, timerActive: false });
  },

  toggleDeload() {
    wx.vibrateShort({ type: 'medium' });
    const { currentWeek, deloadWeeks } = this.data;
    const key = `W${currentWeek}`;
    
    const updatedDeloadWeeks = deloadWeeks || {};
    updatedDeloadWeeks[key] = !updatedDeloadWeeks[key];
    
    this.setData({ 
      deloadWeeks: updatedDeloadWeeks,
      isDeload: updatedDeloadWeeks[key]
    });
    wx.setStorageSync('deloadWeeks', updatedDeloadWeeks);
    this.generatePlan(currentWeek);
    
    wx.showToast({ title: updatedDeloadWeeks[key] ? '已开启减载模式' : '已恢复正常模式', icon: 'none' });
  },

  toggleComplete(e) {
    wx.vibrateShort({ type: 'light' });
    const { dayindex, exindex } = e.currentTarget.dataset;
    const weeklyPlan = this.data.weeklyPlan;
    const exercise = weeklyPlan[dayindex].exercises[exindex];
    
    const taskId = exercise.id;
    const completedTasks = this.data.completedTasks;
    completedTasks[taskId] = !completedTasks[taskId];
    
    this.setData({ completedTasks });
    wx.setStorageSync('completedTasks', completedTasks);
    this.calculateProgress();
    
    if (!completedTasks[taskId]) {
      this.checkPlateau(taskId);
    }
  },

  checkPlateau(taskId) {
    const weekMatch = taskId.match(/W(\d+)/);
    if (!weekMatch) return;
    const week = parseInt(weekMatch[1]);
    
    if (week > 4 && !this.data.completedTasks[taskId]) {
      const nextWeek = week + 1;
      wx.showModal({
        title: '平台期诊断',
        content: '检测到动作未完成。建议下周执行 Deload（减载周），重量下调 10% 以恢复状态。是否一键开启？',
        success: (res) => {
          if (res.confirm) {
            const deloadWeeks = this.data.deloadWeeks;
            deloadWeeks[`W${nextWeek}`] = true;
            this.setData({ deloadWeeks });
            wx.setStorageSync('deloadWeeks', deloadWeeks);
            wx.showToast({ title: '已开启下周减载' });
          }
        }
      });
    }
  },

  onEnergyChange(e) {
    const energyScore = Number(e.detail.value);
    this.setData({ energyScore });
    this.generatePlan(this.data.currentWeek);
  },

  toggleExDetail(e) {
    const { dayindex, exindex } = e.currentTarget.dataset;
    const weeklyPlan = this.data.weeklyPlan;
    const exercise = weeklyPlan[dayindex].exercises[exindex];
    exercise.showDetail = !exercise.showDetail;
    this.setData({ weeklyPlan });
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

  onShareAppMessage() {
    return {
      title: '健力塑身 - 我的12周进化计划已开启',
      path: '/pages/input/input'
    };
  },

  onShareTimeline() {
    return {
      title: '健力塑身 - 12周量化训练计划'
    };
  }
})
