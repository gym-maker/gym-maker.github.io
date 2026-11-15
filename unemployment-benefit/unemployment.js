/* 구직급여(실업급여) 계산.
   숫자는 고용보험법·시행령·최저임금 고시·고용노동부 1350에서 가져온 것만 사용합니다.
   2027 상한액 시행령 개정은 확인일(2026-11-15) 기준 찾지 못했습니다. */
(function (root) {
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(o) { return o.y + '-' + pad(o.m) + '-' + pad(o.d); }
  function parseYMD(s) {
    if (!s) return null;
    var p = String(s).split('-');
    if (p.length < 3) return null;
    var y = +p[0], m = +p[1], d = +p[2];
    if (!y || !m || !d) return null;
    if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
    return { y: y, m: m, d: d };
  }
  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function utc(o) { return Date.UTC(o.y, o.m - 1, o.d); }
  function diffDays(a, b) { return Math.round((utc(b) - utc(a)) / 86400000); }
  function cmp(a, b) { return utc(a) - utc(b); }
  function addDays(o, n) {
    var dt = new Date(Date.UTC(o.y, o.m - 1, o.d));
    dt.setUTCDate(dt.getUTCDate() + n);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }
  /* 같은 날짜로 n개월 이동. 그 달에 해당 일이 없으면 그 달 말일. */
  function addMonths(o, n) {
    var idx = o.y * 12 + (o.m - 1) + n;
    var y = Math.floor(idx / 12), m = idx - y * 12 + 1;
    return { y: y, m: m, d: Math.min(o.d, daysInMonth(y, m)) };
  }

  /* 2026·2027 적용 최저임금 (시간급). 다른 연도는 고시를 확인하지 않아 계산하지 않습니다. */
  var MIN_WAGE = { 2026: 10320, 2027: 10700 };
  /* 고용보험법 시행령 제68조 제1항. 확인일 2026-11-15 기준 현행 금액. 2027년용 개정은 미확인. */
  var BASE_CAP = 113500;
  var RATE_STANDARD = 0.6; /* 제46조 제1항 제1호 */
  var RATE_FLOOR = 0.8;    /* 제46조 제1항 제2호, 최저구직급여일액 */

  /* 고용보험법 별표 1(제50조 제1항), 이직일 2019.10.1 이후. 단위: 일.
     열: 1년 미만 / 1년 이상 3년 미만 / 3년 이상 5년 미만 / 5년 이상 10년 미만 / 10년 이상 */
  var DAYS_UNDER_50 = [120, 150, 180, 210, 240];
  var DAYS_SENIOR_OR_DISABLED = [120, 180, 210, 240, 270];

  function minWageOn(leave) {
    if (!leave) return null;
    if (Object.prototype.hasOwnProperty.call(MIN_WAGE, leave.y)) return MIN_WAGE[leave.y];
    return null;
  }

  /* 이직일 당시 만 나이. 생일 당일부터 그 나이. */
  function koreanAge(birth, onDate) {
    if (!birth || !onDate) return null;
    if (cmp(onDate, birth) < 0) return null;
    var age = onDate.y - birth.y;
    if (onDate.m < birth.m || (onDate.m === birth.m && onDate.d < birth.d)) age -= 1;
    return age;
  }

  function insuredBucket(insuredMonths) {
    if (insuredMonths == null || insuredMonths < 0) return null;
    if (insuredMonths < 12) return 0;
    if (insuredMonths < 36) return 1;
    if (insuredMonths < 60) return 2;
    if (insuredMonths < 120) return 3;
    return 4;
  }

  function durationDays(age, disabled, insuredMonths) {
    var bucket = insuredBucket(insuredMonths);
    if (bucket == null || age == null || age < 0) return null;
    var senior = !!disabled || age >= 50;
    return (senior ? DAYS_SENIOR_OR_DISABLED : DAYS_UNDER_50)[bucket];
  }

  /* 이직일을 마지막 근무일로 보고, 그다음 날을 평균임금 사유 발생일로 잡아
     퇴직금 계산기와 같은 방식으로 이전 3개월 산정기간을 셉니다.
     이직확인서의 기간이 있으면 그 일수를 쓰는 것이 우선입니다. */
  function averagePeriodFromLeave(leave) {
    if (!leave) return null;
    var reason = addDays(leave, 1);
    var end = leave;
    var start = addMonths(reason, -3);
    if (cmp(start, end) > 0) return { start: end, end: end, days: 0 };
    return { start: start, end: end, days: diffDays(start, end) + 1 };
  }

  function calc(p) {
    p = p || {};
    var leave = p.leave;
    var minWage = minWageOn(leave);
    var hours = p.hours == null ? 8 : Number(p.hours);
    var period = leave ? averagePeriodFromLeave(leave) : null;
    var periodDays = p.periodDays != null && p.periodDays !== '' ? Number(p.periodDays) : (period ? period.days : null);

    var age = p.age;
    if (age == null && p.birth && leave) age = koreanAge(p.birth, leave);
    var insuredMonths = (Number(p.insuredYears) || 0) * 12 + (Number(p.insuredMonths) || 0);
    if (p.insuredMonthsTotal != null && p.insuredMonthsTotal !== '') {
      insuredMonths = Number(p.insuredMonthsTotal);
    }
    var days = durationDays(age, p.disabled, insuredMonths);

    var dailyAvg = null;
    var wageMode = p.wageMode || 'monthly';
    if (wageMode === 'daily') {
      dailyAvg = Number(p.dailyAvg);
    } else if (wageMode === 'lump') {
      if (periodDays && periodDays > 0) dailyAvg = Number(p.threeMonthWage) / periodDays;
    } else {
      if (periodDays && periodDays > 0) dailyAvg = (Number(p.monthlyWage) || 0) * 3 / periodDays;
    }

    var err = null;
    if (!leave) err = 'leave-required';
    else if (minWage == null) err = 'year-unsupported';
    else if (!(hours > 0)) err = 'hours-required';
    else if (dailyAvg == null || !(dailyAvg >= 0) || (wageMode !== 'daily' && !(periodDays > 0))) err = 'wage-required';
    else if (age == null || age < 0) err = 'age-required';
    else if (days == null) err = 'insured-required';

    var result = {
      leave: leave,
      minWage: minWage,
      hours: hours,
      period: period,
      periodDays: periodDays,
      age: age,
      disabled: !!p.disabled,
      insuredMonths: insuredMonths,
      durationDays: days,
      wageMode: wageMode,
      dailyAvg: dailyAvg,
      dailyOrdinary: (p.dailyOrdinary != null && p.dailyOrdinary !== '') ? Number(p.dailyOrdinary) : null,
      baseCap: BASE_CAP,
      capDailyBenefit: BASE_CAP * RATE_STANDARD,
      capConfirmedForYear: leave && leave.y === 2026,
      err: err
    };

    if (err) return result;

    var rawBase = dailyAvg;
    var usedOrdinary = false;
    if (result.dailyOrdinary != null && result.dailyOrdinary > rawBase) {
      rawBase = result.dailyOrdinary;
      usedOrdinary = true;
    }

    var minBase = hours * minWage;
    var minDailyBenefit = minBase * RATE_FLOOR;
    var baseSource = 'wage'; /* 제45조 제1항~제3항 */
    var foundation = rawBase;
    if (rawBase < minBase) {
      foundation = minBase;
      baseSource = 'minimum'; /* 제45조 제4항 */
    } else if (rawBase > BASE_CAP) {
      foundation = BASE_CAP;
      baseSource = 'cap'; /* 제45조 제5항 */
    }

    var rate = baseSource === 'minimum' ? RATE_FLOOR : RATE_STANDARD;
    var dailyBenefit = foundation * rate;
    var floored = false;
    if (dailyBenefit < minDailyBenefit) {
      dailyBenefit = minDailyBenefit; /* 제46조 제2항 */
      floored = true;
    }

    result.rawBase = rawBase;
    result.usedOrdinary = usedOrdinary;
    result.minBase = minBase;
    result.minDailyBenefit = minDailyBenefit;
    result.foundation = foundation;
    result.baseSource = baseSource;
    result.rate = rate;
    result.dailyBenefitBeforeFloor = foundation * rate;
    result.floored = floored;
    result.dailyBenefit = dailyBenefit;
    result.total = dailyBenefit * days;
    result.monthly30 = dailyBenefit * 30;
    return result;
  }

  var api = {
    parseYMD: parseYMD,
    ymd: ymd,
    daysInMonth: daysInMonth,
    diffDays: diffDays,
    addDays: addDays,
    addMonths: addMonths,
    cmp: cmp,
    MIN_WAGE: MIN_WAGE,
    BASE_CAP: BASE_CAP,
    RATE_STANDARD: RATE_STANDARD,
    RATE_FLOOR: RATE_FLOOR,
    DAYS_UNDER_50: DAYS_UNDER_50,
    DAYS_SENIOR_OR_DISABLED: DAYS_SENIOR_OR_DISABLED,
    minWageOn: minWageOn,
    koreanAge: koreanAge,
    insuredBucket: insuredBucket,
    durationDays: durationDays,
    averagePeriodFromLeave: averagePeriodFromLeave,
    calc: calc
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Unemployment = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
