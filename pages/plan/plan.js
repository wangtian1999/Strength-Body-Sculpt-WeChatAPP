const util = require('../../utils/util.js');

Page({
  data: {
    currentWeek: 1,
    strengthData: null,
    weeklyPlan: [],
    completedTasks: {}, // { 'W1-DayA-Ex0': true }
    foodExchange: null,
    swappedExercises: {}, // { 'W1-A-0': 'Leg Press' }
    growthPrediction: null
  },

  onShow() {
    const strengthData = wx.getStorageSync('strengthData');
    const targetData = wx.getStorageSync('targetData');
    const completedTasks = wx.getStorageSync('completedTasks') || {};
    const swappedExercises = wx.getStorageSync('swappedExercises') || {};
    
    if (!strengthData || !targetData) {
      wx.showModal({
        title: '提示',
        content: '请先完成力量推算',
        showCancel: false,
        success: () => {
          wx.switchTab({ url: '/pages/strength/strength' });
        }
      });
      return;
    }

    const foodExchange = util.getFoodExchange(targetData.macros);
    
    // 计算 12 周增长预测
    let growthPrediction = null;
    if (strengthData && strengthData.startRange) {
      const isMuscle = targetData.goal === 'muscle';
      const multiplier = isMuscle ? 1 : 0.5;
      const weeks = targetData.estimatedWeeks || 12;
      const startTotal = strengthData.startRange.squatMin + strengthData.startRange.benchMin + strengthData.startRange.deadliftMin;
      const predictedTotal = startTotal + (weeks - 1) * (2.5 + 1.25 + 2.5) * multiplier;
      growthPrediction = {
        start: startTotal.toFixed(1),
        end: predictedTotal.toFixed(1),
        diff: (predictedTotal - startTotal).toFixed(1)
      };
    }

    this.setData({ strengthData, targetData, completedTasks, swappedExercises, foodExchange, growthPrediction });
    this.generatePlan(this.data.currentWeek);
  },

  selectWeek(e) {
    const week = e.currentTarget.dataset.week;
    this.setData({ currentWeek: week });
    this.generatePlan(week);
  },

  toggleTask(e) {
    const { id } = e.currentTarget.dataset;
    const completedTasks = this.data.completedTasks;
    completedTasks[id] = !completedTasks[id];
    
    this.setData({ completedTasks });
    wx.setStorageSync('completedTasks', completedTasks);
    
    // 检查平台期
    this.checkPlateau(id);
  },

  checkPlateau(taskId) {
    // 简易逻辑：如果连续两次同个动作没完成（或者被手动触发），提示 Deload
    // 这里简化为：如果点击取消完成，且是 W2 以后，提示注意休息
    const week = parseInt(taskId.match(/W(\d+)/)[1]);
    if (week > 4 && !this.data.completedTasks[taskId]) {
      wx.showToast({
        title: '若连续无法完成，建议下周减载(Deload)',
        icon: 'none',
        duration: 3000
      });
    }
  },

  swapExercise(e) {
    const { id, current } = e.currentTarget.dataset;
    const alternatives = {
      '深蹲 (SQUAT)': ['腿举 (Leg Press)', '哈克深蹲 (Hack Squat)'],
      '卧推 (BENCH)': ['哑铃卧推 (DB Bench)', '器械推胸 (Chest Press)'],
      '硬拉 (DEADLIFT)': ['相扑硬拉 (Sumo DL)', '罗马尼亚硬拉 (RDL)'],
      '站姿推举 (PRESS)': ['坐姿推举 (Seated Press)', '哑铃推举 (DB Press)']
    };

    const options = alternatives[current];
    if (!options) return;

    wx.showActionSheet({
      itemList: options.concat(['恢复原动作']),
      success: (res) => {
        const swappedExercises = this.data.swappedExercises;
        if (res.tapIndex === options.length) {
          delete swappedExercises[id];
        } else {
          swappedExercises[id] = options[res.tapIndex];
        }
        this.setData({ swappedExercises });
        wx.setStorageSync('swappedExercises', swappedExercises);
        this.generatePlan(this.data.currentWeek);
      }
    });
  },

  generatePlan(week) {
    const { strengthData, targetData } = this.data;
    const mode = targetData.trainingMode || 'gym_strength';
    let plan = [];

    if (mode === 'gym_strength') {
      plan = this.generateGymPlan(week, strengthData.startRange);
    } else if (mode === 'home_bodyweight') {
      plan = this.generateBodyweightPlan(week);
    } else if (mode === 'cardio') {
      plan = this.generateCardioPlan(week);
    }

    this.setData({ weeklyPlan: plan });
  },

  generateGymPlan(week, start) {
    const { targetData, swappedExercises } = this.data;
    const isMuscle = targetData.goal === 'muscle';
    
    const multiplier = isMuscle ? 1 : 0.5;

    const sWeight = start.squatMin + (week - 1) * 2.5 * multiplier;
    const bWeight = start.benchMin + (week - 1) * 1.25 * multiplier;
    const dWeight = start.deadliftMin + (week - 1) * 2.5 * multiplier;

    const getExName = (id, defaultName) => swappedExercises[id] || defaultName;

    return [
      {
        day: isMuscle ? '训练日 A (深蹲+卧推)' : '力量维持 A (深蹲+卧推)',
        exercises: [
          { id: `W${week}-A-0`, name: getExName(`W${week}-A-0`, '深蹲 (SQUAT)'), sets: 5, reps: 5, weight: sWeight.toFixed(1), rest: '3-5 min', warmUp: true, canSwap: true, original: '深蹲 (SQUAT)' },
          { id: `W${week}-A-1`, name: getExName(`W${week}-A-1`, '卧推 (BENCH)'), sets: 5, reps: 5, weight: bWeight.toFixed(1), rest: '3-5 min', warmUp: true, canSwap: true, original: '卧推 (BENCH)' },
          { id: `W${week}-A-2`, name: '辅助动作 (划船/引体)', sets: 3, reps: '8-12', weight: '-', rest: '1-2 min' }
        ]
      },
      {
        day: isMuscle ? '训练日 B (硬拉+推举)' : '力量维持 B (硬拉+推举)',
        exercises: [
          { id: `W${week}-B-0`, name: getExName(`W${week}-B-0`, '硬拉 (DEADLIFT)'), sets: 1, reps: 5, weight: dWeight.toFixed(1), rest: '3-5 min', warmUp: true, canSwap: true, original: '硬拉 (DEADLIFT)' },
          { id: `W${week}-B-1`, name: getExName(`W${week}-B-1`, '站姿推举 (PRESS)'), sets: 5, reps: 5, weight: (bWeight * 0.7).toFixed(1), rest: '2-3 min', warmUp: true, canSwap: true, original: '站姿推举 (PRESS)' },
          { id: `W${week}-B-2`, name: '辅助动作 (核心/小肌群)', sets: 3, reps: '10-15', weight: '-', rest: '1-2 min' }
        ]
      }
    ];
  },

  generateBodyweightPlan(week) {
    // 居家渐进：增加次数 + 动作进阶提示
    const level = week <= 4 ? '入门' : (week <= 8 ? '进阶' : '挑战');
    const pushups = 10 + (week - 1) * 2;
    const squats = 15 + (week - 1) * 3;
    
    return [
      {
        day: `自重训练 A (${level})`,
        exercises: [
          { id: `W${week}-H-A0`, name: '俯卧撑 (PUSHUPS)', sets: 3, reps: pushups, weight: '自重', rest: '1-2 min', note: week > 6 ? '可尝试钻石俯卧撑' : '' },
          { id: `W${week}-H-A1`, name: '深蹲 (SQUATS)', sets: 3, reps: squats, weight: '自重', rest: '1-2 min', note: week > 6 ? '可尝试深蹲跳' : '' },
          { id: `W${week}-H-A2`, name: '平板支撑 (PLANK)', sets: 3, reps: (45 + week * 5) + 's', weight: '自重', rest: '1 min' }
        ]
      }
    ];
  },

  generateCardioPlan(week) {
    // 渐进式有氧：心肺阶梯
    const level = week <= 4 ? '基础耐力' : (week <= 8 ? '心肺进阶' : '燃脂爆发');
    const runTime = 20 + (week - 1) * 2;
    const distance = (3 + (week - 1) * 0.3).toFixed(1);

    return [
      {
        day: `有氧 A (${level})`,
        exercises: [
          { id: `W${week}-C-A0`, name: '慢跑 (JOGGING)', sets: 1, reps: distance + ' km', weight: '持续', rest: '-', note: '控制心率在 130-150 之间' },
          { id: `W${week}-C-A1`, name: '拉伸 (STRETCH)', sets: 1, reps: '10 min', weight: '-', rest: '-' }
        ]
      },
      {
        day: `有氧 B (${level})`,
        exercises: [
          { id: `W${week}-C-B0`, name: 'HIIT (间歇训练)', sets: week + 4, reps: '30s 冲刺 / 60s 慢走', weight: '全力', rest: '1 min', note: '共 ' + (week + 4) + ' 组' }
        ]
      }
    ];
  },

  goToStrength() {
    wx.switchTab({ url: '/pages/strength/strength' });
  },

  resetAll() {
    wx.showModal({
      title: '重置',
      content: '是否清空所有数据重新推算？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          wx.switchTab({ url: '/pages/input/input' });
        }
      }
    });
  }
})