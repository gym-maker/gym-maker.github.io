/* 2027 US pay-period calendar.
   Date math only, plus official Federal Reserve Bank closure dates (K.8)
   and OPM observed federal holidays (for comparison, not for default payday shifts).
   Sources checked 2026-11-15:
   - https://www.federalreserve.gov/aboutthefed/k8.htm (last update July 8, 2026)
   - https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/
   Moving a payday off a weekend or bank holiday is a common employer practice,
   not a federal statute. The employer's calendar wins. */
(function (root) {
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function toYMD(o) { return o.y + '-' + pad(o.m) + '-' + pad(o.d); }
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
  function dow(o) { return new Date(utc(o)).getUTCDay(); } /* 0 = Sunday */
  function addDays(o, n) {
    var dt = new Date(utc(o));
    dt.setUTCDate(dt.getUTCDate() + n);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }
  function cmp(a, b) { return utc(a) - utc(b); }
  function clone(o) { return { y: o.y, m: o.m, d: o.d }; }

  /* Weekdays when Federal Reserve Banks and Branches are closed.
     Saturday holidays: Banks are OPEN the preceding Friday; the Board of Governors is closed.
     Sunday holidays: all Federal Reserve offices are closed the following Monday. */
  var FED_BANK_CLOSED = {
    '2026-01-01': "New Year's Day",
    '2026-01-19': 'Birthday of Martin Luther King, Jr.',
    '2026-02-16': "Washington's Birthday",
    '2026-05-25': 'Memorial Day',
    '2026-06-19': 'Juneteenth National Independence Day',
    '2026-09-07': 'Labor Day',
    '2026-10-12': 'Columbus Day',
    '2026-11-11': 'Veterans Day',
    '2026-11-26': 'Thanksgiving Day',
    '2026-12-25': 'Christmas Day',
    '2027-01-01': "New Year's Day",
    '2027-01-18': 'Birthday of Martin Luther King, Jr.',
    '2027-02-15': "Washington's Birthday",
    '2027-05-31': 'Memorial Day',
    '2027-07-05': 'Independence Day',
    '2027-09-06': 'Labor Day',
    '2027-10-11': 'Columbus Day',
    '2027-11-11': 'Veterans Day',
    '2027-11-25': 'Thanksgiving Day'
  };

  /* Fridays when Fed Banks stay open and the Board is closed (K.8 footnotes). */
  var FED_BANKS_OPEN_BOARD_CLOSED = {
    '2026-07-03': 'Independence Day 2026 (Saturday July 4) — Fed Banks open, Board closed',
    '2027-06-18': 'Juneteenth (Saturday June 19) — Fed Banks open, Board closed',
    '2027-12-24': 'Christmas (Saturday December 25) — Fed Banks open, Board closed',
    '2027-12-31': "New Year's Day 2028 (Saturday January 1) — Fed Banks open, Board closed"
  };

  /* OPM 2027 observed holidays for most Mon–Fri federal employees, plus
     New Year's Day 2028 observed Friday Dec 31, which OPM lists under 2028. */
  var OPM_OBSERVED = {
    '2027-01-01': "New Year's Day",
    '2027-01-18': 'Birthday of Martin Luther King, Jr.',
    '2027-02-15': "Washington's Birthday",
    '2027-05-31': 'Memorial Day',
    '2027-06-18': 'Juneteenth National Independence Day (observed)',
    '2027-07-05': 'Independence Day (observed)',
    '2027-09-06': 'Labor Day',
    '2027-10-11': 'Columbus Day',
    '2027-11-11': 'Veterans Day',
    '2027-11-25': 'Thanksgiving Day',
    '2027-12-24': 'Christmas Day (observed)',
    '2027-12-31': "New Year's Day 2028 (observed)"
  };

  function isWeekend(o) {
    var w = dow(o);
    return w === 0 || w === 6;
  }
  function isFedBankClosed(o) { return Object.prototype.hasOwnProperty.call(FED_BANK_CLOSED, toYMD(o)); }
  function fedBankClosedName(o) { return FED_BANK_CLOSED[toYMD(o)] || null; }
  function isFedBanksOpenBoardClosed(o) { return Object.prototype.hasOwnProperty.call(FED_BANKS_OPEN_BOARD_CLOSED, toYMD(o)); }
  function isOpmObserved(o) { return Object.prototype.hasOwnProperty.call(OPM_OBSERVED, toYMD(o)); }
  function opmObservedName(o) { return OPM_OBSERVED[toYMD(o)] || null; }

  /* Previous weekday that is not a Federal Reserve Bank closure. */
  function previousBusinessDay(o) {
    var cur = clone(o);
    var guard = 0;
    while ((isWeekend(cur) || isFedBankClosed(cur)) && guard < 14) {
      cur = addDays(cur, -1);
      guard++;
    }
    if (guard >= 14) throw new Error('business-day-search-failed ' + toYMD(o));
    return cur;
  }

  function weekdayCount(year, weekday) {
    var n = 0;
    var cur = { y: year, m: 1, d: 1 };
    var end = { y: year, m: 12, d: 31 };
    while (cmp(cur, end) <= 0) {
      if (dow(cur) === weekday) n++;
      cur = addDays(cur, 1);
    }
    return n;
  }

  function firstWeekdayOnOrAfter(o, weekday) {
    var cur = clone(o);
    var guard = 0;
    while (dow(cur) !== weekday && guard < 8) {
      cur = addDays(cur, 1);
      guard++;
    }
    return cur;
  }

  /* The two possible first 2027 paydays for a biweekly cycle on `weekday`,
     or the single first weekday for a weekly cycle. */
  function firstPaydayOptions(year, weekday, stepDays) {
    var first = firstWeekdayOnOrAfter({ y: year, m: 1, d: 1 }, weekday);
    if (stepDays === 7) return [first];
    return [first, addDays(first, 7)];
  }

  function collectStep(anchor, stepDays, from, until) {
    var dates = [];
    var cur = clone(anchor);
    while (cmp(cur, from) > 0) cur = addDays(cur, -stepDays);
    while (cmp(cur, from) < 0) cur = addDays(cur, stepDays);
    while (cmp(cur, until) <= 0) {
      dates.push(clone(cur));
      cur = addDays(cur, stepDays);
    }
    return dates;
  }

  function monthDay(y, m, day) {
    var dim = daysInMonth(y, m);
    var d = (day === 'last' || day > dim) ? dim : day;
    return { y: y, m: m, d: d };
  }

  function collectSemi(fromYear, toYear, mode) {
    var dates = [];
    for (var y = fromYear; y <= toYear; y++) {
      for (var m = 1; m <= 12; m++) {
        if (mode === '1-15') {
          dates.push(monthDay(y, m, 1));
          dates.push(monthDay(y, m, 15));
        } else { /* 15-eom */
          dates.push(monthDay(y, m, 15));
          dates.push(monthDay(y, m, 'last'));
        }
      }
    }
    dates.sort(cmp);
    return dates;
  }

  function collectMonthly(fromYear, toYear, day) {
    var dates = [];
    for (var y = fromYear; y <= toYear; y++) {
      for (var m = 1; m <= 12; m++) dates.push(monthDay(y, m, day));
    }
    return dates;
  }

  var FREQ = {
    weekly: { step: 7, label: 'Weekly' },
    biweekly: { step: 14, label: 'Biweekly' },
    'semi-15-eom': { step: null, label: 'Semi-monthly (15th and last day)' },
    'semi-1-15': { step: null, label: 'Semi-monthly (1st and 15th)' },
    monthly: { step: null, label: 'Monthly' }
  };

  function annotate(s, shift) {
    var paid = shift ? previousBusinessDay(s) : clone(s);
    return {
      scheduled: s,
      paid: paid,
      scheduledYmd: toYMD(s),
      paidYmd: toYMD(paid),
      moved: toYMD(paid) !== toYMD(s),
      scheduledDow: dow(s),
      paidDow: dow(paid),
      weekend: isWeekend(s),
      fedClosed: isFedBankClosed(s),
      fedClosedName: fedBankClosedName(s),
      banksOpenBoardClosed: isFedBanksOpenBoardClosed(s),
      opmObserved: isOpmObserved(s),
      opmObservedName: opmObservedName(s)
    };
  }

  function monthCounts(rows, year, field) {
    var c = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var dates = {};
    rows.forEach(function (r) {
      var o = r[field];
      if (o.y !== year) return;
      var k = toYMD(o);
      if (dates[k]) return;
      dates[k] = 1;
      c[o.m]++;
    });
    return c;
  }

  function monthsAtLeast(counts, n) {
    var out = [];
    for (var m = 1; m <= 12; m++) if (counts[m] >= n) out.push({ month: m, count: counts[m] });
    return out;
  }

  function build(opts) {
    opts = opts || {};
    var year = opts.year || 2027;
    var shift = opts.shift !== false;
    var frequency = opts.frequency || 'biweekly';
    if (!FREQ[frequency]) throw new Error('unknown-frequency');

    var from = { y: year - 1, m: 12, d: 1 };
    var until = { y: year + 1, m: 1, d: 15 };
    var scheduled;
    var anchor = null;

    if (frequency === 'weekly' || frequency === 'biweekly') {
      var step = FREQ[frequency].step;
      if (opts.anchor) {
        anchor = typeof opts.anchor === 'string' ? parseYMD(opts.anchor) : clone(opts.anchor);
        if (!anchor) throw new Error('bad-anchor');
      } else if (typeof opts.weekday === 'number') {
        var options = firstPaydayOptions(year, opts.weekday, step);
        var idx = opts.cycle === 1 ? 1 : 0;
        if (idx >= options.length) idx = 0;
        anchor = options[idx];
      } else {
        throw new Error('need-anchor-or-weekday');
      }
      scheduled = collectStep(anchor, step, from, until);
    } else if (frequency === 'semi-15-eom' || frequency === 'semi-1-15') {
      scheduled = collectSemi(year - 1, year + 1, frequency === 'semi-1-15' ? '1-15' : '15-eom')
        .filter(function (d) { return cmp(d, from) >= 0 && cmp(d, until) <= 0; });
    } else if (frequency === 'monthly') {
      var day = opts.monthDay == null ? 'last' : opts.monthDay;
      if (day !== 'last') {
        day = +day;
        if (!(day >= 1 && day <= 31)) throw new Error('bad-month-day');
      }
      scheduled = collectMonthly(year - 1, year + 1, day)
        .filter(function (d) { return cmp(d, from) >= 0 && cmp(d, until) <= 0; });
    }

    var rows = scheduled.map(function (s) { return annotate(s, shift); });
    var scheduledInYear = rows.filter(function (r) { return r.scheduled.y === year; });
    var paidInYear = rows.filter(function (r) { return r.paid.y === year; });
    var moved = scheduledInYear.filter(function (r) { return r.moved; });
    var movedOut = moved.filter(function (r) { return r.paid.y !== year; });
    var movedIn = paidInYear.filter(function (r) { return r.moved && r.scheduled.y !== year; });

    var paidCounts = monthCounts(rows, year, 'paid');
    var scheduledCounts = monthCounts(rows, year, 'scheduled');
    var extraThreshold = frequency === 'weekly' ? 5 : (frequency === 'biweekly' ? 3 : 3);

    return {
      year: year,
      frequency: frequency,
      shift: shift,
      anchor: anchor,
      rows: rows,
      scheduledInYear: scheduledInYear,
      paidInYear: paidInYear,
      scheduledCount: scheduledInYear.length,
      paidCount: paidInYear.length,
      moved: moved,
      movedOut: movedOut,
      movedIn: movedIn,
      paidMonthCounts: paidCounts,
      scheduledMonthCounts: scheduledCounts,
      extraPayMonthsPaid: monthsAtLeast(paidCounts, extraThreshold),
      extraPayMonthsScheduled: monthsAtLeast(scheduledCounts, extraThreshold),
      extraThreshold: extraThreshold
    };
  }

  var api = {
    pad: pad,
    toYMD: toYMD,
    parseYMD: parseYMD,
    daysInMonth: daysInMonth,
    dow: dow,
    addDays: addDays,
    cmp: cmp,
    FED_BANK_CLOSED: FED_BANK_CLOSED,
    FED_BANKS_OPEN_BOARD_CLOSED: FED_BANKS_OPEN_BOARD_CLOSED,
    OPM_OBSERVED: OPM_OBSERVED,
    isWeekend: isWeekend,
    isFedBankClosed: isFedBankClosed,
    isFedBanksOpenBoardClosed: isFedBanksOpenBoardClosed,
    isOpmObserved: isOpmObserved,
    previousBusinessDay: previousBusinessDay,
    weekdayCount: weekdayCount,
    firstWeekdayOnOrAfter: firstWeekdayOnOrAfter,
    firstPaydayOptions: firstPaydayOptions,
    build: build,
    FREQ: FREQ
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PayPeriods = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
