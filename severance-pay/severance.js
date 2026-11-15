/* 퇴직금 계산 (근로자퇴직급여 보장법 제8조, 근로기준법 제2조).
   숫자는 법령·고용노동부 예제·국세청 사례에서 가져온 것만 사용합니다. */
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
  /* 같은 날짜로 n개월 이동. 그 달에 해당 일이 없으면 그 달 말일 (고용노동부 1350, 2026.07.20: 5.29 퇴사 → 2.28). */
  function addMonths(o, n) {
    var idx = o.y * 12 + (o.m - 1) + n;
    var y = Math.floor(idx / 12), m = idx - y * 12 + 1;
    return { y: y, m: m, d: Math.min(o.d, daysInMonth(y, m)) };
  }
  function addYears(o, n) {
    var y = o.y + n;
    return { y: y, m: o.m, d: Math.min(o.d, daysInMonth(y, o.m)) };
  }

  /* 평균임금 산정기간: 퇴사일(사유발생일) 당일은 빼고, 전날부터 퇴사일 빼기 3개월. */
  function averagePeriod(retire) {
    var end = addDays(retire, -1);
    var start = addMonths(retire, -3);
    if (cmp(start, end) > 0) return { start: end, end: end, days: 0 };
    return { start: start, end: end, days: diffDays(start, end) + 1 };
  }

  function monthSegments(start, end) {
    var segs = [], cur = start;
    while (cmp(cur, end) <= 0) {
      var monthEnd = { y: cur.y, m: cur.m, d: daysInMonth(cur.y, cur.m) };
      var segEnd = cmp(monthEnd, end) <= 0 ? monthEnd : end;
      segs.push({
        start: cur,
        end: segEnd,
        days: diffDays(cur, segEnd) + 1,
        monthDays: daysInMonth(cur.y, cur.m)
      });
      cur = addDays(segEnd, 1);
    }
    return segs;
  }

  function prorate(monthly, days, monthDays) {
    if (!monthDays) return 0;
    return monthly * days / monthDays;
  }

  /* 재직일수 = 퇴사일 − 입사일 (고용노동부 예제: 2014.10.2~2017.9.16 = 1,080일). */
  function serviceDays(hire, retire) { return diffDays(hire, retire); }

  /* 계속근로 1년: 퇴사일이 입사 1주년과 같거나 이후. 2월 29일 입사는 평년이면 2월 28일. */
  function isEligible(hire, retire) { return cmp(retire, addYears(hire, 1)) >= 0; }

  /* 소득세법 시행규칙 별지 제40호의2서식 작성방법: 1월 미만 일수는 1월, 1년 미만 월수는 1년.
     입사일부터 마지막 근무일(퇴사일 전날)까지. 소득세법 제48조: 1년 미만 기간은 1년으로 봄. */
  function taxServiceYears(hire, retire) {
    var end = addDays(retire, -1);
    if (cmp(end, hire) < 0) return 0;
    var y = end.y - hire.y;
    var m = end.m - hire.m;
    var d = end.d - hire.d;
    if (d > 0) m += 1;
    if (m < 0) { y -= 1; m += 12; }
    if (m >= 12) { y += 1; m -= 12; }
    if (m > 0) y += 1;
    return Math.max(y, 1);
  }

  /* 소득세법 제48조 제1항 제1호 (2023.1.1 이후 퇴직, 국세청 퇴직소득 안내와 동일). */
  function yearsDeduction(years) {
    if (years <= 5) return years * 1000000;
    if (years <= 10) return 5000000 + (years - 5) * 2000000;
    if (years <= 20) return 15000000 + (years - 10) * 2500000;
    return 40000000 + (years - 20) * 3000000;
  }

  /* 소득세법 제48조 제1항 제2호 (국세청 퇴직소득 안내와 동일). */
  function convertedPayDeduction(converted) {
    if (converted <= 8000000) return converted;
    if (converted <= 70000000) return 8000000 + (converted - 8000000) * 0.6;
    if (converted <= 100000000) return 45200000 + (converted - 70000000) * 0.55;
    if (converted <= 300000000) return 61700000 + (converted - 100000000) * 0.45;
    return 151700000 + (converted - 300000000) * 0.35;
  }

  /* 소득세법 제55조 제1항 기본세율 (국세청 퇴직소득 안내 표와 동일). */
  function basicTax(base) {
    if (base <= 0) return 0;
    if (base <= 14000000) return base * 0.06;
    if (base <= 50000000) return base * 0.15 - 1260000;
    if (base <= 88000000) return base * 0.24 - 5760000;
    if (base <= 150000000) return base * 0.35 - 15440000;
    if (base <= 300000000) return base * 0.38 - 19940000;
    if (base <= 500000000) return base * 0.40 - 25940000;
    if (base <= 1000000000) return base * 0.42 - 35940000;
    return base * 0.45 - 65940000;
  }

  /* 단순 일시금 추정. 중간정산·IRP 이연·비과세는 반영하지 않음.
     산출세액은 원 단위 반올림. 국세청 홍길동 사례(1억, 20년 → 1,120,000원)로 검증. */
  function retirementIncomeTax(pay, years) {
    years = Math.max(0, years | 0);
    pay = Math.max(0, pay);
    if (!years || !pay) {
      return {
        years: years, pay: pay, yearsDeduction: 0, afterYears: 0,
        converted: 0, convertedDeduction: 0, taxBase: 0,
        convertedTax: 0, incomeTax: 0, localTax: 0, totalTax: 0
      };
    }
    var yd = yearsDeduction(years);
    if (pay < yd) yd = pay; /* 제48조 제2항 */
    var after = pay - yd;
    var converted = after * 12 / years;
    var cd = convertedPayDeduction(converted);
    var base = Math.max(0, converted - cd);
    var convTax = basicTax(base);
    var incomeTax = Math.round(convTax / 12 * years);
    var localTax = Math.round(incomeTax * 0.1);
    return {
      years: years, pay: pay, yearsDeduction: yd, afterYears: after,
      converted: converted, convertedDeduction: cd, taxBase: base,
      convertedTax: convTax, incomeTax: incomeTax, localTax: localTax,
      totalTax: incomeTax + localTax
    };
  }

  function calc(input) {
    var hire = input.hire, retire = input.retire;
    if (!hire || !retire) throw Object.assign(new Error('dates-required'), { code: 'dates-required' });
    if (cmp(retire, hire) <= 0) throw Object.assign(new Error('dates-order'), { code: 'dates-order' });

    var days = serviceDays(hire, retire);
    var eligible = isEligible(hire, retire);
    var lastWork = addDays(retire, -1);
    var period = averagePeriod(retire);
    var segs = monthSegments(period.start, period.end);

    var annualBonus = Math.max(0, +input.annualBonus || 0);
    var leavePay = Math.max(0, +input.leavePay || 0);
    var bonusAdd = annualBonus * 3 / 12;
    var leaveAdd = leavePay * 3 / 12;

    var wageTotal = 0, wageMode = input.wageMode || 'monthly';
    var basicTotal = 0, allowTotal = 0;
    if (wageMode === 'lump') {
      wageTotal = Math.max(0, +input.threeMonthWage || 0);
    } else {
      var basic = Math.max(0, +input.monthlyBasic || 0);
      var allow = Math.max(0, +input.monthlyAllowance || 0);
      segs.forEach(function (s) {
        s.basic = prorate(basic, s.days, s.monthDays);
        s.allowance = prorate(allow, s.days, s.monthDays);
        basicTotal += s.basic;
        allowTotal += s.allowance;
      });
      wageTotal = basicTotal + allowTotal;
    }

    var numerator = wageTotal + bonusAdd + leaveAdd;
    var dailyAvg = period.days ? numerator / period.days : 0;
    var dailyOrd = input.dailyOrdinary == null || input.dailyOrdinary === ''
      ? null
      : Math.max(0, +input.dailyOrdinary);
    var usedOrdinary = dailyOrd != null && dailyOrd > dailyAvg;
    var dailyUsed = usedOrdinary ? dailyOrd : dailyAvg;
    var severanceExact = dailyUsed * 30 * days / 365;
    var severance = Math.round(severanceExact);
    var taxYears = taxServiceYears(hire, retire);
    var tax = retirementIncomeTax(severance, taxYears);

    return {
      hire: hire, retire: retire, lastWork: lastWork,
      serviceDays: days, eligible: eligible,
      period: period, segments: segs, wageMode: wageMode,
      basicTotal: basicTotal, allowTotal: allowTotal, wageTotal: wageTotal,
      annualBonus: annualBonus, leavePay: leavePay,
      bonusAdd: bonusAdd, leaveAdd: leaveAdd, numerator: numerator,
      dailyAvg: dailyAvg, dailyOrdinary: dailyOrd,
      usedOrdinary: usedOrdinary, dailyUsed: dailyUsed,
      severanceExact: severanceExact, severance: severance,
      taxYears: taxYears, tax: tax
    };
  }

  var api = {
    pad: pad, ymd: ymd, parseYMD: parseYMD, daysInMonth: daysInMonth,
    diffDays: diffDays, addDays: addDays, addMonths: addMonths, addYears: addYears,
    averagePeriod: averagePeriod, monthSegments: monthSegments, prorate: prorate,
    serviceDays: serviceDays, isEligible: isEligible,
    taxServiceYears: taxServiceYears, yearsDeduction: yearsDeduction,
    convertedPayDeduction: convertedPayDeduction, basicTax: basicTax,
    retirementIncomeTax: retirementIncomeTax, calc: calc
  };
  root.Severance = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
