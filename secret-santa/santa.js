/* Secret Santa / 마니또 — client-side derangement with exclusions.
   Works in the browser and in Node tests. No network. */
(function (global) {
  'use strict';

  var XOR_KEY = 'ss-v1'; /* light obfuscation only, not a secret */

  function SantaError(code, en, ko, details) {
    var e = new Error(en);
    e.name = 'SantaError';
    e.code = code;
    e.messageEn = en;
    e.messageKo = ko;
    e.details = details || null;
    return e;
  }

  function mulberry32(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function parseNames(text) {
    var lines = String(text || '').split(/\r?\n/);
    var names = [];
    for (var i = 0; i < lines.length; i++) {
      var n = lines[i].replace(/^\s+|\s+$/g, '');
      if (n) names.push(n);
    }
    return names;
  }

  function normalizeNames(names) {
    var list = (names || []).map(function (n) { return String(n).replace(/^\s+|\s+$/g, ''); }).filter(Boolean);
    if (list.length < 2) {
      throw SantaError(
        'too-few',
        'Enter at least two names.',
        '이름을 두 명 이상 넣어 주세요.'
      );
    }
    if (list.length > 200) {
      throw SantaError(
        'too-many',
        'This page handles up to 200 people.',
        '이 페이지는 최대 200명까지 뽑을 수 있어요.'
      );
    }
    var seen = Object.create(null);
    for (var i = 0; i < list.length; i++) {
      var key = list[i].toLowerCase();
      if (seen[key]) {
        throw SantaError(
          'duplicate',
          'The name "' + list[i] + '" appears more than once. Give each person a distinct name (for example, add a last initial).',
          '"' + list[i] + '" 이름이 중복돼요. 사람마다 구분되는 이름(성이나 이니셜을 붙이기)으로 적어 주세요.',
          { name: list[i] }
        );
      }
      seen[key] = true;
    }
    return list;
  }

  /* forbidden: array of [giverIndex, recipientIndex] (directed). Self is always banned. */
  function buildAdj(n, forbidden) {
    var ban = Object.create(null);
    var i, j, k, pair;
    for (i = 0; i < n; i++) ban[i + '>' + i] = true;
    if (forbidden) {
      for (k = 0; k < forbidden.length; k++) {
        pair = forbidden[k];
        if (!pair || pair.length < 2) continue;
        i = pair[0] | 0;
        j = pair[1] | 0;
        if (i === j) continue;
        if (i < 0 || j < 0 || i >= n || j >= n) continue;
        ban[i + '>' + j] = true;
      }
    }
    var adj = [];
    for (i = 0; i < n; i++) {
      var row = [];
      for (j = 0; j < n; j++) {
        if (!ban[i + '>' + j]) row.push(j);
      }
      adj.push(row);
    }
    return adj;
  }

  function couplesToForbidden(couples) {
    var out = [];
    if (!couples) return out;
    for (var k = 0; k < couples.length; k++) {
      var p = couples[k];
      if (!p || p.length < 2) continue;
      var a = p[0] | 0, b = p[1] | 0;
      if (a === b) continue;
      out.push([a, b], [b, a]);
    }
    return out;
  }

  function explainImpossible(names, adj) {
    var empty = [], i, v;
    for (i = 0; i < adj.length; i++) if (adj[i].length === 0) empty.push(names[i]);
    if (empty.length) {
      var who = empty.join(', ');
      return {
        en: who + (empty.length === 1 ? ' has' : ' have') + ' no allowed recipient. Loosen the exclusions or add more people.',
        ko: who + ' 님에게 가능한 상대가 없어요. 제외 쌍을 줄이거나 사람을 더 넣어 주세요.'
      };
    }
    var incoming = [];
    for (i = 0; i < adj.length; i++) incoming[i] = 0;
    for (i = 0; i < adj.length; i++) {
      for (var k = 0; k < adj[i].length; k++) incoming[adj[i][k]]++;
    }
    var noIn = [];
    for (i = 0; i < incoming.length; i++) if (incoming[i] === 0) noIn.push(names[i]);
    if (noIn.length) {
      who = noIn.join(', ');
      return {
        en: 'Nobody is allowed to give a gift to ' + who + '. Loosen the exclusions.',
        ko: who + ' 님에게 선물을 줄 수 있는 사람이 없어요. 제외 쌍을 줄여 주세요.'
      };
    }
    return {
      en: 'These exclusions make a valid Secret Santa draw impossible. Everyone must give and receive exactly once, and no one can draw themselves or an excluded person.',
      ko: '지금 제외 설정으로는 유효한 마니또 뽑기가 불가능해요. 누구나 자기 자신이나 제외된 상대가 아닌 한 명에게 선물을 주고, 누구나 한 명에게서 받아야 해요.'
    };
  }

  function matchingSize(adj, rng) {
    var n = adj.length;
    var shufAdj = [];
    var i;
    for (i = 0; i < n; i++) shufAdj[i] = rng ? shuffle(adj[i], rng) : adj[i].slice();
    var order = [];
    for (i = 0; i < n; i++) order[i] = i;
    if (rng) order = shuffle(order, rng);
    var matchR = [];
    for (i = 0; i < n; i++) matchR[i] = -1;

    function dfs(u, seen) {
      var row = shufAdj[u];
      for (var k = 0; k < row.length; k++) {
        var v = row[k];
        if (seen[v]) continue;
        seen[v] = true;
        if (matchR[v] < 0 || dfs(matchR[v], seen)) {
          matchR[v] = u;
          return true;
        }
      }
      return false;
    }

    var size = 0;
    for (i = 0; i < order.length; i++) {
      var seen = [];
      for (var t = 0; t < n; t++) seen[t] = false;
      if (dfs(order[i], seen)) size++;
    }
    return { size: size, matchR: matchR };
  }

  function assignmentFromMatchR(matchR) {
    var n = matchR.length;
    var assign = [];
    var i;
    for (i = 0; i < n; i++) assign[i] = -1;
    for (i = 0; i < n; i++) {
      if (matchR[i] < 0) return null;
      assign[matchR[i]] = i;
    }
    return assign;
  }

  function isValidAssignment(assign, adj) {
    if (!assign || assign.length !== adj.length) return false;
    var n = assign.length;
    var seen = [];
    var i, v, ok, k;
    for (i = 0; i < n; i++) seen[i] = false;
    for (i = 0; i < n; i++) {
      v = assign[i];
      if (v === i || v < 0 || v >= n || seen[v]) return false;
      ok = false;
      for (k = 0; k < adj[i].length; k++) if (adj[i][k] === v) { ok = true; break; }
      if (!ok) return false;
      seen[v] = true;
    }
    return true;
  }

  function generate(names, opts) {
    opts = opts || {};
    var list = normalizeNames(names);
    var n = list.length;
    var forbidden = opts.forbidden || couplesToForbidden(opts.couples || []);
    var adj = buildAdj(n, forbidden);
    var rng = typeof opts.rng === 'function' ? opts.rng : mulberry32((opts.seed == null ? (Math.random() * 0xFFFFFFFF) : opts.seed) >>> 0);

    var feasible = matchingSize(adj, null);
    if (feasible.size < n) {
      var why = explainImpossible(list, adj);
      throw SantaError('impossible', why.en, why.ko, { adj: adj });
    }

    var tries = opts.tries || 24;
    var assign = null;
    var t;
    for (t = 0; t < tries; t++) {
      var m = matchingSize(adj, rng);
      assign = assignmentFromMatchR(m.matchR);
      if (isValidAssignment(assign, adj)) break;
      assign = null;
    }
    if (!assign) {
      var why2 = explainImpossible(list, adj);
      throw SantaError('impossible', why2.en, why2.ko);
    }

    var pairs = [];
    for (t = 0; t < n; t++) {
      pairs.push({ from: list[t], to: list[assign[t]], fromIndex: t, toIndex: assign[t] });
    }
    return { names: list, assignment: assign, pairs: pairs };
  }

  function utf8Encode(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var buf = typeof Buffer !== 'undefined' ? Buffer.from(str, 'utf8') : null;
    if (buf) return new Uint8Array(buf);
    throw new Error('No UTF-8 encoder');
  }

  function utf8Decode(bytes) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('utf8');
    throw new Error('No UTF-8 decoder');
  }

  function xorBytes(bytes) {
    var key = utf8Encode(XOR_KEY);
    var out = new Uint8Array(bytes.length);
    for (var i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ key[i % key.length];
    return out;
  }

  function b64urlEncode(bytes) {
    var s;
    if (typeof Buffer !== 'undefined' && typeof window === 'undefined') {
      s = Buffer.from(bytes).toString('base64');
    } else {
      var bin = '';
      for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      s = btoa(bin);
    }
    return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function b64urlDecode(s) {
    var t = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    var bytes;
    if (typeof Buffer !== 'undefined' && typeof window === 'undefined') {
      bytes = new Uint8Array(Buffer.from(t, 'base64'));
    } else {
      var bin = atob(t);
      bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }

  function encodeReveal(payload) {
    var json = JSON.stringify({
      v: 1,
      f: payload.from,
      t: payload.to,
      b: payload.budget || '',
      d: payload.date || ''
    });
    return 'r=' + b64urlEncode(xorBytes(utf8Encode(json)));
  }

  function decodeReveal(fragment) {
    var raw = String(fragment || '');
    if (raw.charAt(0) === '#') raw = raw.slice(1);
    var idx = raw.indexOf('r=');
    if (idx < 0) return null;
    raw = raw.slice(idx + 2);
    var amp = raw.indexOf('&');
    if (amp >= 0) raw = raw.slice(0, amp);
    if (!raw) return null;
    try {
      var json = utf8Decode(xorBytes(b64urlDecode(raw)));
      var p = JSON.parse(json);
      if (!p || p.v !== 1 || !p.f || !p.t) return null;
      return { from: String(p.f), to: String(p.t), budget: p.b ? String(p.b) : '', date: p.d ? String(p.d) : '' };
    } catch (err) {
      return null;
    }
  }

  var api = {
    parseNames: parseNames,
    normalizeNames: normalizeNames,
    generate: generate,
    buildAdj: buildAdj,
    couplesToForbidden: couplesToForbidden,
    matchingSize: matchingSize,
    isValidAssignment: isValidAssignment,
    encodeReveal: encodeReveal,
    decodeReveal: decodeReveal,
    mulberry32: mulberry32,
    SantaError: SantaError
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.SecretSanta = api;
})(typeof window !== 'undefined' ? window : globalThis);
