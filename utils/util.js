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
  let activityLevel = 1.375; 
  if (bmi > 30) activityLevel = 1.2; 
  
  const baseTDEE = Math.round(bmr * activityLevel);
  
  // 专注增肌塑形：默认提供热量盈余支持
  return baseTDEE + 250;
};

// 力量推算算法 (基于身材和训练年限) - 4.0 升级：引入 BMI 风险对冲
const estimateSBD = (gender, weight, bmi, age = 25, level = 'beginner') => {
  // 严谨性：参数校验
  if (!weight || !bmi) return { squat: 0, bench: 0, deadlift: 0, isBMIRisk: false };

  // 力量系数矩阵：根据性别与训练阶段动态匹配
  const ratios = {
    male: {
      beginner: { squat: 0.8, bench: 0.6, deadlift: 1.0 },     // 新手 0-6月
      novice: { squat: 1.0, bench: 0.75, deadlift: 1.25 },    // 初级 6-12月
      intermediate: { squat: 1.2, bench: 0.9, deadlift: 1.5 }, // 中级 1-2年
      advanced: { squat: 1.5, bench: 1.1, deadlift: 1.8 }     // 高级 2年以上
    },
    female: {
      beginner: { squat: 0.5, bench: 0.3, deadlift: 0.7 },
      novice: { squat: 0.65, bench: 0.4, deadlift: 0.85 },
      intermediate: { squat: 0.8, bench: 0.5, deadlift: 1.0 },
      advanced: { squat: 1.0, bench: 0.65, deadlift: 1.3 }
    }
  };
  
  const base = ratios[gender][level];
  
  // BMI 风险对冲：如果 BMI 过高（肥胖），推算重量时按 BMI 24 的理想体重计算，防止关节超负荷
  let calculationWeight = weight;
  let isBMIRisk = false;
  if (bmi > 28) {
    const height = Math.sqrt(weight / bmi); // 逆推身高(m)
    calculationWeight = 24 * (height * height); // 理想健康体重
    isBMIRisk = true;
  }

  // 严谨性：针对年龄 > 50 岁的人群，额外降低 20% 起步重量
  const ageFactor = age > 50 ? 0.8 : 1.0;

  return {
    squat: Math.round(calculationWeight * base.squat * ageFactor),
    bench: Math.round(calculationWeight * base.bench * ageFactor),
    deadlift: Math.round(calculationWeight * base.deadlift * ageFactor),
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

  const ratio = Number((total / calculationWeight).toFixed(2));
  let level = { label: '未入门', class: 'untrained', ratio };
  
  if (gender === 'male') {
    if (ratio >= 3.5) level = { label: '精英', class: 'elite', ratio };
    else if (ratio >= 2.5) level = { label: '初级', class: 'intermediate', ratio };
    else if (ratio >= 1.5) level = { label: '新手', class: 'novice', ratio };
  } else {
    if (ratio >= 2.5) level = { label: '精英', class: 'elite', ratio };
    else if (ratio >= 1.8) level = { label: '初级', class: 'intermediate', ratio };
    else if (ratio >= 1.0) level = { label: '新手', class: 'novice', ratio };
  }
  return level;
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

// 5.0：微量加重步进逻辑 (增加年龄与 BMI 因子)
const getWeightIncrement = (currentWeight, gender, age = 25, bmi = 22) => {
  let baseInc = 2.5;
  if (currentWeight < 30) baseInc = gender === 'female' ? 0.5 : 1.0;
  else if (currentWeight < 60) baseInc = 1.25;
  
  // 针对 50 岁以上或 BMI > 30 人群，加重减半，侧重稳健
  if (age > 50 || bmi > 30) return baseInc * 0.5;
  return baseInc;
};

// 动作要领提示与退阶/进阶建议 (4.0 增强版)
const getExerciseDetail = (name) => {
  const details = {
    '深蹲': {
      tip: '脚跟踩死，挺胸抬头，膝盖指向脚尖。',
      regression: '手扶椅背深蹲',
      progression: '暂停深蹲'
    },
    '卧推': {
      tip: '肩胛收紧，双脚蹬地，杠铃落点中胸。',
      regression: '俯卧撑',
      progression: '哑铃卧推'
    },
    '硬拉': {
      tip: '背部挺直，杠铃贴腿，腹压收紧。',
      regression: '架上拉 (Rack Pull)',
      progression: '相扑硬拉'
    },
    '站姿推举': {
      tip: '核心收紧，不要过度后仰，手臂伸直锁死。',
      regression: '坐姿哑铃推举',
      progression: '暂停推举'
    },
    '划船': {
      tip: '拉向肚脐方向，挤压背部肌肉。',
      regression: '单臂哑铃划船',
      progression: '杠铃划船'
    },
    '引体/下拉': {
      tip: '挺胸，肩胛下压，感受背阔肌发力。',
      regression: '高位下拉',
      progression: '负重引体'
    },
    '腿举/腿屈伸': {
      tip: '控制离心下放，不要完全锁死膝盖。',
      regression: '自重深蹲',
      progression: '大重量腿举'
    },
    '核心/腹部': {
      tip: '缓慢控制，感受腹肌卷缩。',
      regression: '卷腹',
      progression: '悬垂举腿'
    },
    '双杠/臂屈伸': {
      tip: '身体正直，手肘紧贴。',
      regression: '板凳臂屈伸',
      progression: '负重双杠'
    },
    '杠铃划船': {
      tip: '背部与地面平行，拉向小腹。',
      regression: '哑铃划船',
      progression: '潘德雷划船'
    },
    '引体向上': {
      tip: '完全拉起，完全下放。',
      regression: '弹力带引体',
      progression: '负重引体'
    },
    '腿举': {
      tip: '脚掌踩实踏板，缓慢下放。',
      regression: '箭步蹲',
      progression: '大重量腿举'
    },
    '核心/提踵': {
      tip: '脚尖发力，顶峰停顿。',
      regression: '平地提踵',
      progression: '负重提踵'
    },
    '划船/引体': {
      tip: '肩胛收紧，感受背部肌肉拉伸。',
      regression: '高位下拉',
      progression: '负重引体向上'
    },
    '核心/小肌群': {
      tip: '动作平稳，不要借力，专注于目标肌肉。',
      regression: '器械动作',
      progression: '自由重量进阶'
    },
    '动态拉伸': {
      tip: '活动关节，增加血流量。',
      regression: '原地踏步',
      progression: '大幅度摆动'
    },
    '猫式伸展': {
      tip: '感受脊柱逐节活动，配合呼吸。',
      regression: '小范围活动',
      progression: '结合胸椎旋转'
    },
    '死虫式': {
      tip: '下背部紧贴地面，保持腹压。',
      regression: '单腿下放',
      progression: '负重死虫式'
    },
    '鸟狗式': {
      tip: '身体保持稳定不晃动，对侧肢体延伸。',
      regression: '仅移动腿部',
      progression: '结合膝肘触碰'
    },
    '空杠练习': {
      tip: '专注于动作轨迹和肌肉发力感。',
      regression: '木棍练习',
      progression: '轻重量进阶'
    },
    '俯卧撑': {
      tip: '核心收紧如平板，身体呈直线。',
      regression: '跪姿俯卧撑',
      progression: '钻石俯卧撑'
    },
    '自重深蹲': {
      tip: '重心在足底，背部挺直。',
      regression: '半程深蹲',
      progression: '深蹲跳'
    },
    '平板支撑': {
      tip: '收紧核心，不要塌腰。身体呈一直线。',
      regression: '支撑位保持',
      progression: '负重平板支撑'
    },
    '慢跑': {
      tip: '控制心率在 130-150 之间，小步快频。',
      regression: '快走',
      progression: '变速跑'
    },
    '拉伸': {
      tip: '感受肌肉拉伸感，不要憋气。',
      regression: '动态活动',
      progression: '深度瑜伽'
    },
    '保加利亚蹲': {
      tip: '后脚垫高，前脚下蹲，感受臀腿拉伸。',
      regression: '箭步蹲',
      progression: '负重保加利亚蹲'
    },
    '板凳臂屈伸': {
      tip: '双手支撑在板凳边缘，手肘向后。',
      regression: '靠墙臂屈伸',
      progression: '负重板凳臂屈伸'
    },
    '仰卧起坐/卷腹': {
      tip: '腹肌发力卷起，不要拉脖子。',
      regression: '半程卷腹',
      progression: '悬垂举腿'
    },
    '折刀俯卧撑': {
      tip: '臀部抬高，身体呈倒 V 型，头向手前方下落。',
      regression: '高位俯卧撑',
      progression: '倒立撑'
    },
    '靠墙静蹲': {
      tip: '背部贴墙，大腿与地面平行，膝盖不超脚尖。',
      regression: '高位静蹲',
      progression: '单腿静蹲'
    },
    'HIIT 间歇训练': {
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
  getWeightMultiplier,
  getWeightIncrement,
  getExerciseDetail
};