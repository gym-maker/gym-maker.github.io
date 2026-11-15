(function (root) {
  'use strict';

  var RATE_CREDIT = 0.15;
  var RATE_DEBIT = 0.30;
  var RATE_CULTURE = 0.30;
  var RATE_MARKET = 0.40;
  var RATE_TRANSIT = 0.40;
  var THRESHOLD_RATE = 0.25;
  var SALARY_CUTOFF = 70000000;

  function num(v) {
    var n = Number(v);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  }

  function childrenBucket(children) {
    var n = Math.floor(num(children));
    if (n >= 2) return 2;
    if (n >= 1) return 1;
    return 0;
  }

  function threshold(salary) {
    return num(salary) * THRESHOLD_RATE;
  }

  function baseLimit(salary, children) {
    var bucket = childrenBucket(children);
    if (num(salary) <= SALARY_CUTOFF) {
      return [3000000, 3500000, 4000000][bucket];
    }
    return [2500000, 2750000, 3000000][bucket];
  }

  function additionalCap(salary) {
    return num(salary) <= SALARY_CUTOFF ? 3000000 : 2000000;
  }

  function isLowSalary(salary) {
    return num(salary) <= SALARY_CUTOFF;
  }

  /**
   * Split inputs into the exclusive statutory buckets.
   * credit/debit/market/transit/culture are assumed already exclusive
   * (as on the year-end tax simplification statement).
   * If salary exceeds 70 million, culture is not a separate 30% item
   * and is added to credit or debit according to culturePayMethod.
   */
  function buckets(input) {
    input = input || {};
    var salary = num(input.salary);
    var credit = num(input.credit);
    var debit = num(input.debit);
    var market = num(input.market);
    var transit = num(input.transit);
    var culture = num(input.culture);
    var low = isLowSalary(salary);
    var method = input.culturePayMethod === 'debit' ? 'debit' : 'credit';
    var creditSep = credit;
    var debitSep = debit;
    var cultureSep = 0;
    var cultureReclassified = false;
    if (low) {
      cultureSep = culture;
    } else if (culture > 0) {
      cultureReclassified = true;
      if (method === 'debit') debitSep += culture;
      else creditSep += culture;
    }
    return {
      salary: salary,
      children: childrenBucket(input.children),
      credit: credit,
      debit: debit,
      market: market,
      transit: transit,
      culture: culture,
      culturePayMethod: method,
      lowSalary: low,
      creditSep: creditSep,
      debitSep: debitSep,
      cultureSep: cultureSep,
      cultureReclassified: cultureReclassified,
      total: credit + debit + market + transit + culture
    };
  }

  function subtractAmount(b, minUse) {
    var creditSep = b.creditSep;
    var mid = b.debitSep + b.cultureSep;
    if (minUse <= creditSep) {
      return {
        caseId: 'ga',
        amount: minUse * RATE_CREDIT
      };
    }
    if (minUse <= creditSep + mid) {
      return {
        caseId: 'na',
        amount: creditSep * RATE_CREDIT + (minUse - creditSep) * RATE_DEBIT
      };
    }
    return {
      caseId: b.lowSalary ? 'da-low' : 'da-high',
      amount: creditSep * RATE_CREDIT
        + mid * RATE_DEBIT
        + (minUse - creditSep - mid) * RATE_MARKET
    };
  }

  function calc(input) {
    var b = buckets(input);
    var minUse = threshold(b.salary);
    var marketDed = b.market * RATE_MARKET;
    var transitDed = b.transit * RATE_TRANSIT;
    var cultureDed = b.cultureSep * RATE_CULTURE;
    var debitDed = b.debitSep * RATE_DEBIT;
    var creditDed = b.creditSep * RATE_CREDIT;
    var gross = marketDed + transitDed + cultureDed + debitDed + creditDed;
    var sub = subtractAmount(b, minUse);
    var exceedsThreshold = b.total > minUse;
    var preLimit = 0;
    if (exceedsThreshold) {
      preLimit = gross - sub.amount;
      if (preLimit < 0) preLimit = 0;
    }
    var base = baseLimit(b.salary, b.children);
    var cap = additionalCap(b.salary);
    var specialSum = marketDed + transitDed + cultureDed;
    var specialCapped = specialSum < cap ? specialSum : cap;
    var excess = preLimit > base ? preLimit - base : 0;
    var additional = 0;
    if (excess > 0) {
      additional = excess < specialCapped ? excess : specialCapped;
    }
    var deduction = (preLimit < base ? preLimit : base) + additional;
    return {
      salary: b.salary,
      children: b.children,
      lowSalary: b.lowSalary,
      creditSep: b.creditSep,
      debitSep: b.debitSep,
      cultureSep: b.cultureSep,
      market: b.market,
      transit: b.transit,
      culture: b.culture,
      cultureReclassified: b.cultureReclassified,
      culturePayMethod: b.culturePayMethod,
      total: b.total,
      threshold: minUse,
      remainingToThreshold: b.total >= minUse ? 0 : minUse - b.total,
      exceedsThreshold: exceedsThreshold,
      rates: {
        credit: RATE_CREDIT,
        debit: RATE_DEBIT,
        culture: RATE_CULTURE,
        market: RATE_MARKET,
        transit: RATE_TRANSIT
      },
      itemDeductions: {
        credit: creditDed,
        debit: debitDed,
        culture: cultureDed,
        market: marketDed,
        transit: transitDed
      },
      gross: gross,
      subtractCase: sub.caseId,
      subtract: sub.amount,
      preLimit: preLimit,
      baseLimit: base,
      additionalCap: cap,
      specialSum: specialSum,
      specialCapped: specialCapped,
      additional: additional,
      deduction: deduction,
      hitBaseLimit: preLimit > base,
      hitAdditionalCap: additional > 0 && additional === cap,
      consumptionIncreaseApplies: false
    };
  }

  function withExtra(input, field, amount) {
    var next = {
      salary: input.salary,
      children: input.children,
      credit: num(input.credit),
      debit: num(input.debit),
      market: num(input.market),
      transit: num(input.transit),
      culture: num(input.culture),
      culturePayMethod: input.culturePayMethod
    };
    next[field] = num(next[field]) + num(amount);
    return calc(next);
  }

  function compareExtra(input, amount) {
    var base = calc(input);
    var extra = num(amount);
    var byCredit = withExtra(input, 'credit', extra);
    var byDebit = withExtra(input, 'debit', extra);
    var byMarket = withExtra(input, 'market', extra);
    var byTransit = withExtra(input, 'transit', extra);
    var byCulture = withExtra(input, 'culture', extra);
    function delta(r) { return r.deduction - base.deduction; }
    var dCredit = delta(byCredit);
    var dDebit = delta(byDebit);
    var dMarket = delta(byMarket);
    var dTransit = delta(byTransit);
    var dCulture = delta(byCulture);
    var generalWinner = 'same';
    if (dDebit > dCredit) generalWinner = 'debit';
    else if (dCredit > dDebit) generalWinner = 'credit';
    return {
      amount: extra,
      base: base,
      credit: { result: byCredit, delta: dCredit },
      debit: { result: byDebit, delta: dDebit },
      market: { result: byMarket, delta: dMarket },
      transit: { result: byTransit, delta: dTransit },
      culture: { result: byCulture, delta: dCulture },
      generalWinner: generalWinner
    };
  }

  var api = {
    RATE_CREDIT: RATE_CREDIT,
    RATE_DEBIT: RATE_DEBIT,
    RATE_CULTURE: RATE_CULTURE,
    RATE_MARKET: RATE_MARKET,
    RATE_TRANSIT: RATE_TRANSIT,
    THRESHOLD_RATE: THRESHOLD_RATE,
    SALARY_CUTOFF: SALARY_CUTOFF,
    num: num,
    childrenBucket: childrenBucket,
    threshold: threshold,
    baseLimit: baseLimit,
    additionalCap: additionalCap,
    isLowSalary: isLowSalary,
    buckets: buckets,
    calc: calc,
    withExtra: withExtra,
    compareExtra: compareExtra
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CardDeduction = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
