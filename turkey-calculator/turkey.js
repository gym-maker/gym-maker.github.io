(function (root) {
  'use strict';

  // USDA FSIS "Let's Talk Turkey" (updated Nov 17, 2023): 1 lb per person
  // for fresh or frozen turkeys. Frozen pre-stuffed is 1.25 lb (not used here).
  var LB_PER_PERSON_USDA = 1;

  // Butterball Togetherness Report 2025 (butterball.com PDF):
  // "aim for about 1.5 lbs. per person" to allow leftovers.
  // USDA does not publish a leftovers multiplier.
  var LB_PER_PERSON_LEFTOVERS = 1.5;

  var SAFE_TEMP_F = 165;
  var REST_MINUTES = 20;
  var OVEN_F = 325;
  var FRIDGE_HOURS_PER_LB_MIN = 24 / 5; // ~24 hours per 5 lb (faster end)
  var FRIDGE_HOURS_PER_LB_MAX = 24 / 4; // ~24 hours per 4 lb (slower end)
  var WATER_MINUTES_PER_LB = 30;

  // Refrigerator thaw chart, USDA "Let's Talk Turkey".
  // Boundaries: 12 lb uses the 4–12 band; 16 lb uses 12–16; 20 lb uses 16–20.
  var FRIDGE_BANDS = [
    { min: 4, max: 12, daysMin: 1, daysMax: 3 },
    { min: 12, max: 16, daysMin: 3, daysMax: 4 },
    { min: 16, max: 20, daysMin: 4, daysMax: 5 },
    { min: 20, max: 24, daysMin: 5, daysMax: 6 }
  ];

  var WATER_BANDS = [
    { min: 4, max: 12, hoursMin: 2, hoursMax: 6 },
    { min: 12, max: 16, hoursMin: 6, hoursMax: 8 },
    { min: 16, max: 20, hoursMin: 8, hoursMax: 10 },
    { min: 20, max: 24, hoursMin: 10, hoursMax: 12 }
  ];

  // Roast times at 325°F, hours. Whole-bird times: Let's Talk Turkey / Turkey Basics.
  // Unstuffed breast 4–6 and 6–8: Turkey Basics: Safe Cooking (more detailed than the
  // combined 4–8 lb 1.5–3.25 hr row on Let's Talk Turkey).
  // Stuffed breast 4–6: "Not usually applicable" (Let's Talk Turkey).
  // Stuffed breast 6–8: Let's Talk Turkey 2.5–3.5 hr (foodsafety.gov lists 3–3.5; we use FSIS).
  var ROAST_WHOLE_UNSTUFFED = [
    { min: 8, max: 12, hoursMin: 2.75, hoursMax: 3 },
    { min: 12, max: 14, hoursMin: 3, hoursMax: 3.75 },
    { min: 14, max: 18, hoursMin: 3.75, hoursMax: 4.25 },
    { min: 18, max: 20, hoursMin: 4.25, hoursMax: 4.5 },
    { min: 20, max: 24, hoursMin: 4.5, hoursMax: 5 }
  ];
  var ROAST_WHOLE_STUFFED = [
    { min: 8, max: 12, hoursMin: 3, hoursMax: 3.5 },
    { min: 12, max: 14, hoursMin: 3.5, hoursMax: 4 },
    { min: 14, max: 18, hoursMin: 4, hoursMax: 4.25 },
    { min: 18, max: 20, hoursMin: 4.25, hoursMax: 4.75 },
    { min: 20, max: 24, hoursMin: 4.75, hoursMax: 5.25 }
  ];
  var ROAST_BREAST_UNSTUFFED = [
    { min: 4, max: 6, hoursMin: 1.5, hoursMax: 2.25 },
    { min: 6, max: 8, hoursMin: 2.25, hoursMax: 3.25 }
  ];
  var ROAST_BREAST_STUFFED = [
    { min: 4, max: 6, hoursMin: null, hoursMax: null, notUsuallyApplicable: true },
    { min: 6, max: 8, hoursMin: 2.5, hoursMax: 3.5 }
  ];

  function num(v) {
    var n = Number(v);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  }

  function isThanksgiving2026(y, m, d) {
    return y === 2026 && m === 11 && d === 26;
  }

  function weekdayUtc(y, m, d) {
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }

  function parseYMD(s) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) return null;
    return { y: y, m: m, d: d };
  }

  function ymd(o) {
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    return o.y + '-' + pad(o.m) + '-' + pad(o.d);
  }

  function addDays(o, days) {
    var dt = new Date(Date.UTC(o.y, o.m - 1, o.d + days));
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }

  function parseTime(s) {
    if (!s || !/^\d{1,2}:\d{2}$/.test(s)) return null;
    var parts = s.split(':');
    var h = +parts[0], min = +parts[1];
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return { hours: h, minutes: min };
  }

  function formatClock(totalMinutes) {
    var dayOffset = 0;
    while (totalMinutes < 0) { totalMinutes += 24 * 60; dayOffset -= 1; }
    while (totalMinutes >= 24 * 60) { totalMinutes -= 24 * 60; dayOffset += 1; }
    var h = Math.floor(totalMinutes / 60);
    var m = Math.round(totalMinutes % 60);
    if (m === 60) { m = 0; h += 1; if (h === 24) { h = 0; dayOffset += 1; } }
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    return { hhmm: pad(h) + ':' + pad(m), dayOffset: dayOffset, minutes: h * 60 + m };
  }

  function hoursToMinutes(h) {
    return Math.round(h * 60);
  }

  function formatDurationHours(h) {
    if (h == null || !isFinite(h)) return null;
    var total = hoursToMinutes(h);
    var hr = Math.floor(total / 60);
    var min = total % 60;
    if (hr && min) return hr + ' hr ' + min + ' min';
    if (hr) return hr + ' hr';
    return min + ' min';
  }

  function inBand(weight, band) {
    return weight >= band.min && weight <= band.max;
  }

  // First matching range in the order the USDA table is written (low to high),
  // so a boundary weight such as 12 lb uses the earlier row (4–12 or 8–12), not 12–16 / 12–14.
  function lookupBand(weight, bands) {
    for (var i = 0; i < bands.length; i++) {
      if (inBand(weight, bands[i])) return bands[i];
    }
    return null;
  }

  function turkeySize(guests, leftovers) {
    var g = Math.floor(num(guests));
    var rate = leftovers ? LB_PER_PERSON_LEFTOVERS : LB_PER_PERSON_USDA;
    var source = leftovers ? 'butterball-1.5' : 'usda-1';
    return {
      guests: g,
      leftovers: !!leftovers,
      poundsPerPerson: rate,
      pounds: g * rate,
      source: source
    };
  }

  function fridgeThaw(weight) {
    var w = num(weight);
    var formulaMinDays = w * FRIDGE_HOURS_PER_LB_MIN / 24;
    var formulaMaxDays = w * FRIDGE_HOURS_PER_LB_MAX / 24;
    var band = lookupBand(w, FRIDGE_BANDS);
    return {
      weight: w,
      band: band,
      daysMin: band ? band.daysMin : null,
      daysMax: band ? band.daysMax : null,
      formulaDaysMin: formulaMinDays,
      formulaDaysMax: formulaMaxDays
    };
  }

  function waterThaw(weight) {
    var w = num(weight);
    var formulaHours = w * WATER_MINUTES_PER_LB / 60;
    var band = lookupBand(w, WATER_BANDS);
    return {
      weight: w,
      band: band,
      hoursMin: band ? band.hoursMin : null,
      hoursMax: band ? band.hoursMax : null,
      formulaHours: formulaHours
    };
  }

  function roastTime(weight, kind, stuffed) {
    var w = num(weight);
    var table;
    if (kind === 'breast') table = stuffed ? ROAST_BREAST_STUFFED : ROAST_BREAST_UNSTUFFED;
    else table = stuffed ? ROAST_WHOLE_STUFFED : ROAST_WHOLE_UNSTUFFED;
    var band = lookupBand(w, table);
    if (!band) {
      return { weight: w, kind: kind, stuffed: !!stuffed, inChart: false, notUsuallyApplicable: false, hoursMin: null, hoursMax: null };
    }
    return {
      weight: w,
      kind: kind,
      stuffed: !!stuffed,
      inChart: true,
      notUsuallyApplicable: !!band.notUsuallyApplicable,
      hoursMin: band.hoursMin,
      hoursMax: band.hoursMax,
      bandMin: band.min,
      bandMax: band.max
    };
  }

  function fridgeStartDate(dinner, daysMax) {
    if (!dinner || daysMax == null) return null;
    return addDays(dinner, -daysMax);
  }

  function startWindow(dinnerMinutes, hoursMin, hoursMax, restMinutes) {
    if (dinnerMinutes == null || hoursMin == null || hoursMax == null) return null;
    var rest = restMinutes == null ? REST_MINUTES : restMinutes;
    var early = dinnerMinutes - hoursToMinutes(hoursMax) - rest;
    var late = dinnerMinutes - hoursToMinutes(hoursMin) - rest;
    return {
      restMinutes: rest,
      earlier: formatClock(early),
      later: formatClock(late),
      cookMinMinutes: hoursToMinutes(hoursMin),
      cookMaxMinutes: hoursToMinutes(hoursMax)
    };
  }

  function calc(input) {
    input = input || {};
    var guests = Math.floor(num(input.guests));
    var leftovers = !!input.leftovers;
    var kind = input.kind === 'breast' ? 'breast' : 'whole';
    var stuffed = !!input.stuffed;
    var dinnerDate = parseYMD(input.dinnerDate);
    var dinnerTime = parseTime(input.dinnerTime == null ? '15:00' : input.dinnerTime);
    var size = turkeySize(guests, leftovers);
    var fridge = fridgeThaw(size.pounds);
    var water = waterThaw(size.pounds);
    var roast = roastTime(size.pounds, kind, stuffed);
    var planningDays = fridge.daysMax != null ? fridge.daysMax : (fridge.formulaDaysMax != null ? Math.ceil(fridge.formulaDaysMax) : null);
    var moveDate = fridgeStartDate(dinnerDate, planningDays);
    var dinnerMinutes = dinnerTime ? dinnerTime.hours * 60 + dinnerTime.minutes : null;
    var start = (roast.inChart && !roast.notUsuallyApplicable)
      ? startWindow(dinnerMinutes, roast.hoursMin, roast.hoursMax, REST_MINUTES)
      : null;
    return {
      guests: guests,
      leftovers: leftovers,
      kind: kind,
      stuffed: stuffed,
      dinnerDate: dinnerDate,
      dinnerTime: dinnerTime,
      size: size,
      fridge: fridge,
      water: water,
      roast: roast,
      fridgeStartDate: moveDate,
      fridgeStartYmd: moveDate ? ymd(moveDate) : null,
      planningDays: planningDays,
      start: start,
      safeTempF: SAFE_TEMP_F,
      restMinutes: REST_MINUTES,
      ovenF: OVEN_F,
      isThanksgiving2026: dinnerDate ? isThanksgiving2026(dinnerDate.y, dinnerDate.m, dinnerDate.d) : false
    };
  }

  var api = {
    LB_PER_PERSON_USDA: LB_PER_PERSON_USDA,
    LB_PER_PERSON_LEFTOVERS: LB_PER_PERSON_LEFTOVERS,
    SAFE_TEMP_F: SAFE_TEMP_F,
    REST_MINUTES: REST_MINUTES,
    OVEN_F: OVEN_F,
    WATER_MINUTES_PER_LB: WATER_MINUTES_PER_LB,
    FRIDGE_BANDS: FRIDGE_BANDS,
    WATER_BANDS: WATER_BANDS,
    num: num,
    isThanksgiving2026: isThanksgiving2026,
    weekdayUtc: weekdayUtc,
    parseYMD: parseYMD,
    ymd: ymd,
    addDays: addDays,
    parseTime: parseTime,
    formatClock: formatClock,
    formatDurationHours: formatDurationHours,
    hoursToMinutes: hoursToMinutes,
    lookupBand: lookupBand,
    turkeySize: turkeySize,
    fridgeThaw: fridgeThaw,
    waterThaw: waterThaw,
    roastTime: roastTime,
    fridgeStartDate: fridgeStartDate,
    startWindow: startWindow,
    calc: calc
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TurkeyCalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
