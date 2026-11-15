/* 육아휴직 급여 계산 (2026 기준, 현행 법령).
   숫자는 고용보험법 시행령 제95조·제95조의3·제98조와 고용노동부 안내에서
   확인한 것만 사용합니다. 2027년 상한·비율 개정은 확인일(2026-11-15) 기준
   찾지 못했고, 확인되지 않은 변경은 적용하지 않습니다. */
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
  function minDate(a, b) { return cmp(a, b) <= 0 ? a : b; }

  /* 민법 제160조(역에 의한 계산).
     시작일부터 n개월 후의 기간은, 해당일이 있으면 그 전날까지,
     해당일이 없으면 그 달 말일까지(고용노동부 1350, 답변일 2025.05.07·2026.04.20).
     예: 2026.4.5.부터 1개월 → 2026.5.4.까지. 4.5.~다음 해 4.4.가 1년. */
  function periodEndInclusive(start, nMonths) {
    var idx = start.y * 12 + (start.m - 1) + nMonths;
    var y = Math.floor(idx / 12), m = idx - y * 12 + 1;
    var dim = daysInMonth(y, m);
    if (start.d > dim) return { y: y, m: m, d: dim };
    return addDays({ y: y, m: m, d: start.d }, -1);
  }

  /* 여성고용정책과-326(2020.1.16.), 1350 답변일 2026.04.20:
     1개월에 미치지 못하는 일수는 해당 기간이 속한 1개월의 일수로 나누고,
     반올림 없이 소수점 셋째 자리까지 계산. 12개월 한도 산정에 사용. */
  function trunc3(x) {
    if (x < 0) return -Math.floor((-x) * 1000) / 1000;
    return Math.floor(x * 1000 + 1e-12) / 1000;
  }

  var FLOOR = 700000;
  /* 일반 육아휴직 상한·비율: 시행령 제95조 제1항 (개정 2024.12.24, 시행 2025.1.1). */
  var GENERAL = [
    { from: 1, to: 3, rate: 1.0, cap: 2500000 },
    { from: 4, to: 6, rate: 1.0, cap: 2000000 },
    { from: 7, to: 18, rate: 0.8, cap: 1600000 }
  ];
  /* 한부모: 시행령 제95조의3 제3항. */
  var SINGLE = [
    { from: 1, to: 3, rate: 1.0, cap: 3000000 },
    { from: 4, to: 6, rate: 1.0, cap: 2000000 },
    { from: 7, to: 18, rate: 0.8, cap: 1600000 }
  ];
  /* 6+6 부모 함께 육아휴직, 첫 6개월 상한.
     시행령 제95조의3 제1항 제1호 가~바: 부모가 각각 N개월 사용한 경우의 월별 상한.
     인덱스 0 = 첫 번째 달. 7개월째부터는 일반과 같음(제2호, 상한 160만·80%). */
  var PLUS6_CAPS = [2500000, 2500000, 3000000, 3500000, 4000000, 4500000];

  function generalRule(monthIndex) {
    for (var i = 0; i < GENERAL.length; i++) {
      if (monthIndex >= GENERAL[i].from && monthIndex <= GENERAL[i].to) return GENERAL[i];
    }
    return GENERAL[GENERAL.length - 1];
  }
  function singleRule(monthIndex) {
    for (var i = 0; i < SINGLE.length; i++) {
      if (monthIndex >= SINGLE[i].from && monthIndex <= SINGLE[i].to) return SINGLE[i];
    }
    return SINGLE[SINGLE.length - 1];
  }

  /* monthIndex는 1부터. specialMonths는 6+6이 적용되는 완전한 공통 개월 수(0~6).
     specialExtraDays는 그다음 달의 공통 잔여 일수. 그 달에는 N+1개월 상한을 일할로 적용.
     (고용24: 공통으로 사용한 기간만큼 적용. 완전한 개월만 조문에 열거되어 있어,
      잔여 일수는 다음 단계 상한을 그 달의 일수에 비례해 적용한다고 페이지에 밝힘.) */
  function ruleFor(mode, monthIndex, specialMonths, inSpecialExtra) {
    if (mode === 'single') return Object.assign({ kind: 'single' }, singleRule(monthIndex));
    if (mode === 'plus6') {
      if (monthIndex <= specialMonths && monthIndex <= 6) {
        return { from: monthIndex, to: monthIndex, rate: 1.0, cap: PLUS6_CAPS[monthIndex - 1], kind: 'plus6' };
      }
      if (inSpecialExtra && monthIndex === specialMonths + 1 && monthIndex <= 6) {
        return { from: monthIndex, to: monthIndex, rate: 1.0, cap: PLUS6_CAPS[monthIndex - 1], kind: 'plus6-partial' };
      }
      var g = generalRule(monthIndex);
      return Object.assign({ kind: 'general-after-plus6' }, g);
    }
    return Object.assign({ kind: 'general' }, generalRule(monthIndex));
  }

  function clampPay(ordinary, rate, cap) {
    var raw = ordinary * rate;
    var capped = raw > cap ? cap : raw;
    if (capped < FLOOR) return { raw: raw, amount: FLOOR, floored: true, capped: raw > cap };
    return { raw: raw, amount: capped, floored: false, capped: raw > cap };
  }

  /* 이 구간의 시작일~종료일(포함)을 민법 월 단위로 나눔.
     부분월 지급: 시행령 제95조 제3항. 일할 분모는 ‘해당 기간이 속한 1개월의 일수’
     (여성고용정책과-326, 1350 2026.04.20). 예: 2026.4.5.~5.5. = 1개월 + 1/31. */
  function splitMonths(start, end, alreadyMonths) {
    var months = [];
    var n = 1;
    alreadyMonths = alreadyMonths || 0;
    while (n <= 36) {
      var rawStart = n === 1 ? start : addDays(periodEndInclusive(start, n - 1), 1);
      if (cmp(rawStart, end) > 0) break;
      var rawEnd = periodEndInclusive(start, n);
      if (cmp(rawEnd, rawStart) < 0) break;
      var actualEnd = minDate(rawEnd, end);
      var leaveDays = diffDays(rawStart, actualEnd) + 1;
      var fullDays = diffDays(rawStart, rawEnd) + 1;
      if (leaveDays <= 0 || fullDays <= 0) break;
      months.push({
        n: n,
        monthIndex: alreadyMonths + n,
        start: rawStart,
        end: actualEnd,
        naturalEnd: rawEnd,
        leaveDays: leaveDays,
        fullDays: fullDays,
        complete: cmp(actualEnd, rawEnd) >= 0,
        fraction: leaveDays / fullDays,
        usedTowardLimit: cmp(actualEnd, rawEnd) >= 0 ? 1 : trunc3(leaveDays / fullDays)
      });
      n++;
    }
    return months;
  }

  function calc(input) {
    var ordinary = input.ordinary;
    var start = input.start;
    var end = input.end;
    var mode = input.mode || 'general'; /* general | plus6 | single */
    var alreadyMonths = input.alreadyMonths || 0;
    var commonMonths = input.commonMonths == null ? 0 : input.commonMonths;
    var commonExtraDays = input.commonExtraDays || 0;
    var employerPay = input.employerPay || 0;
    var extend18 = !!input.extend18;

    if (ordinary == null || !(ordinary >= 0)) return { err: 'wage-required' };
    if (!start || !end) return { err: 'dates-required' };
    if (cmp(end, start) < 0) return { err: 'dates-order' };
    if (alreadyMonths < 0 || alreadyMonths > 18) return { err: 'already-range' };
    if (mode === 'plus6') {
      if (commonMonths < 0 || commonMonths > 6) return { err: 'common-range' };
      if (commonExtraDays < 0) return { err: 'common-range' };
    }

    var calendarDays = diffDays(start, end) + 1;
    var rows = splitMonths(start, end, alreadyMonths);
    var specialMonths = mode === 'plus6' ? Math.min(6, Math.max(0, commonMonths)) : 0;

    var total = 0;
    var usedMonths = alreadyMonths;
    var before2025 = false;
    var outRows = [];

    for (var i = 0; i < rows.length; i++) {
      var m = rows[i];
      if (cmp(m.start, { y: 2025, m: 1, d: 1 }) < 0) before2025 = true;
      var inSpecialExtra = false;
      if (mode === 'plus6' && specialMonths < 6 && commonExtraDays > 0 && m.monthIndex === specialMonths + 1) {
        inSpecialExtra = true;
      }
      var rule = ruleFor(mode, m.monthIndex, specialMonths, inSpecialExtra);
      var pay = clampPay(ordinary, rule.rate, rule.cap);
      var monthlyAmount = pay.amount;
      var payableDays = m.leaveDays;
      var payableFraction = m.fraction;
      /* 공통 잔여 일수가 그 달의 휴직 일수보다 짧으면, 잔여 일수만 특례 상한,
         나머지 일수는 일반 상한(같은 달 안에서 나눔). */
      var parts = [];
      if (inSpecialExtra && commonExtraDays < m.leaveDays) {
        var extraDays = commonExtraDays;
        var restDays = m.leaveDays - extraDays;
        var specialPay = clampPay(ordinary, 1.0, PLUS6_CAPS[m.monthIndex - 1]);
        var general = generalRule(m.monthIndex);
        var restPay = clampPay(ordinary, general.rate, general.cap);
        var amountSpecial = specialPay.amount * (extraDays / m.fullDays);
        var amountRest = restPay.amount * (restDays / m.fullDays);
        var amount = amountSpecial + amountRest;
        parts.push({ days: extraDays, amount: amountSpecial, cap: specialPay.amount, kind: 'plus6-partial' });
        parts.push({ days: restDays, amount: amountRest, cap: restPay.amount, kind: 'general-after-plus6' });
        monthlyAmount = specialPay.amount; /* 표시용: 특례 구간 월액 */
        payableFraction = m.leaveDays / m.fullDays;
        pay = { raw: specialPay.raw, amount: amount, floored: specialPay.floored || restPay.floored, capped: specialPay.capped || restPay.capped };
      } else {
        var amount = monthlyAmount * payableFraction;
        pay = { raw: pay.raw, amount: amount, floored: pay.floored, capped: pay.capped };
      }

      var reduction = 0;
      var afterEmployer = pay.amount;
      /* 시행령 제98조: 사업주 금품 + 급여가 월 통상임금을 초과하면 초과분을 급여에서 뺀다.
         1개월 미만은 월 통상임금과 사업주 금품도 같은 일수 비율로 견줌(조문은 매월 단위이나,
         부분월에 전액을 기준으로 하면 과다 감액이 되어, 같은 비율로 맞추고 페이지에 밝힘). */
      if (employerPay > 0) {
        var wageSlice = ordinary * payableFraction;
        var employerSlice = employerPay * payableFraction;
        var sum = employerSlice + pay.amount;
        if (sum > wageSlice) {
          reduction = sum - wageSlice;
          if (reduction > pay.amount) reduction = pay.amount;
          afterEmployer = pay.amount - reduction;
        }
      }

      usedMonths += m.usedTowardLimit;
      total += afterEmployer;
      outRows.push({
        n: m.n,
        monthIndex: m.monthIndex,
        start: m.start,
        end: m.end,
        leaveDays: m.leaveDays,
        fullDays: m.fullDays,
        complete: m.complete,
        fraction: payableFraction,
        usedTowardLimit: m.usedTowardLimit,
        rate: rule.rate,
        cap: rule.cap,
        kind: rule.kind,
        monthlyAmount: monthlyAmount,
        beforeReduction: pay.amount,
        reduction: reduction,
        amount: afterEmployer,
        floored: pay.floored,
        capped: pay.capped,
        parts: parts
      });
    }

    var usedThisLeave = usedMonths - alreadyMonths;
    var eligible30 = calendarDays >= 30 || (alreadyMonths > 0 && (alreadyMonths * 30 + calendarDays) >= 30);
    /* 위 30일 합산은 분할 합산의 하한 안내일 뿐, 이전 휴직의 실제 일수를 세지는 않음. */
    var over12 = usedMonths > 12 + 1e-9;
    var over18 = usedMonths > 18 + 1e-9;

    return {
      err: null,
      ordinary: ordinary,
      start: start,
      end: end,
      mode: mode,
      alreadyMonths: alreadyMonths,
      commonMonths: specialMonths,
      commonExtraDays: commonExtraDays,
      employerPay: employerPay,
      extend18: extend18,
      calendarDays: calendarDays,
      rows: outRows,
      total: total,
      usedThisLeave: usedThisLeave,
      usedMonths: usedMonths,
      eligible30: calendarDays >= 30,
      over12: over12,
      over18: over18,
      before2025: before2025,
      deferredAbolished: true, /* 제95조 제4항 삭제, 2025.1.1. 이후 사용 기간은 전액 지급 */
      floor: FLOOR
    };
  }

  var api = {
    parseYMD: parseYMD,
    ymd: ymd,
    daysInMonth: daysInMonth,
    diffDays: diffDays,
    addDays: addDays,
    cmp: cmp,
    periodEndInclusive: periodEndInclusive,
    trunc3: trunc3,
    splitMonths: splitMonths,
    clampPay: clampPay,
    ruleFor: ruleFor,
    generalRule: generalRule,
    singleRule: singleRule,
    FLOOR: FLOOR,
    GENERAL: GENERAL,
    SINGLE: SINGLE,
    PLUS6_CAPS: PLUS6_CAPS,
    calc: calc
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ParentalLeave = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
