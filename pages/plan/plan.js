const util = require('../../utils/util.js');

Page({
  data: {
    currentWeek: 1,
    strengthData: null,
    targetData: null,
    bodyData: null,
    weeklyPlan: [],
    warmupPlan: [], // 新增：独立的热身板块
    completedTasks: {}, // { 'W1-DayA-Ex0': true }
    swappedExercises: {}, // { 'W1-A-0': 'Leg Press' }
    growthPrediction: null,
    globalProgress: 0,
    progressMatrix: [], // [{week: 1, status: 'done'}]
    timerActive: false,
    timerDisplay: '03:00',
    restTime: 0, // 休息计时
    timer: null,
    strengthLevel: { label: '未入门', ratio: '0.00', class: 'untrained' },
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
    
    if (!strengthData || !targetData || !strengthData.startRange) {
      wx.reLaunch({ url: '/pages/input/input' });
      return;
    }

    this.setData({ 
      strengthData, 
      targetData, 
      bodyData,
      completedTasks, 
      swappedExercises, 
      strengthLevel: strengthData.strengthLevel || { label: '未入门', class: 'untrained' }
    }, () => {
      this.calculateProgress();
      this.generatePlan(this.data.currentWeek);
    });
  },

  selectWeek(e) {
    const week = e.currentTarget.dataset.week;
    this.setData({ currentWeek: week });
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
      
      const splitMode = targetData.splitMode || 'full_body';
      let wMainTotal = 6; // 默认全身分化: 2天 * 3主项
      if (splitMode === 'two_split') wMainTotal = 8; // 二分化: 2天 * 4主项
      if (splitMode === 'three_split') wMainTotal = 9; // 三分化: 3天 * 3主项
      
      const wWarmupTotal = 4; // 每周独立热身板块有 4 个动作
      const wTotal = wMainTotal + wWarmupTotal;
      
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
    } else {
      plan = this.generateBodyweightPlan(week);
    }

    // 生成独立的热身计划 (全分化通用)
    const warmupPlan = [
      { id: `W${week}-WU0`, name: '动态拉伸', sets: 1, reps: '5-10分', weight: '-', restSec: 0, ...util.getExerciseDetail('动态拉伸') },
      { id: `W${week}-WU1`, name: '死虫式 (核心激活)', sets: 2, reps: '10-12次', weight: '-', restSec: 30, ...util.getExerciseDetail('死虫式') },
      { id: `W${week}-WU2`, name: '鸟狗式 (核心激活)', sets: 2, reps: '10-12次', weight: '-', restSec: 30, ...util.getExerciseDetail('鸟狗式') },
      { id: `W${week}-WU3`, name: '空杠/轻量练习', sets: 2, reps: '15次', weight: '轻量', restSec: 60, ...util.getExerciseDetail('空杠练习') }
    ];

    this.setData({ 
      weeklyPlan: plan,
      warmupPlan
    });
  },

  generateGymPlan(week, start) {
    if (!start) return [];
    const { targetData, swappedExercises, bodyData } = this.data;
    const splitMode = targetData.splitMode || 'full_body';
    const levelIndex = targetData.levelIndex || 0;
    
    const squatInc = util.getWeightIncrement(start.squatMin, bodyData.gender, bodyData.age, bodyData.bmi);
    const benchInc = util.getWeightIncrement(start.benchMin, bodyData.gender, bodyData.age, bodyData.bmi);
    const deadliftInc = util.getWeightIncrement(start.deadliftMin, bodyData.gender, bodyData.age, bodyData.bmi);

    const baseWeights = {
      squat: start.squatMin + (week - 1) * squatInc,
      bench: start.benchMin + (week - 1) * benchInc,
      deadlift: start.deadliftMin + (week - 1) * deadliftInc,
      press: (start.benchMin + (week - 1) * benchInc) * 0.65 // 推举通常为卧推的 60-70%
    };

    const getExData = (id, defaultName, baseWeight) => {
      const name = swappedExercises[id] || defaultName;
      const weightMultiplier = util.getWeightMultiplier(defaultName, name);
      const finalWeight = baseWeight ? (baseWeight * weightMultiplier).toFixed(1) : '-';
      const detail = util.getExerciseDetail(name);
      
      // 动态获取组数次数
      const scheme = this.getSetRepScheme(levelIndex, name);
      return { 
        id, 
        name, 
        weight: finalWeight, 
        ...detail,
        ...(scheme || {}) // 如果是核心项则覆盖默认组次
      };
    };

    if (splitMode === 'two_split') {
      return [
        {
          day: '训练日 A 上肢 (推+拉)',
          exercises: [
            { ...getExData(`W${week}-A-0`, '卧推', baseWeights.bench), sets: 4, reps: 6, restSec: 120 },
            { ...getExData(`W${week}-A-1`, '站姿推举', baseWeights.press), sets: 4, reps: 8, restSec: 90 },
            { ...getExData(`W${week}-A-2`, '划船'), sets: 3, reps: '8-12', weight: '-', restSec: 60 },
            { ...getExData(`W${week}-A-3`, '引体/下拉'), sets: 3, reps: '8-12', weight: '-', restSec: 60 }
          ]
        },
        {
          day: '训练日 B 下肢 (蹲+拉)',
          exercises: [
            { ...getExData(`W${week}-B-0`, '深蹲', baseWeights.squat), sets: 4, reps: 6, restSec: 180 },
            { ...getExData(`W${week}-B-1`, '硬拉', baseWeights.deadlift), sets: 1, reps: 5, restSec: 240 },
            { ...getExData(`W${week}-B-2`, '腿举/腿屈伸'), sets: 3, reps: '10-15', weight: '-', restSec: 60 },
            { ...getExData(`W${week}-B-3`, '核心/腹部'), sets: 3, reps: '15-20', weight: '-', restSec: 60 }
          ]
        }
      ];
    } else if (splitMode === 'three_split') {
      return [
        {
          day: '训练日 A 推 (Push)',
          exercises: [
            { ...getExData(`W${week}-A-0`, '卧推', baseWeights.bench), sets: 5, reps: 5, restSec: 180 },
            { ...getExData(`W${week}-A-1`, '站姿推举', baseWeights.press), sets: 3, reps: 8, restSec: 120 },
            { ...getExData(`W${week}-A-2`, '双杠/臂屈伸'), sets: 3, reps: '10-12', weight: '-', restSec: 60 }
          ]
        },
        {
          day: '训练日 B 拉 (Pull)',
          exercises: [
            { ...getExData(`W${week}-B-0`, '硬拉', baseWeights.deadlift), sets: 1, reps: 5, restSec: 300 },
            { ...getExData(`W${week}-B-1`, '杠铃划船'), sets: 4, reps: 8, weight: '-', restSec: 90 },
            { ...getExData(`W${week}-B-2`, '引体向上'), sets: 3, reps: '力竭', weight: '-', restSec: 90 }
          ]
        },
        {
          day: '训练日 C 腿 (Legs)',
          exercises: [
            { ...getExData(`W${week}-C-0`, '深蹲', baseWeights.squat), sets: 5, reps: 5, restSec: 180 },
            { ...getExData(`W${week}-C-1`, '腿举'), sets: 3, reps: '10-12', weight: '-', restSec: 90 },
            { ...getExData(`W${week}-C-2`, '核心/提踵'), sets: 3, reps: '15-20', weight: '-', restSec: 60 }
          ]
        }
      ];
    } else {
      // 默认全身分化 (Full Body A/B)
      return [
        {
          day: '训练日 A 深蹲+卧推',
          exercises: [
            { ...getExData(`W${week}-A-0`, '深蹲', baseWeights.squat), sets: 5, reps: 5, restSec: 180 },
            { ...getExData(`W${week}-A-1`, '卧推', baseWeights.bench), sets: 5, reps: 5, restSec: 180 },
            { ...getExData(`W${week}-A-2`, '划船/引体'), sets: 3, reps: '8-12', weight: '-', restSec: 60 }
          ]
        },
        {
          day: '训练日 B 硬拉+推举',
          exercises: [
            { ...getExData(`W${week}-B-0`, '硬拉', baseWeights.deadlift), sets: 1, reps: 5, restSec: 240 },
            { ...getExData(`W${week}-B-1`, '站姿推举', baseWeights.press), sets: 5, reps: 5, restSec: 120 },
            { ...getExData(`W${week}-B-2`, '核心/小肌群'), sets: 3, reps: '10-15', weight: '-', restSec: 60 }
          ]
        }
      ];
    }
  },

  getSetRepScheme(levelIndex, exerciseName) {
    // 核心项判定
    const isCore = ['深蹲', '卧推', '硬拉', '推举'].some(name => exerciseName.includes(name));
    if (!isCore) return null;

    if (levelIndex <= 1) { // 新手/初级 (0-12个月)
      if (exerciseName.includes('硬拉')) return { sets: 1, reps: 5 };
      return { sets: 5, reps: 5 };
    } else if (levelIndex === 2) { // 中级 (1-2年)
      if (exerciseName.includes('硬拉')) return { sets: 1, reps: 3 };
      return { sets: 3, reps: 5 };
    } else { // 高级 (2年以上)
      if (exerciseName.includes('硬拉')) return { sets: 2, reps: 2 };
      return { sets: 5, reps: 3 };
    }
  },

  generateBodyweightPlan(week) {
    const { targetData } = this.data;
    const level = week <= 4 ? '入门' : (week <= 8 ? '进阶' : '挑战');
    const splitMode = targetData.splitMode || 'full_body';
    
    // 动态次数逻辑
    const pushups = 10 + (week - 1) * 2;
    const squats = 15 + (week - 1) * 3;
    const lunges = 8 + Math.floor((week - 1) / 2) * 2;
    const dips = 6 + Math.floor((week - 1) / 2) * 2;
    const pikePushups = 5 + Math.floor((week - 1) / 2) * 1;
    const plankTime = (45 + week * 5) + 's';

    const getExData = (id, name, reps, sets = 3) => {
      const detail = util.getExerciseDetail(name);
      return { id, name, reps, sets, weight: '自重', restSec: 60, ...detail };
    }

    if (splitMode === 'two_split') {
      return [
        {
          day: `自重 A 上肢 (推+拉) ${level}`,
          exercises: [
            getExData(`W${week}-H-A0`, '俯卧撑', pushups, 4),
            getExData(`W${week}-H-A1`, '板凳臂屈伸', dips, 3),
            getExData(`W${week}-H-A2`, '划船/引体', '8-12', 3),
            getExData(`W${week}-H-A3`, '平板支撑', plankTime, 3)
          ]
        },
        {
          day: `自重 B 下肢 (蹲+核心) ${level}`,
          exercises: [
            getExData(`W${week}-H-B0`, '自重深蹲', squats, 4),
            getExData(`W${week}-H-B1`, '保加利亚蹲', lunges, 3),
            getExData(`W${week}-H-B2`, '仰卧起坐/卷腹', 15 + week, 3),
            getExData(`W${week}-H-B3`, '靠墙静蹲', '30-60s', 3)
          ]
        }
      ];
    } else if (splitMode === 'three_split') {
      return [
        {
          day: `自重 A 推系列 (Push) ${level}`,
          exercises: [
            getExData(`W${week}-H-A0`, '俯卧撑', pushups, 4),
            getExData(`W${week}-H-A1`, '折刀俯卧撑', pikePushups, 3),
            getExData(`W${week}-H-A2`, '板凳臂屈伸', dips, 3)
          ]
        },
        {
          day: `自重 B 拉与核心 (Pull) ${level}`,
          exercises: [
            getExData(`W${week}-H-B0`, '划船/引体', '8-12', 4),
            getExData(`W${week}-H-B1`, '仰卧起坐/卷腹', 20 + week, 3),
            getExData(`W${week}-H-B2`, '平板支撑', plankTime, 3)
          ]
        },
        {
          day: `自重 C 下肢力量 (Legs) ${level}`,
          exercises: [
            getExData(`W${week}-H-C0`, '自重深蹲', squats, 4),
            getExData(`W${week}-H-C1`, '保加利亚蹲', lunges, 3),
            getExData(`W${week}-H-C2`, '靠墙静蹲', '45-90s', 3)
          ]
        }
      ];
    } else {
      // 默认全身分化 (Full Body A/B)
      return [
        {
          day: `自重 A (推+腿) ${level}`,
          exercises: [
            getExData(`W${week}-H-A0`, '俯卧撑', pushups, 3),
            getExData(`W${week}-H-A1`, '自重深蹲', squats, 3),
            getExData(`W${week}-H-A2`, '平板支撑', plankTime, 3)
          ]
        },
        {
          day: `自重 B (拉+核心) ${level}`,
          exercises: [
            getExData(`W${week}-H-B0`, '保加利亚蹲', lunges, 3),
            getExData(`W${week}-H-B1`, '板凳臂屈伸', dips, 3),
            getExData(`W${week}-H-B2`, '仰卧起坐/卷腹', 15 + week, 3)
          ]
        }
      ];
    }
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

  toggleWarmupComplete(e) {
    wx.vibrateShort({ type: 'light' });
    const { index } = e.currentTarget.dataset;
    const warmupPlan = this.data.warmupPlan;
    const exercise = warmupPlan[index];
    
    const taskId = exercise.id;
    const completedTasks = this.data.completedTasks;
    completedTasks[taskId] = !completedTasks[taskId];
    
    this.setData({ completedTasks });
    wx.setStorageSync('completedTasks', completedTasks);
    this.calculateProgress();
  },

  toggleWarmupDetail(e) {
    const { index } = e.currentTarget.dataset;
    const warmupPlan = this.data.warmupPlan;
    warmupPlan[index].showDetail = !warmupPlan[index].showDetail;
    this.setData({ warmupPlan });
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
