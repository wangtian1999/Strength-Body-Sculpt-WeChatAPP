// utils/util.js

// BMI 计算
const calculateBMI = (weight, height) => {
  const h = height / 100;
  return Number((weight / (h * h)).toFixed(1));
};

// 体脂率估算 (基于 BMI)
const estimateBodyFat = (gender, age, bmi) => {
  const genderFactor = gender === 'male' ? 1 : 0;
  const bf = (1.20 * bmi) + (0.23 * age) - (10.8 * genderFactor) - 5.4;
  return Number(Math.max(3, bf).toFixed(1)); // 最低保留 3%
};

// 瘦体重 (LBM) 计算
const calculateLBM = (weight, bodyFat) => {
  return Number((weight * (1 - bodyFat / 100)).toFixed(1));
};

// BMR 计算 (Mifflin-St Jeor Equation)
const calculateBMR = (gender, weight, height, age) => {
  // 严谨性：输入边界检查
  const w = Math.max(30, weight);
  const h = Math.max(100, height);
  const a = Math.max(15, age);

  if (gender === 'male') {
    return Math.round(10 * w + 6.25 * h - 5 * a + 5);
  } else {
    return Math.round(10 * w + 6.25 * h - 5 * a - 161);
  }
};

// TDEE 计算 (根据 BMI 自动调整活动系数)
const calculateTDEE = (bmr, bmi) => {
  // 如果 BMI 过高，活动系数应更保守
  let activityLevel = 1.375; // Lightly active (default)
  if (bmi > 30) activityLevel = 1.2; // Sedentary for high BMI to prevent overestimation
  return Math.round(bmr * activityLevel);
};

// 力量推算算法 (基于身材和训练年限) - 4.0 升级：引入 BMI 风险对冲
const estimateSBD = (gender, weight, bmi, level = 'beginner') => {
  // 严谨性：参数校验
  if (!weight || !bmi) return { squat: 0, bench: 0, deadlift: 0, isBMIRisk: false };

  // 简易系数，仅作起步参考
  const ratios = {
    male: {
      beginner: { squat: 0.8, bench: 0.6, deadlift: 1.0 },
      intermediate: { squat: 1.2, bench: 0.9, deadlift: 1.5 }
    },
    female: {
      beginner: { squat: 0.5, bench: 0.3, deadlift: 0.7 },
      intermediate: { squat: 0.8, bench: 0.5, deadlift: 1.0 }
    }
  };
  
  const base = ratios[gender][level];
  
  // BMI 风险对冲：如果 BMI 过高（肥胖），推算重量时按 BMI 25 的理想体重计算，防止关节超负荷
  let calculationWeight = weight;
  let isBMIRisk = false;
  if (bmi > 28) {
    const height = Math.sqrt(weight / bmi); // 逆推身高(m)
    calculationWeight = 25 * (height * height); // 理想上限体重
    isBMIRisk = true;
  }

  return {
    squat: Math.round(calculationWeight * base.squat),
    bench: Math.round(calculationWeight * base.bench),
    deadlift: Math.round(calculationWeight * base.deadlift),
    isBMIRisk
  };
};

// 力量等级判定
const getStrengthLevel = (gender, weight, bmi, total) => {
  // 对于高 BMI 人群，等级判定也应参考理想体重比例
  let calculationWeight = weight;
  if (bmi > 28) {
    const height = Math.sqrt(weight / bmi);
    calculationWeight = 25 * (height * height);
  }

  const ratio = total / calculationWeight;
  if (gender === 'male') {
    if (ratio < 1.5) return { label: '未入门', class: 'untrained' };
    if (ratio < 2.5) return { label: '新手', class: 'novice' };
    if (ratio < 3.5) return { label: '初级', class: 'intermediate' };
    return { label: '精英', class: 'elite' };
  } else {
    if (ratio < 1.0) return { label: '未入门', class: 'untrained' };
    if (ratio < 1.8) return { label: '新手', class: 'novice' };
    if (ratio < 2.5) return { label: '初级', class: 'intermediate' };
    return { label: '精英', class: 'elite' };
  }
};

// Wilks 分数计算 (极简近似版)
const calculateWilks = (gender, weight, total) => {
  // 简化系数，仅作参考
  const a = gender === 'male' ? 500 : 600;
  return Math.round(total * (a / weight));
};

// 动作重量折算系数
const getWeightMultiplier = (original, target) => {
  const map = {
    '哑铃卧推 (DB Bench)': 0.8,
    '器械推胸 (Chest Press)': 1.2,
    '腿举 (Leg Press)': 2.5,
    '哈克深蹲 (Hack Squat)': 1.5,
    '相扑硬拉 (Sumo DL)': 1.0,
    '罗马尼亚硬拉 (RDL)': 0.8,
    '哑铃推举 (DB Press)': 0.7,
    '坐姿推举 (Seated Press)': 1.1,
    '哑铃划船 (DB Row)': 0.6,
    '高位下拉 (Lat Pulldown)': 0.8
  };
  return map[target] || 1.0;
};

// 5.0：微量加重步进逻辑
const getWeightIncrement = (currentWeight, gender) => {
  if (currentWeight < 30) return gender === 'female' ? 0.5 : 1.0;
  if (currentWeight < 60) return 1.25;
  return 2.5;
};

// 5.0：恢复状态调整逻辑 (Energy Score 1-5)
const getRecoveryAdjustment = (score) => {
  const map = {
    1: { weightMult: 0.8, setsMult: 0.5, label: '极度疲劳：建议减载/休息' },
    2: { weightMult: 0.9, setsMult: 0.7, label: '状态欠佳：适当降容' },
    3: { weightMult: 1.0, setsMult: 1.0, label: '状态正常：按计划进行' },
    4: { weightMult: 1.0, setsMult: 1.2, label: '状态良好：尝试多做一组' },
    5: { weightMult: 1.05, setsMult: 1.2, label: '状态爆表：建议小幅冲击' }
  };
  return map[score] || map[3];
};

// 食物换算逻辑 (5.0 增加分类)
const getFoodExchange = (macros, type = 'meat') => {
  if (!macros) return null;
  const { protein, carb } = macros;
  
  const proteinSources = {
    meat: [
      { name: '鸡胸肉', amount: Math.round(protein / 0.23), unit: 'g' },
      { name: '瘦牛肉', amount: Math.round(protein / 0.20), unit: 'g' },
      { name: '鱼肉/虾', amount: Math.round(protein / 0.18), unit: 'g' }
    ],
    dairy: [
      { name: '鸡蛋', amount: Math.round(protein / 6), unit: '个' },
      { name: '希腊酸奶', amount: Math.round(protein / 0.1), unit: 'g' },
      { name: '蛋白粉', amount: (protein / 24).toFixed(1), unit: '勺' }
    ],
    vege: [
      { name: '北豆腐', amount: Math.round(protein / 0.12), unit: 'g' },
      { name: '大豆/豌豆', amount: Math.round(protein / 0.3), unit: 'g' },
      { name: '素鸡', amount: Math.round(protein / 0.15), unit: 'g' }
    ]
  };

  return {
    proteinFood: proteinSources[type] || proteinSources.meat,
    carbFood: [
      { name: '熟米饭', amount: Math.round(carb / 0.28), unit: 'g' },
      { name: '燕麦/面条', amount: Math.round(carb / 0.6), unit: 'g' },
      { name: '红薯/土豆', amount: Math.round(carb / 0.2), unit: 'g' }
    ]
  };
};

// 动作要领提示与退阶/进阶建议 (4.0 增强版)
const getExerciseDetail = (name) => {
  const details = {
    '深蹲 (SQUAT)': {
      tip: '脚跟踩死，挺胸抬头，膝盖指向脚尖。',
      regression: '手扶椅背深蹲',
      progression: '暂停深蹲'
    },
    '卧推 (BENCH)': {
      tip: '肩胛收紧，双脚蹬地，杠铃落点中胸。',
      regression: '俯卧撑',
      progression: '哑铃卧推'
    },
    '硬拉 (DEADLIFT)': {
      tip: '背部挺直，杠铃贴腿，腹压收紧。',
      regression: '架上拉 (Rack Pull)',
      progression: '相扑硬拉'
    },
    '俯卧撑 (PUSHUPS)': {
      tip: '核心收紧如平板，身体呈直线。',
      regression: '跪姿俯卧撑',
      progression: '钻石俯卧撑'
    },
    '自重深蹲 (SQUATS)': {
      tip: '重心在足底，背部挺直。',
      regression: '半程深蹲',
      progression: '深蹲跳'
    },
    '慢跑 (JOGGING)': {
      tip: '控制心率在 130-150 之间，小步快频。',
      regression: '快走',
      progression: '变速跑'
    },
    '拉伸 (STRETCH)': {
      tip: '感受肌肉拉伸感，不要憋气。',
      regression: '动态活动',
      progression: '深度瑜伽'
    },
    'HIIT (间歇训练)': {
      tip: '冲刺时全力以赴，间歇时深呼吸。',
      regression: '中强度有氧',
      progression: 'Tabata'
    }
  };
  return details[name] || { tip: '', regression: '', progression: '' };
};

module.exports = {
  calculateBMI,
  estimateBodyFat,
  calculateLBM,
  calculateBMR,
  calculateTDEE,
  estimateSBD,
  getStrengthLevel,
  calculateWilks,
  getFoodExchange,
  getWeightMultiplier,
  getWeightIncrement,
  getRecoveryAdjustment,
  getExerciseDetail
};