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
  if (gender === 'male') {
    return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
  } else {
    return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
  }
};

// TDEE 计算 (Activity Multiplier: 1.375 - Light exercise)
const calculateTDEE = (bmr, activityLevel = 1.375) => {
  return Math.round(bmr * activityLevel);
};

// 力量推算算法 (基于身材和训练年限)
// 估算 1RM
const estimateSBD = (gender, weight, level = 'beginner') => {
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
  return {
    squat: Math.round(weight * base.squat),
    bench: Math.round(weight * base.bench),
    deadlift: Math.round(weight * base.deadlift)
  };
};

// 力量等级判定
const getStrengthLevel = (gender, weight, total) => {
  const ratio = total / weight;
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

// 食物换算逻辑
const getFoodExchange = (macros) => {
  if (!macros) return null;
  const { protein, carb, fat } = macros;
  return {
    proteinFood: [
      { name: '鸡胸肉', amount: Math.round(protein / 0.23), unit: 'g' },
      { name: '鸡蛋', amount: Math.round(protein / 6), unit: '个' },
      { name: '蛋白粉', amount: (protein / 24).toFixed(1), unit: '勺' }
    ],
    carbFood: [
      { name: '熟米饭', amount: Math.round(carb / 0.28), unit: 'g' },
      { name: '红薯/土豆', amount: Math.round(carb / 0.2), unit: 'g' }
    ]
  };
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
  getFoodExchange
};