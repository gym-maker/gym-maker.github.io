(function (root) {
  'use strict';

  var UNITS = { 1: true, 100: true, 1000: true };

  function won(n) {
    if (!isFinite(n)) return '—';
    var sign = n < 0 ? '-' : '';
    var abs = Math.abs(Math.round(n));
    return sign + abs.toLocaleString('ko-KR') + '원';
  }

  function isInt(n) {
    return typeof n === 'number' && isFinite(n) && Math.round(n) === n;
  }

  function findPerson(people, id) {
    for (var i = 0; i < people.length; i++) {
      if (people[i].id === id) return people[i];
    }
    return null;
  }

  function weightOf(person) {
    var w = person && person.weight != null ? Number(person.weight) : 1;
    return w;
  }

  function floorToUnit(amountTimesWeight, weightSum, unit) {
    // floor(amount * w / W / unit) * unit, with a tiny epsilon for floats
    return Math.floor(amountTimesWeight / (weightSum * unit) + 1e-12) * unit;
  }

  function shareRound(people, round, unit) {
    var amount = round.amount;
    var payerId = round.payerId;
    var attendeeIds = round.attendeeIds || [];
    var label = round.label || '';
    var id = round.id;

    if (!isInt(amount) || amount < 0) {
      return { ok: false, reason: 'invalid-amount' };
    }
    if (!UNITS[unit]) {
      return { ok: false, reason: 'invalid-unit' };
    }
    if (!payerId || !findPerson(people, payerId)) {
      return { ok: false, reason: 'invalid-payer' };
    }
    if (!attendeeIds.length) {
      return { ok: false, reason: 'no-attendees' };
    }

    var attendees = [];
    var seen = {};
    var W = 0;
    for (var i = 0; i < attendeeIds.length; i++) {
      var aid = attendeeIds[i];
      if (seen[aid]) continue;
      seen[aid] = true;
      var p = findPerson(people, aid);
      if (!p) return { ok: false, reason: 'unknown-attendee' };
      var w = weightOf(p);
      if (!isFinite(w) || w <= 0) return { ok: false, reason: 'invalid-weight' };
      attendees.push({ person: p, weight: w });
      W += w;
    }
    if (W <= 0) return { ok: false, reason: 'invalid-weight' };

    var shares = [];
    var flooredSum = 0;
    for (var j = 0; j < attendees.length; j++) {
      var a = attendees[j];
      var raw = amount * a.weight / W;
      var floored = floorToUnit(amount * a.weight, W, unit);
      shares.push({
        personId: a.person.id,
        name: a.person.name,
        weight: a.weight,
        raw: raw,
        floored: floored,
        share: floored
      });
      flooredSum += floored;
    }
    var remainder = amount - flooredSum;
    if (remainder < 0) {
      return { ok: false, reason: 'rounding-overflow' };
    }

    var payerShare = null;
    for (var k = 0; k < shares.length; k++) {
      if (shares[k].personId === payerId) {
        payerShare = shares[k];
        break;
      }
    }
    if (payerShare) {
      payerShare.share = payerShare.floored + remainder;
    } else {
      var payer = findPerson(people, payerId);
      shares.push({
        personId: payerId,
        name: payer.name,
        weight: 0,
        raw: 0,
        floored: 0,
        share: remainder,
        attended: false
      });
    }

    return {
      ok: true,
      reason: null,
      roundId: id,
      label: label,
      amount: amount,
      unit: unit,
      payerId: payerId,
      remainder: remainder,
      remainderBearerId: payerId,
      attendees: attendees.map(function (a) { return a.person.id; }),
      shares: shares
    };
  }

  function compareParty(a, b) {
    if (b.amount !== a.amount) return b.amount - a.amount;
    var an = a.name || '';
    var bn = b.name || '';
    if (an < bn) return -1;
    if (an > bn) return 1;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  }

  function settleTransfers(balances) {
    var debtors = [];
    var creditors = [];
    for (var i = 0; i < balances.length; i++) {
      var b = balances[i];
      if (b.net < 0) debtors.push({ id: b.personId, name: b.name, amount: -b.net });
      else if (b.net > 0) creditors.push({ id: b.personId, name: b.name, amount: b.net });
    }
    debtors.sort(compareParty);
    creditors.sort(compareParty);

    var transfers = [];
    var di = 0, ci = 0;
    while (di < debtors.length && ci < creditors.length) {
      var d = debtors[di];
      var c = creditors[ci];
      var t = Math.min(d.amount, c.amount);
      if (t > 0) {
        transfers.push({
          fromId: d.id,
          fromName: d.name,
          toId: c.id,
          toName: c.name,
          amount: t
        });
      }
      d.amount -= t;
      c.amount -= t;
      if (d.amount === 0) di++;
      if (c.amount === 0) ci++;
    }
    return transfers;
  }

  function joinNames(names) {
    return names.join('·');
  }

  function buildMessage(people, roundsUsed, shareRounds, balances, transfers, unit) {
    var lines = [];
    lines.push('연말 모임 N빵 정산');
    lines.push('');
    for (var i = 0; i < shareRounds.length; i++) {
      var r = shareRounds[i];
      var payer = findPerson(people, r.payerId);
      var attendeeNames = r.attendees.map(function (id) {
        var p = findPerson(people, id);
        return p ? p.name : id;
      });
      lines.push(
        (r.label || (i + 1) + '차') + ' ' + won(r.amount) +
        ' — 결제 ' + (payer ? payer.name : r.payerId) +
        ', 참석 ' + joinNames(attendeeNames)
      );
      var bits = r.shares
        .filter(function (s) { return s.share > 0 || r.attendees.indexOf(s.personId) !== -1; })
        .map(function (s) { return s.name + ' ' + won(s.share); });
      lines.push('  ' + bits.join(' / '));
    }
    lines.push('');
    if (!transfers.length) {
      lines.push('정산: 주고받을 금액이 없습니다.');
    } else {
      lines.push('정산 (상계 후 송금 ' + transfers.length + '건)');
      for (var t = 0; t < transfers.length; t++) {
        var tr = transfers[t];
        lines.push(tr.fromName + ' → ' + tr.toName + ' ' + won(tr.amount));
      }
    }
    lines.push('');
    if (unit === 1) {
      lines.push('* 1원 단위입니다. 나누어떨어지지 않으면 자투리는 그 차를 결제하신 분이 부담합니다.');
    } else {
      lines.push('* ' + won(unit) + ' 단위로 내리고, 자투리는 그 차를 결제하신 분이 부담합니다.');
    }
    lines.push('* 입력한 금액만 사용한 산술이며, 실제 이체가 아닙니다.');
    return lines.join('\n');
  }

  function settle(people, rounds, options) {
    people = people || [];
    rounds = rounds || [];
    options = options || {};
    var unit = options.unit == null ? 100 : Number(options.unit);

    if (!UNITS[unit]) return { ok: false, reason: 'invalid-unit' };
    if (!people.length) return { ok: false, reason: 'no-people' };

    var ids = {};
    for (var i = 0; i < people.length; i++) {
      var p = people[i];
      if (!p || !p.id) return { ok: false, reason: 'invalid-person' };
      if (ids[p.id]) return { ok: false, reason: 'duplicate-id' };
      ids[p.id] = true;
      var w = weightOf(p);
      if (!isFinite(w) || w <= 0) return { ok: false, reason: 'invalid-weight' };
    }

    var used = [];
    for (var r = 0; r < rounds.length; r++) {
      var rd = rounds[r];
      if (!rd) continue;
      if (rd.amount == null || rd.amount === '' || Number(rd.amount) === 0) {
        if (rd.amount === 0) {
          // a zero-amount round is skipped, not an error
        }
        continue;
      }
      used.push(rd);
    }
    if (!used.length) return { ok: false, reason: 'no-rounds' };

    var shareRounds = [];
    var paid = {};
    var owed = {};
    people.forEach(function (p) {
      paid[p.id] = 0;
      owed[p.id] = 0;
    });

    for (var u = 0; u < used.length; u++) {
      var sr = shareRound(people, used[u], unit);
      if (!sr.ok) return sr;
      shareRounds.push(sr);
      paid[sr.payerId] += sr.amount;
      for (var s = 0; s < sr.shares.length; s++) {
        var sh = sr.shares[s];
        owed[sh.personId] += sh.share;
      }
    }

    var balances = people.map(function (p) {
      var pay = paid[p.id] || 0;
      var owe = owed[p.id] || 0;
      return {
        personId: p.id,
        name: p.name,
        paid: pay,
        owed: owe,
        net: pay - owe
      };
    });

    var netSum = balances.reduce(function (acc, b) { return acc + b.net; }, 0);
    if (netSum !== 0) {
      return { ok: false, reason: 'unbalanced', netSum: netSum, shareRounds: shareRounds, balances: balances };
    }

    var transfers = settleTransfers(balances);
    var message = buildMessage(people, used, shareRounds, balances, transfers, unit);

    return {
      ok: true,
      reason: null,
      unit: unit,
      shareRounds: shareRounds,
      balances: balances,
      transfers: transfers,
      message: message
    };
  }

  var api = {
    UNITS: { 1: 1, 100: 100, 1000: 1000 },
    won: won,
    floorToUnit: floorToUnit,
    shareRound: shareRound,
    settleTransfers: settleTransfers,
    settle: settle
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Nbbang = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
