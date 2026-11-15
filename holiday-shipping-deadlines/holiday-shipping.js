(function (root) {
  'use strict';

  var CHECKED = '2026-11-16';
  var CHRISTMAS_2026 = '2026-12-25';
  var TZ = 'America/New_York';

  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  var SOURCES = [
    { carrier: 'usps', title: 'USPS 2026 Holiday Shipping Dates', url: 'https://www.usps.com/holiday/holiday-shipping-dates.htm', checked: CHECKED },
    { carrier: 'usps', title: 'USPS news: recommended 2026 holiday mailing and shipping dates (Sept. 22, 2026)', url: 'https://about.usps.com/newsroom/national-releases/2026/0922-usps-recommends-2026-holiday-mailing-shipping-dates.htm', checked: CHECKED },
    { carrier: 'usps', title: 'USPS Postal Bulletin 22714 (Oct. 29, 2026)', url: 'https://about.usps.com/postal-bulletin/2026/pb22714/pb22714.pdf', checked: CHECKED },
    { carrier: 'ups', title: 'UPS 2026 Year-End Holiday Schedule (U.S.) PDF', url: 'https://assets.ups.com/adobe/assets/urn:aaid:aem:e8548535-8096-4fa9-9cef-2b81aef7c26c/original/as/year-end-holiday-schedule-us-en.pdf', checked: CHECKED },
    { carrier: 'ups', title: 'UPS holiday shipping schedule', url: 'https://www.ups.com/us/en/support/shipping-support/shipping-services/holiday-shipping-schedule', checked: CHECKED },
    { carrier: 'fedex', title: 'FedEx 2026 Peak last day to ship PDF', url: 'https://www.fedex.com/content/dam/fedex/us-united-states/services/2026_Peak_Last_Day_to_ship.pdf', checked: CHECKED },
    { carrier: 'fedex', title: 'FedEx last days to ship', url: 'https://www.fedex.com/en-us/holiday/last-days-to-ship.html', checked: CHECKED },
    { carrier: 'fedex', title: 'FedEx holiday hub', url: 'https://www.fedex.com/en-us/holiday.html', checked: CHECKED }
  ];

  var LOOKUP = {
    uspsCommitments: 'https://postcalc.usps.com/ServiceCommitments',
    upsCtc: 'https://www.ups.com/ctc',
    fedexGroundMap: 'https://www.fedex.com/grd/maps/ShowMapEntry.do',
    fedexCanadaGround: 'https://www.fedex.com/en-us/shipping/international-ground-canada.html',
    fedexRateFinder: 'https://www.fedex.com/ratefinder/home'
  };

  function weekdayUtc(y, m, d) {
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }

  function parseISO(iso) {
    if (!iso || typeof iso !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    if (weekdayUtc(y, mo, d) !== new Date(Date.UTC(y, mo - 1, d)).getUTCDay()) return null;
    if (new Date(Date.UTC(y, mo - 1, d)).getUTCDate() !== d) return null;
    return { y: y, m: mo, d: d };
  }

  function daysBetween(fromISO, toISO) {
    var a = parseISO(fromISO), b = parseISO(toISO);
    if (!a || !b) return null;
    return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
  }

  function formatLongDate(iso) {
    var p = parseISO(iso);
    if (!p) return '';
    return WEEKDAYS[weekdayUtc(p.y, p.m, p.d)] + ', ' + MONTHS[p.m - 1] + ' ' + p.d + ', ' + p.y;
  }

  function todayInTimeZone(now, tz) {
    now = now || new Date();
    tz = tz || TZ;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);
  }

  function isChristmas2026(iso) {
    var p = parseISO(iso || CHRISTMAS_2026);
    return !!(p && p.y === 2026 && p.m === 12 && p.d === 25 && weekdayUtc(2026, 12, 25) === 5);
  }

  // Calendar days from today (inclusive of a 0 = last day is today) to the send-by date.
  function countdown(shipByISO, todayISO) {
    if (!shipByISO) {
      return { daysLeft: null, state: 'none', label: 'No single published date to count down to' };
    }
    var days = daysBetween(todayISO, shipByISO);
    if (days === null) {
      return { daysLeft: null, state: 'invalid', label: 'Invalid date' };
    }
    if (days > 0) {
      return { daysLeft: days, state: 'upcoming', label: days === 1 ? '1 day left' : days + ' days left' };
    }
    if (days === 0) {
      return { daysLeft: 0, state: 'today', label: 'Ship today — this is the last day' };
    }
    var ago = -days;
    return { daysLeft: days, state: 'passed', label: ago === 1 ? 'This date has passed (1 day ago)' : 'This date has passed (' + ago + ' days ago)' };
  }

  function row(fields) {
    return fields;
  }

  var ZIP340_NOTE = 'The official USPS holiday dates page lists two different ZIP 340 rows. Confirm the date on the official table before you ship.';

  var SERVICES = [
    // USPS contiguous — recommended send-by for expected delivery before Dec 25
    row({ id: 'usps-cont-ga', carrier: 'usps', service: 'USPS Ground Advantage', destination: 'contiguous', destinationLabel: 'Contiguous U.S. (lower 48, excluding Alaska & Hawaii)', shipBy: '2026-12-17', status: 'published', deliveryTarget: 'before-dec-25' }),
    row({ id: 'usps-cont-fcm', carrier: 'usps', service: 'First-Class Mail', destination: 'contiguous', destinationLabel: 'Contiguous U.S. (lower 48, excluding Alaska & Hawaii)', shipBy: '2026-12-17', status: 'published', deliveryTarget: 'before-dec-25' }),
    row({ id: 'usps-cont-pm', carrier: 'usps', service: 'Priority Mail', destination: 'contiguous', destinationLabel: 'Contiguous U.S. (lower 48, excluding Alaska & Hawaii)', shipBy: '2026-12-18', status: 'published', deliveryTarget: 'before-dec-25' }),
    row({ id: 'usps-cont-pme', carrier: 'usps', service: 'Priority Mail Express', destination: 'contiguous', destinationLabel: 'Contiguous U.S. (lower 48, excluding Alaska & Hawaii)', shipBy: '2026-12-19', status: 'published', deliveryTarget: 'before-dec-25' }),

    // USPS AK/HI/PR/territories
    row({ id: 'usps-ak-ga', carrier: 'usps', service: 'USPS Ground Advantage', destination: 'ak-hi-pr-territories', destinationLabel: 'Alaska, Hawaii, Puerto Rico & U.S. territories', shipBy: null, status: 'no-single-date', deliveryTarget: 'before-dec-25', lookupUrl: LOOKUP.uspsCommitments, notes: 'USPS does not publish a single send-by date. Ground Advantage between the contiguous U.S. and Alaska, Hawaii, American Samoa, Puerto Rico, U.S. Virgin Islands, Guam, Northern Mariana Islands, and the Freely Associated States has a 10-day or more service expectation. Look up service commitments by ZIP Code.' }),
    row({ id: 'usps-ak-fcm', carrier: 'usps', service: 'First-Class Mail', destination: 'ak-hi-pr-territories', destinationLabel: 'Alaska, Hawaii, Puerto Rico & U.S. territories', shipBy: '2026-12-17', status: 'published', deliveryTarget: 'before-dec-25' }),
    row({ id: 'usps-ak-pm', carrier: 'usps', service: 'Priority Mail', destination: 'ak-hi-pr-territories', destinationLabel: 'Alaska, Hawaii, Puerto Rico & U.S. territories', shipBy: '2026-12-18', status: 'published', deliveryTarget: 'before-dec-25' }),
    row({ id: 'usps-ak-pme', carrier: 'usps', service: 'Priority Mail Express', destination: 'ak-hi-pr-territories', destinationLabel: 'Alaska, Hawaii, Puerto Rico & U.S. territories', shipBy: '2026-12-19', status: 'published', deliveryTarget: 'before-dec-25' }),

    // USPS international — all listed regions share these dates
    row({ id: 'usps-intl-fcpis', carrier: 'usps', service: 'First-Class Package International Service', destination: 'international', destinationLabel: 'International (all listed regions)', shipBy: '2026-12-09', status: 'published', deliveryTarget: 'before-dec-25', notes: 'Published for Africa, Asia/Pacific Rim, Australia/New Zealand, Canada, Caribbean, Central & South America, Europe, Mexico, and the Middle East.' }),
    row({ id: 'usps-intl-pmi', carrier: 'usps', service: 'Priority Mail International', destination: 'international', destinationLabel: 'International (all listed regions)', shipBy: '2026-12-09', status: 'published', deliveryTarget: 'before-dec-25', notes: 'Published for Africa, Asia/Pacific Rim, Australia/New Zealand, Canada, Caribbean, Central & South America, Europe, Mexico, and the Middle East.' }),
    row({ id: 'usps-intl-pmei', carrier: 'usps', service: 'Priority Mail Express International', destination: 'international', destinationLabel: 'International (all listed regions)', shipBy: '2026-12-16', status: 'published', deliveryTarget: 'before-dec-25', notes: 'Published for Africa, Asia/Pacific Rim, Australia/New Zealand, Canada, Caribbean, Central & South America, Europe, Mexico, and the Middle East.' }),

    // USPS military — header-aligned rows
    row({ id: 'usps-mil-090-ga', carrier: 'usps', service: 'USPS Ground Advantage', destination: 'military', destinationLabel: 'APO/FPO/DPO AE ZIPs 090-092', shipBy: '2026-11-04', status: 'published', deliveryTarget: 'before-dec-25' }),
    row({ id: 'usps-mil-090-fcm', carrier: 'usps', service: 'First-Class Mail', destination: 'military', destinationLabel: 'APO/FPO/DPO AE ZIPs 090-092', shipBy: '2026-12-09', status: 'published', deliveryTarget: 'before-dec-25' }),
    row({ id: 'usps-mil-090-pm', carrier: 'usps', service: 'Priority Mail', destination: 'military', destinationLabel: 'APO/FPO/DPO AE ZIPs 090-092', shipBy: '2026-12-09', status: 'published', deliveryTarget: 'before-dec-25' }),
    row({ id: 'usps-mil-090-pmems', carrier: 'usps', service: 'Priority Mail Express Military (PMEMS)', destination: 'military', destinationLabel: 'APO/FPO/DPO AE ZIPs 090-092', shipBy: '2026-12-16', status: 'published', deliveryTarget: 'before-dec-25', notes: 'PMEMS is available to selected military/diplomatic Post Offices. Check with a local Post Office.' }),

    row({ id: 'usps-mil-093-ga', carrier: 'usps', service: 'USPS Ground Advantage', destination: 'military', destinationLabel: 'APO/FPO/DPO AE ZIPs 093', shipBy: '2026-11-04', status: 'published', deliveryTarget: 'before-dec-25' }),
    row({ id: 'usps-mil-093-fcm', carrier: 'usps', service: 'First-Class Mail', destination: 'military', destinationLabel: 'APO/FPO/DPO AE ZIPs 093', shipBy: '2026-12-09', status: 'published', deliveryTarget: 'before-dec-25' }),
    row({ id: 'usps-mil-093-pm', carrier: 'usps', service: 'Priority Mail', destination: 'military', destinationLabel: 'APO/FPO/DPO AE ZIPs 093', shipBy: '2026-12-09', status: 'published', deliveryTarget: 'before-dec-25' }),
    row({ id: 'usps-mil-093-pmems', carrier: 'usps', service: 'Priority Mail Express Military (PMEMS)', destination: 'military', destinationLabel: 'APO/FPO/DPO AE ZIPs 093', shipBy: null, status: 'not-applicable', deliveryTarget: 'before-dec-25', notes: 'The official USPS table lists PMEMS as N/A for AE ZIPs 093.' }),

    row({ id: 'usps-mil-094-ga', carrier: 'usps', service: 'USPS Ground Advantage', destination: 'military', destinationLabel: 'APO/FPO/DPO AE ZIPs 094-099', shipBy: '2026-11-04', status: 'published', deliveryTarget: 'before-dec-25' }),
    row({ id: 'usps-mil-094-fcm', carrier: 'usps', service: 'First-Class Mail', destination: 'military', destinationLabel: 'APO/FPO/DPO AE ZIPs 094-099', shipBy: '2026-12-09', status: 'published', deliveryTarget: 'before-dec-25' }),
    row({ id: 'usps-mil-094-pm', carrier: 'usps', service: 'Priority Mail', destination: 'military', destinationLabel: 'APO/FPO/DPO AE ZIPs 094-099', shipBy: '2026-12-09', status: 'published', deliveryTarget: 'before-dec-25' }),
    row({ id: 'usps-mil-094-pmems', carrier: 'usps', service: 'Priority Mail Express Military (PMEMS)', destination: 'military', destinationLabel: 'APO/FPO/DPO AE ZIPs 094-099', shipBy: '2026-12-16', status: 'published', deliveryTarget: 'before-dec-25' }),

    row({ id: 'usps-mil-340-ga', carrier: 'usps', service: 'USPS Ground Advantage', destination: 'military', destinationLabel: 'APO/FPO/DPO ZIP 340', shipBy: '2026-11-04', status: 'published', deliveryTarget: 'before-dec-25', notes: ZIP340_NOTE + ' This date is from the ZIP 340 row that matches the table headers (Ground Advantage, First-Class Mail, Priority Mail, PMEMS).' }),
    row({ id: 'usps-mil-340-fcm', carrier: 'usps', service: 'First-Class Mail', destination: 'military', destinationLabel: 'APO/FPO/DPO ZIP 340', shipBy: '2026-12-09', status: 'conflicting', deliveryTarget: 'before-dec-25', notes: ZIP340_NOTE + ' Header-aligned row: Wednesday, Dec. 9. A second ZIP 340 row on the same page lists Dec. 11.' }),
    row({ id: 'usps-mil-340-pm', carrier: 'usps', service: 'Priority Mail', destination: 'military', destinationLabel: 'APO/FPO/DPO ZIP 340', shipBy: '2026-12-09', status: 'conflicting', deliveryTarget: 'before-dec-25', notes: ZIP340_NOTE + ' Header-aligned row: Wednesday, Dec. 9. A second ZIP 340 row on the same page lists Dec. 11.' }),
    row({ id: 'usps-mil-340-pmems', carrier: 'usps', service: 'Priority Mail Express Military (PMEMS)', destination: 'military', destinationLabel: 'APO/FPO/DPO ZIP 340', shipBy: '2026-12-16', status: 'conflicting', deliveryTarget: 'before-dec-25', notes: ZIP340_NOTE + ' Header-aligned row: Wednesday, Dec. 16. A second ZIP 340 row on the same page lists Dec. 18.' }),
    row({ id: 'usps-mil-340b-rg', carrier: 'usps', service: 'USPS Retail Ground', destination: 'military', destinationLabel: 'APO/FPO/DPO ZIP 340 (second official-page row)', shipBy: '2026-11-06', status: 'published', deliveryTarget: 'before-dec-25', notes: ZIP340_NOTE + ' This service appears only on a second ZIP 340 row whose columns do not match the table headers.' }),
    row({ id: 'usps-mil-340b-sam', carrier: 'usps', service: 'Space Available Mail (SAM)', destination: 'military', destinationLabel: 'APO/FPO/DPO ZIP 340 (second official-page row)', shipBy: '2026-11-27', status: 'published', deliveryTarget: 'before-dec-25', notes: ZIP340_NOTE }),
    row({ id: 'usps-mil-340b-pal', carrier: 'usps', service: 'Parcel Airlift Mail (PAL)', destination: 'military', destinationLabel: 'APO/FPO/DPO ZIP 340 (second official-page row)', shipBy: '2026-12-04', status: 'published', deliveryTarget: 'before-dec-25', notes: ZIP340_NOTE }),
    row({ id: 'usps-mil-340b-fcm', carrier: 'usps', service: 'First-Class Mail', destination: 'military', destinationLabel: 'APO/FPO/DPO ZIP 340 (second official-page row)', shipBy: '2026-12-11', status: 'conflicting', deliveryTarget: 'before-dec-25', notes: ZIP340_NOTE + ' This row lists Dec. 11; the header-aligned ZIP 340 row lists Wednesday, Dec. 9.' }),
    row({ id: 'usps-mil-340b-pm', carrier: 'usps', service: 'Priority Mail', destination: 'military', destinationLabel: 'APO/FPO/DPO ZIP 340 (second official-page row)', shipBy: '2026-12-11', status: 'conflicting', deliveryTarget: 'before-dec-25', notes: ZIP340_NOTE + ' This row lists Dec. 11; the header-aligned ZIP 340 row lists Wednesday, Dec. 9.' }),
    row({ id: 'usps-mil-340b-pmems', carrier: 'usps', service: 'Priority Mail Express Military (PMEMS)', destination: 'military', destinationLabel: 'APO/FPO/DPO ZIP 340 (second official-page row)', shipBy: '2026-12-18', status: 'conflicting', deliveryTarget: 'before-dec-25', notes: ZIP340_NOTE + ' This row lists Dec. 18; the header-aligned ZIP 340 row lists Wednesday, Dec. 16.' }),

    row({ id: 'usps-mil-962-ga', carrier: 'usps', service: 'USPS Ground Advantage', destination: 'military', destinationLabel: 'APO/FPO/DPO ZIPs 962-966', shipBy: '2026-11-04', status: 'published', deliveryTarget: 'before-dec-25' }),
    row({ id: 'usps-mil-962-fcm', carrier: 'usps', service: 'First-Class Mail', destination: 'military', destinationLabel: 'APO/FPO/DPO ZIPs 962-966', shipBy: '2026-12-09', status: 'published', deliveryTarget: 'before-dec-25' }),
    row({ id: 'usps-mil-962-pm', carrier: 'usps', service: 'Priority Mail', destination: 'military', destinationLabel: 'APO/FPO/DPO ZIPs 962-966', shipBy: '2026-12-09', status: 'published', deliveryTarget: 'before-dec-25' }),
    row({ id: 'usps-mil-962-pmems', carrier: 'usps', service: 'Priority Mail Express Military (PMEMS)', destination: 'military', destinationLabel: 'APO/FPO/DPO ZIPs 962-966', shipBy: '2026-12-16', status: 'published', deliveryTarget: 'before-dec-25' }),

    // UPS — last day to ship for Dec 24 delivery; UPS is closed Dec 25 (no pickup/delivery)
    row({ id: 'ups-dom-ground', carrier: 'ups', service: 'UPS Ground', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: null, status: 'no-single-date', deliveryTarget: 'by-dec-24', lookupUrl: LOOKUP.upsCtc, notes: 'UPS does not publish a single Ground last-day date. Check time in transit at ups.com/ctc. Certain destinations may need an earlier ship date. UPS is closed Dec. 25 (no pickup or delivery).' }),
    row({ id: 'ups-dom-3day', carrier: 'ups', service: 'UPS 3 Day Select', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-21', status: 'published', deliveryTarget: 'by-dec-24', notes: 'Last day to ship for scheduled delivery by Dec. 24. UPS is closed Dec. 25. Certain destinations may need an earlier ship date.' }),
    row({ id: 'ups-dom-2da', carrier: 'ups', service: 'UPS 2nd Day Air', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-22', status: 'published', deliveryTarget: 'by-dec-24', notes: 'Last day to ship for scheduled delivery by Dec. 24. UPS is closed Dec. 25. Certain destinations may need an earlier ship date.' }),
    row({ id: 'ups-dom-nda', carrier: 'ups', service: 'UPS Next Day Air', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-23', status: 'published', deliveryTarget: 'by-dec-24', notes: 'Last day to ship for scheduled delivery by Dec. 24, with On-Call/Smart Pickup or drop-off at a UPS Store or Authorized Service Location. UPS is closed Dec. 25.' }),

    row({ id: 'ups-ca-std', carrier: 'ups', service: 'UPS Standard (from 48 contiguous states)', destination: 'canada', destinationLabel: 'U.S. to Canada', shipBy: null, status: 'no-single-date', deliveryTarget: 'by-dec-24', lookupUrl: LOOKUP.upsCtc, notes: 'UPS does not publish a single Standard last-day date. Check ups.com/ctc. UPS is closed Dec. 25.' }),
    row({ id: 'ups-ca-expedited', carrier: 'ups', service: 'UPS Worldwide Expedited', destination: 'canada', destinationLabel: 'U.S. to Canada', shipBy: '2026-12-22', status: 'published', deliveryTarget: 'by-dec-24', notes: 'Last day to ship for scheduled delivery by Dec. 24. UPS is closed Dec. 25. Certain destinations may need an earlier ship date.' }),
    row({ id: 'ups-ca-express', carrier: 'ups', service: 'UPS Worldwide Express', destination: 'canada', destinationLabel: 'U.S. to Canada', shipBy: '2026-12-23', status: 'published', deliveryTarget: 'by-dec-24', notes: 'Last day to ship for scheduled delivery by Dec. 24. UPS is closed Dec. 25. Certain destinations may need an earlier ship date.' }),

    row({ id: 'ups-mx-std', carrier: 'ups', service: 'UPS Standard (from 48 contiguous states)', destination: 'mexico', destinationLabel: 'U.S. to Mexico', shipBy: null, status: 'no-single-date', deliveryTarget: 'by-dec-24', lookupUrl: LOOKUP.upsCtc, notes: 'UPS does not publish a single Standard last-day date. Check ups.com/ctc. UPS is closed Dec. 25.' }),
    row({ id: 'ups-mx-expedited', carrier: 'ups', service: 'UPS Worldwide Expedited', destination: 'mexico', destinationLabel: 'U.S. to Mexico', shipBy: '2026-12-21', status: 'published', deliveryTarget: 'by-dec-24', notes: 'Last day to ship for scheduled delivery by Dec. 24. UPS is closed Dec. 25. Certain destinations may need an earlier ship date.' }),
    row({ id: 'ups-mx-express', carrier: 'ups', service: 'UPS Worldwide Express', destination: 'mexico', destinationLabel: 'U.S. to Mexico', shipBy: '2026-12-22', status: 'published', deliveryTarget: 'by-dec-24', notes: 'Last day to ship for scheduled delivery by Dec. 24. UPS is closed Dec. 25. Certain destinations may need an earlier ship date.' }),

    row({ id: 'ups-other-intl', carrier: 'ups', service: 'Other international services', destination: 'other-international', destinationLabel: 'U.S. to other international destinations', shipBy: null, status: 'no-single-date', deliveryTarget: 'by-dec-24', lookupUrl: LOOKUP.upsCtc, notes: 'UPS does not publish a single last-day table for other international destinations. Check ups.com/ctc. UPS is closed Dec. 25.' }),
    row({ id: 'ups-akhi', carrier: 'ups', service: 'Alaska & Hawaii (no separate table)', destination: 'ak-hi', destinationLabel: 'Alaska & Hawaii', shipBy: null, status: 'no-single-date', deliveryTarget: 'by-dec-24', lookupUrl: LOOKUP.upsCtc, notes: 'The official UPS 2026 year-end schedule does not publish a separate Alaska or Hawaii last-day table. It notes that certain destinations may need an earlier ship date. Check ups.com/ctc. Do not use a past-year date.' }),

    // FedEx — last day to ship for scheduled arrival by Dec 24; FedEx is closed Dec 25
    row({ id: 'fedex-dom-sameday', carrier: 'fedex', service: 'FedEx SameDay', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-24', status: 'published', deliveryTarget: 'by-dec-24', notes: 'From the official 2026 last-day chart, for scheduled arrival by Dec. 24. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-dom-overnight', carrier: 'fedex', service: 'FedEx First Overnight, Priority Overnight, Standard Overnight, Extra Hours', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-23', status: 'published', deliveryTarget: 'by-dec-24', notes: 'From the official 2026 last-day chart, for scheduled arrival by Dec. 24. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-dom-2day', carrier: 'fedex', service: 'FedEx 2Day & FedEx 2Day AM', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-22', status: 'published', deliveryTarget: 'by-dec-24', notes: 'From the official 2026 last-day chart, for scheduled arrival by Dec. 24. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-dom-saver', carrier: 'fedex', service: 'FedEx Express Saver', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-21', status: 'published', deliveryTarget: 'by-dec-24', notes: 'From the official 2026 last-day chart, for scheduled arrival by Dec. 24. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-dom-ground-5', carrier: 'fedex', service: 'FedEx Ground (5-day transit)', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-17', status: 'published', deliveryTarget: 'by-dec-24', transitNote: '5-day transit', lookupUrl: LOOKUP.fedexGroundMap, notes: 'Last day if your route is a 5-day transit, from the official chart. Confirm transit time by ZIP. Based on a regular scheduled pickup or drop-off at a staffed FedEx location. Typically 1 to 5 business days in the contiguous U.S. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-dom-ground-4', carrier: 'fedex', service: 'FedEx Ground (4-day transit)', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-18', status: 'published', deliveryTarget: 'by-dec-24', transitNote: '4-day transit', lookupUrl: LOOKUP.fedexGroundMap, notes: 'Last day if your route is a 4-day transit, from the official chart. Confirm transit time by ZIP. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-dom-ground-3', carrier: 'fedex', service: 'FedEx Ground (3-day transit)', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-21', status: 'published', deliveryTarget: 'by-dec-24', transitNote: '3-day transit', lookupUrl: LOOKUP.fedexGroundMap, notes: 'Last day if your route is a 3-day transit, from the official chart. Confirm transit time by ZIP. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-dom-ground-2', carrier: 'fedex', service: 'FedEx Ground (2-day transit)', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-22', status: 'published', deliveryTarget: 'by-dec-24', transitNote: '2-day transit', lookupUrl: LOOKUP.fedexGroundMap, notes: 'Last day if your route is a 2-day transit, from the official chart. Confirm transit time by ZIP. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-dom-ground-1', carrier: 'fedex', service: 'FedEx Ground (1-day transit)', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-23', status: 'published', deliveryTarget: 'by-dec-24', transitNote: '1-day transit', lookupUrl: LOOKUP.fedexGroundMap, notes: 'Last day if your route is a 1-day transit, from the official chart. Confirm transit time by ZIP. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-dom-hd-5', carrier: 'fedex', service: 'FedEx Home Delivery (5-day transit)', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-17', status: 'published', deliveryTarget: 'by-dec-24', transitNote: '5-day transit', lookupUrl: LOOKUP.fedexGroundMap, notes: 'Same last-day grid as FedEx Ground on the official chart. Confirm transit time by ZIP. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-dom-hd-4', carrier: 'fedex', service: 'FedEx Home Delivery (4-day transit)', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-18', status: 'published', deliveryTarget: 'by-dec-24', transitNote: '4-day transit', lookupUrl: LOOKUP.fedexGroundMap, notes: 'Same last-day grid as FedEx Ground on the official chart. Confirm transit time by ZIP. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-dom-hd-3', carrier: 'fedex', service: 'FedEx Home Delivery (3-day transit)', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-21', status: 'published', deliveryTarget: 'by-dec-24', transitNote: '3-day transit', lookupUrl: LOOKUP.fedexGroundMap, notes: 'Same last-day grid as FedEx Ground on the official chart. Confirm transit time by ZIP. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-dom-hd-2', carrier: 'fedex', service: 'FedEx Home Delivery (2-day transit)', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-22', status: 'published', deliveryTarget: 'by-dec-24', transitNote: '2-day transit', lookupUrl: LOOKUP.fedexGroundMap, notes: 'Same last-day grid as FedEx Ground on the official chart. Confirm transit time by ZIP. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-dom-hd-1', carrier: 'fedex', service: 'FedEx Home Delivery (1-day transit)', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-23', status: 'published', deliveryTarget: 'by-dec-24', transitNote: '1-day transit', lookupUrl: LOOKUP.fedexGroundMap, notes: 'Same last-day grid as FedEx Ground on the official chart. Confirm transit time by ZIP. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-dom-ge', carrier: 'fedex', service: 'FedEx Ground Economy', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-15', status: 'published', deliveryTarget: 'by-dec-24', notes: 'From the official 2026 last-day chart, for scheduled arrival by Dec. 24. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-dom-1fr', carrier: 'fedex', service: 'FedEx 1Day Freight', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-23', status: 'published', deliveryTarget: 'by-dec-24', notes: 'From the official 2026 last-day chart, for scheduled arrival by Dec. 24. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-dom-2fr', carrier: 'fedex', service: 'FedEx 2Day Freight', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-22', status: 'published', deliveryTarget: 'by-dec-24', notes: 'From the official 2026 last-day chart, for scheduled arrival by Dec. 24. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-dom-3fr', carrier: 'fedex', service: 'FedEx 3Day Freight', destination: 'domestic', destinationLabel: 'U.S. domestic', shipBy: '2026-12-21', status: 'published', deliveryTarget: 'by-dec-24', notes: 'From the official 2026 last-day chart, for scheduled arrival by Dec. 24. FedEx is closed Dec. 25.' }),

    row({ id: 'fedex-akhi', carrier: 'fedex', service: 'Alaska & Hawaii (no separate Express table)', destination: 'ak-hi', destinationLabel: 'Alaska & Hawaii', shipBy: null, status: 'no-single-date', deliveryTarget: 'by-dec-24', lookupUrl: LOOKUP.fedexGroundMap, notes: 'The official FedEx 2026 last-day chart does not publish separate Express dates for Alaska or Hawaii. It says Ground and Home Delivery transit times are typically 3 to 7 business days to and from Alaska and Hawaii, based on the destination ZIP Code. Look up the Ground map. FedEx is closed Dec. 25.' }),

    row({ id: 'fedex-ca-nf', carrier: 'fedex', service: 'FedEx International Next Flight', destination: 'canada', destinationLabel: 'U.S. to Canada', shipBy: '2026-12-23', status: 'published', deliveryTarget: 'by-dec-24', notes: 'Last day to ship for scheduled arrival by Dec. 24. FedEx is closed Dec. 25. International dates do not include extra time for customs clearance.' }),
    row({ id: 'fedex-ca-first', carrier: 'fedex', service: 'FedEx International First', destination: 'canada', destinationLabel: 'U.S. to Canada', shipBy: '2026-12-23', status: 'published', deliveryTarget: 'by-dec-24', notes: 'Last day to ship for scheduled arrival by Dec. 24. FedEx is closed Dec. 25. International dates do not include extra time for customs clearance.' }),
    row({ id: 'fedex-ca-ip', carrier: 'fedex', service: 'FedEx International Priority', destination: 'canada', destinationLabel: 'U.S. to Canada', shipBy: '2026-12-23', status: 'published', deliveryTarget: 'by-dec-24', notes: 'Last day to ship for scheduled arrival by Dec. 24. FedEx is closed Dec. 25. International dates do not include extra time for customs clearance.' }),
    row({ id: 'fedex-ca-ipd', carrier: 'fedex', service: 'FedEx International Priority Distribution', destination: 'canada', destinationLabel: 'U.S. to Canada', shipBy: '2026-12-22', status: 'published', deliveryTarget: 'by-dec-24', notes: 'Last day to ship for scheduled arrival by Dec. 24. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-ca-ie', carrier: 'fedex', service: 'FedEx International Economy', destination: 'canada', destinationLabel: 'U.S. to Canada', shipBy: '2026-12-21', status: 'published', deliveryTarget: 'by-dec-24', notes: 'Last day to ship for scheduled arrival by Dec. 24. FedEx is closed Dec. 25. International dates do not include extra time for customs clearance.' }),
    row({ id: 'fedex-ca-icp', carrier: 'fedex', service: 'FedEx International Connect Plus', destination: 'canada', destinationLabel: 'U.S. to Canada', shipBy: '2026-12-21', status: 'published', deliveryTarget: 'by-dec-24', notes: 'Last day to ship for scheduled arrival by Dec. 24. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-ca-g7', carrier: 'fedex', service: 'FedEx Ground U.S. to Canada (7-day transit)', destination: 'canada', destinationLabel: 'U.S. to Canada', shipBy: '2026-12-15', status: 'published', deliveryTarget: 'by-dec-24', transitNote: '7-day transit', lookupUrl: LOOKUP.fedexCanadaGround, notes: 'Last day if your route is a 7-day transit, from the official chart. Exact transit times depend on origin and destination ZIP codes. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-ca-g6', carrier: 'fedex', service: 'FedEx Ground U.S. to Canada (6-day transit)', destination: 'canada', destinationLabel: 'U.S. to Canada', shipBy: '2026-12-16', status: 'published', deliveryTarget: 'by-dec-24', transitNote: '6-day transit', lookupUrl: LOOKUP.fedexCanadaGround }),
    row({ id: 'fedex-ca-g5', carrier: 'fedex', service: 'FedEx Ground U.S. to Canada (5-day transit)', destination: 'canada', destinationLabel: 'U.S. to Canada', shipBy: '2026-12-17', status: 'published', deliveryTarget: 'by-dec-24', transitNote: '5-day transit', lookupUrl: LOOKUP.fedexCanadaGround }),
    row({ id: 'fedex-ca-g4', carrier: 'fedex', service: 'FedEx Ground U.S. to Canada (4-day transit)', destination: 'canada', destinationLabel: 'U.S. to Canada', shipBy: '2026-12-18', status: 'published', deliveryTarget: 'by-dec-24', transitNote: '4-day transit', lookupUrl: LOOKUP.fedexCanadaGround }),
    row({ id: 'fedex-ca-g3', carrier: 'fedex', service: 'FedEx Ground U.S. to Canada (3-day transit)', destination: 'canada', destinationLabel: 'U.S. to Canada', shipBy: '2026-12-19', status: 'published', deliveryTarget: 'by-dec-24', transitNote: '3-day transit', lookupUrl: LOOKUP.fedexCanadaGround }),
    row({ id: 'fedex-ca-g2', carrier: 'fedex', service: 'FedEx Ground U.S. to Canada (2-day transit)', destination: 'canada', destinationLabel: 'U.S. to Canada', shipBy: '2026-12-22', status: 'published', deliveryTarget: 'by-dec-24', transitNote: '2-day transit', lookupUrl: LOOKUP.fedexCanadaGround }),
    row({ id: 'fedex-ca-g1', carrier: 'fedex', service: 'FedEx Ground U.S. to Canada (1-day transit)', destination: 'canada', destinationLabel: 'U.S. to Canada', shipBy: '2026-12-23', status: 'published', deliveryTarget: 'by-dec-24', transitNote: '1-day transit', lookupUrl: LOOKUP.fedexCanadaGround }),

    row({ id: 'fedex-mx-nf', carrier: 'fedex', service: 'FedEx International Next Flight', destination: 'mexico', destinationLabel: 'U.S. to Mexico', shipBy: '2026-12-22', status: 'published', deliveryTarget: 'by-dec-24', notes: 'Last day to ship for scheduled arrival by Dec. 24. FedEx is closed Dec. 25. International dates do not include extra time for customs clearance.' }),
    row({ id: 'fedex-mx-first', carrier: 'fedex', service: 'FedEx International First', destination: 'mexico', destinationLabel: 'U.S. to Mexico', shipBy: '2026-12-22', status: 'published', deliveryTarget: 'by-dec-24' }),
    row({ id: 'fedex-mx-ip', carrier: 'fedex', service: 'FedEx International Priority', destination: 'mexico', destinationLabel: 'U.S. to Mexico', shipBy: '2026-12-22', status: 'published', deliveryTarget: 'by-dec-24' }),
    row({ id: 'fedex-mx-ie', carrier: 'fedex', service: 'FedEx International Economy', destination: 'mexico', destinationLabel: 'U.S. to Mexico', shipBy: '2026-12-21', status: 'published', deliveryTarget: 'by-dec-24' }),
    row({ id: 'fedex-mx-icp', carrier: 'fedex', service: 'FedEx International Connect Plus', destination: 'mexico', destinationLabel: 'U.S. to Mexico', shipBy: '2026-12-21', status: 'published', deliveryTarget: 'by-dec-24' }),

    row({ id: 'fedex-pr-nf', carrier: 'fedex', service: 'FedEx International Next Flight', destination: 'puerto-rico', destinationLabel: 'U.S. to Puerto Rico', shipBy: '2026-12-23', status: 'published', deliveryTarget: 'by-dec-24' }),
    row({ id: 'fedex-pr-first', carrier: 'fedex', service: 'FedEx International First', destination: 'puerto-rico', destinationLabel: 'U.S. to Puerto Rico', shipBy: '2026-12-23', status: 'published', deliveryTarget: 'by-dec-24' }),
    row({ id: 'fedex-pr-ip', carrier: 'fedex', service: 'FedEx International Priority', destination: 'puerto-rico', destinationLabel: 'U.S. to Puerto Rico', shipBy: '2026-12-23', status: 'published', deliveryTarget: 'by-dec-24' }),
    row({ id: 'fedex-pr-ie', carrier: 'fedex', service: 'FedEx International Economy', destination: 'puerto-rico', destinationLabel: 'U.S. to Puerto Rico', shipBy: '2026-12-22', status: 'published', deliveryTarget: 'by-dec-24' }),

    row({ id: 'fedex-other-intl', carrier: 'fedex', service: 'Other international destinations', destination: 'other-international', destinationLabel: 'U.S. to other international destinations', shipBy: null, status: 'no-single-date', deliveryTarget: 'by-dec-24', lookupUrl: LOOKUP.fedexRateFinder, notes: 'The official chart does not publish a single last-day table for other international destinations. Use fedex.com/ratefinder/home. FedEx is closed Dec. 25.' }),
    row({ id: 'fedex-military', carrier: 'fedex', service: 'Military destinations', destination: 'military', destinationLabel: 'Military destinations', shipBy: null, status: 'no-single-date', deliveryTarget: 'by-dec-24', lookupUrl: LOOKUP.fedexRateFinder, notes: 'The official FedEx 2026 last-day chart does not publish a military last-day table. It says to use Get Rates & Transit Times or call FedEx Customer Service. Do not use a past-year date.' })
  ];

  var CARRIERS = {
    usps: { id: 'usps', name: 'USPS', published: true, officialUrl: 'https://www.usps.com/holiday/holiday-shipping-dates.htm' },
    ups: { id: 'ups', name: 'UPS', published: true, officialUrl: 'https://www.ups.com/us/en/support/shipping-support/shipping-services/holiday-shipping-schedule' },
    fedex: { id: 'fedex', name: 'FedEx', published: true, officialUrl: 'https://www.fedex.com/en-us/holiday/last-days-to-ship.html' }
  };

  var DESTINATIONS = {
    usps: [
      { id: 'contiguous', label: 'Contiguous U.S. (lower 48, excluding Alaska & Hawaii)' },
      { id: 'ak-hi-pr-territories', label: 'Alaska, Hawaii, Puerto Rico & U.S. territories' },
      { id: 'international', label: 'International' },
      { id: 'military', label: 'Military (APO/FPO/DPO)' }
    ],
    ups: [
      { id: 'domestic', label: 'U.S. domestic' },
      { id: 'ak-hi', label: 'Alaska & Hawaii' },
      { id: 'canada', label: 'U.S. to Canada' },
      { id: 'mexico', label: 'U.S. to Mexico' },
      { id: 'other-international', label: 'Other international' }
    ],
    fedex: [
      { id: 'domestic', label: 'U.S. domestic' },
      { id: 'ak-hi', label: 'Alaska & Hawaii' },
      { id: 'canada', label: 'U.S. to Canada' },
      { id: 'mexico', label: 'U.S. to Mexico' },
      { id: 'puerto-rico', label: 'U.S. to Puerto Rico' },
      { id: 'other-international', label: 'Other international' },
      { id: 'military', label: 'Military destinations' }
    ]
  };

  function carrierStatus(carrierId) {
    var c = CARRIERS[carrierId];
    if (!c) {
      return { published: false, status: 'not-published-yet', label: 'Not published yet', officialUrl: null };
    }
    if (!c.published) {
      return { published: false, status: 'not-published-yet', label: 'Not published yet', officialUrl: c.officialUrl, name: c.name };
    }
    return { published: true, status: 'published', officialUrl: c.officialUrl, name: c.name };
  }

  // For tests and for any future year when a carrier has no 2026 table yet.
  function unpublishedCarrierResult(name, officialUrl) {
    return {
      published: false,
      status: 'not-published-yet',
      label: 'Not published yet',
      shipBy: null,
      name: name,
      officialUrl: officialUrl || null
    };
  }

  function deliveryTargetLabel(target) {
    if (target === 'before-dec-25') {
      return 'Recommended send-by for expected delivery before December 25 (not a guarantee)';
    }
    if (target === 'by-dec-24') {
      return 'Last day to ship for scheduled arrival by December 24 (carrier is closed December 25; no Christmas Day delivery)';
    }
    return '';
  }

  function shipByLabel(svc) {
    if (!svc) return '';
    if (svc.status === 'not-published-yet') return 'Not published yet';
    if (svc.status === 'not-applicable') return 'Not applicable (N/A)';
    if (svc.status === 'no-single-date') return 'Not a single published date';
    if (svc.status === 'see-official') return 'See the official page';
    if (svc.status === 'conflicting') {
      return svc.shipBy ? formatLongDate(svc.shipBy) + ' (conflicting dates on the official page — check the source)' : 'See the official page (conflicting dates)';
    }
    if (svc.shipBy) return formatLongDate(svc.shipBy);
    return 'Not a single published date';
  }

  function listServices(filter) {
    filter = filter || {};
    return SERVICES.filter(function (s) {
      if (filter.carrier && s.carrier !== filter.carrier) return false;
      if (filter.destination && s.destination !== filter.destination) return false;
      return true;
    }).map(function (s) { return s; });
  }

  function getService(id) {
    for (var i = 0; i < SERVICES.length; i++) {
      if (SERVICES[i].id === id) return SERVICES[i];
    }
    return null;
  }

  function sortKey(svc, key) {
    if (key === 'shipBy') return svc.shipBy || '9999-99-99';
    if (key === 'carrier') return svc.carrier || '';
    if (key === 'service') return (svc.service || '').toLowerCase();
    if (key === 'destination') return (svc.destinationLabel || '').toLowerCase();
    if (key === 'status') return svc.status || '';
    return '';
  }

  function sortServices(rows, key, dir) {
    var copy = rows.slice();
    var factor = dir === 'desc' ? -1 : 1;
    copy.sort(function (a, b) {
      var ka = sortKey(a, key);
      var kb = sortKey(b, key);
      if (ka < kb) return -1 * factor;
      if (ka > kb) return 1 * factor;
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });
    return copy;
  }

  function lookupService(filter) {
    var cs = filter && filter.carrier ? carrierStatus(filter.carrier) : null;
    if (cs && !cs.published) {
      return unpublishedCarrierResult(cs.name, cs.officialUrl);
    }
    if (filter && filter.id) return getService(filter.id);
    var rows = listServices(filter);
    return rows.length === 1 ? rows[0] : null;
  }

  var api = {
    CHECKED: CHECKED,
    CHRISTMAS_2026: CHRISTMAS_2026,
    TZ: TZ,
    SOURCES: SOURCES,
    LOOKUP: LOOKUP,
    SERVICES: SERVICES,
    CARRIERS: CARRIERS,
    DESTINATIONS: DESTINATIONS,
    weekdayUtc: weekdayUtc,
    parseISO: parseISO,
    daysBetween: daysBetween,
    formatLongDate: formatLongDate,
    todayInTimeZone: todayInTimeZone,
    isChristmas2026: isChristmas2026,
    countdown: countdown,
    carrierStatus: carrierStatus,
    unpublishedCarrierResult: unpublishedCarrierResult,
    deliveryTargetLabel: deliveryTargetLabel,
    shipByLabel: shipByLabel,
    listServices: listServices,
    getService: getService,
    sortServices: sortServices,
    lookupService: lookupService
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.HolidayShipping = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
