(function (root) {
  'use strict';

  // Pure arithmetic. This module does not contain store offers, sale dates
  // as advertised prices, or tax-jurisdiction rules.

  function weekdayUtc(y, m, d) {
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }

  // U.S. Black Friday is the Friday after Thanksgiving.
  // Thanksgiving 2026 is Thursday, November 26, so Black Friday is November 27.
  function isBlackFriday2026(y, m, d) {
    return y === 2026 && m === 11 && d === 27 && weekdayUtc(y, m, d) === 5;
  }

  function toCents(dollars) {
    if (!isFinite(dollars)) return NaN;
    return Math.round(dollars * 100 + (dollars >= 0 ? 1e-8 : -1e-8));
  }

  function fromCents(c) {
    return c / 100;
  }

  // Round a (possibly fractional) cent amount to the nearest whole cent, half up.
  function roundCents(raw) {
    if (!isFinite(raw)) return NaN;
    if (raw === 0) return 0;
    return Math.sign(raw) * Math.floor(Math.abs(raw) + 0.5 + 1e-10);
  }

  function applyPercentOffCents(cents, pct) {
    var disc = roundCents(cents * (pct / 100));
    return cents - disc;
  }

  function isBlank(v) {
    return v === null || v === undefined || v === '';
  }

  function numOr(v, fallback) {
    if (isBlank(v)) return fallback;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
    return n;
  }

  /**
   * Price one deal.
   * Order, disclosed on the page:
   *   1. sale percent off the original price
   *   2. extra percent coupon — sequential (of the reduced price) or added
   *      (sale % + coupon % applied once to the original, capped at 100)
   *   3. dollar-off, not below $0
   *   4. sales tax on the discounted price
   *
   * Savings and effective discount are pre-tax, versus the original price.
   */
  function priceDeal(input) {
    input = input || {};
    if (isBlank(input.price) && input.price !== 0) {
      return { ok: false, reason: 'empty' };
    }
    var price = numOr(input.price, NaN);
    var sale = numOr(input.percentOff, 0);
    var coupon = numOr(input.couponPercent, 0);
    var dollarOff = numOr(input.dollarOff, 0);
    var tax = numOr(input.taxPercent, 0);
    var stack = input.stack === 'added' ? 'added' : 'sequential';

    if (!isFinite(price) || price < 0) return { ok: false, reason: 'invalid-price' };
    if (!isFinite(sale) || sale < 0) return { ok: false, reason: 'invalid-percent' };
    if (!isFinite(coupon) || coupon < 0) return { ok: false, reason: 'invalid-coupon' };
    if (!isFinite(dollarOff) || dollarOff < 0) return { ok: false, reason: 'invalid-dollar' };
    if (!isFinite(tax) || tax < 0) return { ok: false, reason: 'invalid-tax' };

    var saleClamped = Math.min(sale, 100);
    var couponClamped = Math.min(coupon, 100);
    var taxClamped = tax; // tax is not a discount; still applied as entered if >= 0
    var dollarCents = toCents(dollarOff);
    var originalCents = toCents(price);

    var afterSale = applyPercentOffCents(originalCents, saleClamped);
    var afterPercents;
    var addedCombined = Math.min(saleClamped + couponClamped, 100);
    if (stack === 'added') {
      afterPercents = applyPercentOffCents(originalCents, addedCombined);
    } else {
      afterPercents = applyPercentOffCents(afterSale, couponClamped);
    }
    var preTaxCents = Math.max(0, afterPercents - dollarCents);
    var taxCents = roundCents(preTaxCents * (taxClamped / 100));
    var finalCents = preTaxCents + taxCents;
    var savingsCents = originalCents - preTaxCents;
    var effective = originalCents === 0 ? 0 : (savingsCents / originalCents) * 100;

    var otherStack = stack === 'added' ? 'sequential' : 'added';
    var altPercents = otherStack === 'added'
      ? applyPercentOffCents(originalCents, addedCombined)
      : applyPercentOffCents(afterSale, couponClamped);
    var altPreTaxCents = Math.max(0, altPercents - dollarCents);

    return {
      ok: true,
      reason: null,
      stack: stack,
      original: fromCents(originalCents),
      originalCents: originalCents,
      afterSale: fromCents(afterSale),
      afterPercents: fromCents(afterPercents),
      preTax: fromCents(preTaxCents),
      preTaxCents: preTaxCents,
      taxAmount: fromCents(taxCents),
      taxCents: taxCents,
      finalPrice: fromCents(finalCents),
      finalCents: finalCents,
      savings: fromCents(savingsCents),
      savingsCents: savingsCents,
      effectivePct: effective,
      saleApplied: saleClamped,
      couponApplied: couponClamped,
      combinedAddedPct: addedCombined,
      dollarOffApplied: fromCents(dollarCents),
      clamped: sale > 100 || coupon > 100,
      altStack: otherStack,
      altPreTax: fromCents(altPreTaxCents),
      altPreTaxCents: altPreTaxCents
    };
  }

  function compareDeals(deals) {
    deals = deals || [];
    var rows = deals.map(function (d, i) {
      return { index: i, result: priceDeal(d) };
    });
    var valid = rows.filter(function (r) { return r.result.ok; });
    var cheapestIndex = null;
    var cheapestCents = null;
    valid.forEach(function (r) {
      if (cheapestCents === null || r.result.finalCents < cheapestCents) {
        cheapestCents = r.result.finalCents;
        cheapestIndex = r.index;
      }
    });
    var ties = valid
      .filter(function (r) { return r.result.finalCents === cheapestCents; })
      .map(function (r) { return r.index; });
    return {
      rows: rows,
      validCount: valid.length,
      cheapestIndex: cheapestIndex,
      ties: ties
    };
  }

  function money(n) {
    if (!isFinite(n)) return '—';
    var sign = n < 0 ? '-' : '';
    var cents = toCents(Math.abs(n));
    var d = Math.floor(cents / 100);
    var c = String(cents % 100).padStart(2, '0');
    return sign + '$' + d.toLocaleString('en-US') + '.' + c;
  }

  function pct(n, digits) {
    if (!isFinite(n)) return '—';
    var d = digits == null ? 2 : digits;
    var s = n.toFixed(d);
    if (d > 0) s = s.replace(/\.?0+$/, '');
    return s + '%';
  }

  var api = {
    weekdayUtc: weekdayUtc,
    isBlackFriday2026: isBlackFriday2026,
    toCents: toCents,
    fromCents: fromCents,
    roundCents: roundCents,
    applyPercentOffCents: applyPercentOffCents,
    priceDeal: priceDeal,
    compareDeals: compareDeals,
    money: money,
    pct: pct
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BlackFridayCalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
