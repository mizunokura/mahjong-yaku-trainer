import { useState, useCallback, useMemo, useEffect } from "react";

// ─── Tile Constants ───
const SUITS = { m: "萬", p: "筒", s: "索", z: "字" };
const NUM_KANJI = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const HONOR_NAMES = ["", "東", "南", "西", "北", "白", "發", "中"];
const SUIT_COLORS = { m: "#b8282e", p: "#1b5ea8", s: "#27713a", z: "#3a3226" };
const SUIT_BG = {
  m: { normal: "linear-gradient(to bottom, #fce4e2, #f0c4be)", selected: "linear-gradient(to bottom, #fdd6d0, #f0b0a6)" },
  p: { normal: "linear-gradient(to bottom, #e2ecfc, #bed0f0)", selected: "linear-gradient(to bottom, #d0e0fd, #a6c0f0)" },
  s: { normal: "linear-gradient(to bottom, #e2fce6, #bef0c8)", selected: "linear-gradient(to bottom, #d0fdd6, #a6f0b0)" },
  z: { normal: "linear-gradient(to bottom, #f5f3ee, #e6e0d4)", selected: "linear-gradient(to bottom, #f0ecdc, #e0d8c4)" },
};
const SUIT_BORDER = { m: "#d88a84", p: "#84a0d8", s: "#84d894", z: "#c4b896" };
const SUIT_ICONS = { m: "漢", p: "●", s: "竹" };

function tileKey(t) { return `${t.suit}${t.num}`; }
function tileSortVal(t) {
  const suitOrder = { m: 0, p: 1, s: 2, z: 3 };
  return suitOrder[t.suit] * 10 + t.num;
}
function sortTiles(tiles) { return [...tiles].sort((a, b) => tileSortVal(a) - tileSortVal(b)); }
function tileLabel(t) { return t.suit === "z" ? HONOR_NAMES[t.num] : NUM_KANJI[t.num]; }
function tileSuitLabel(t) { return t.suit === "z" ? "" : SUITS[t.suit]; }

function buildWall() {
  const tiles = []; let id = 0;
  for (const suit of ["m", "p", "s"])
    for (let num = 1; num <= 9; num++)
      for (let i = 0; i < 4; i++) tiles.push({ suit, num, id: id++ });
  for (let num = 1; num <= 7; num++)
    for (let i = 0; i < 4; i++) tiles.push({ suit: "z", num, id: id++ });
  return tiles;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function countByKey(tiles) {
  const m = {};
  tiles.forEach(t => { const k = tileKey(t); m[k] = (m[k] || 0) + 1; });
  return m;
}

function isTerminalOrHonor(t) { return t.suit === "z" || t.num === 1 || t.num === 9; }
function isTerminal(t) { return t.suit !== "z" && (t.num === 1 || t.num === 9); }
function isMiddle(t) { return t.suit !== "z" && t.num >= 2 && t.num <= 8; }

// ─── Hand Decomposition ───
// Finds the best grouping of tiles into mentsu, pairs, partial groups, and isolated tiles.
// Uses recursive search maximizing: mentsu count first, then pairs.

function decomposeHand(tiles) {
  const counts = {};
  const tilesByKey = {};
  tiles.forEach(t => {
    const k = tileKey(t);
    counts[k] = (counts[k] || 0) + 1;
    if (!tilesByKey[k]) tilesByKey[k] = [];
    tilesByKey[k].push(t);
  });

  let bestResult = null;
  let bestScore = -1;

  function score(groups) {
    let s = 0;
    groups.forEach(g => {
      if (g.type === "kantsu") s += 1000;
      else if (g.type === "koutsu" || g.type === "shuntsu") s += 100;
      else if (g.type === "toitsu") s += 10;
    });
    return s;
  }

  function solve(c, groups, depth) {
    if (depth > 20) return; // safety

    const s = score(groups);
    if (s > bestScore) {
      bestScore = s;
      bestResult = [...groups];
    }

    // Get all keys with remaining tiles, sorted
    const keys = Object.keys(c).filter(k => c[k] > 0).sort();
    if (keys.length === 0) return;

    const key = keys[0];
    const suit = key[0];
    const num = parseInt(key.slice(1));

    // Try kantsu (4 of same)
    if (c[key] >= 4) {
      c[key] -= 4;
      groups.push({ type: "kantsu", key, suit, num });
      solve(c, groups, depth + 1);
      groups.pop();
      c[key] += 4;
    }

    // Try koutsu (3 of same)
    if (c[key] >= 3) {
      c[key] -= 3;
      groups.push({ type: "koutsu", key, suit, num });
      solve(c, groups, depth + 1);
      groups.pop();
      c[key] += 3;
    }

    // Try shuntsu (sequence) - only for number suits
    if (suit !== "z" && num <= 7) {
      const k2 = `${suit}${num + 1}`, k3 = `${suit}${num + 2}`;
      if (c[k2] > 0 && c[k3] > 0) {
        c[key]--; c[k2]--; c[k3]--;
        groups.push({ type: "shuntsu", key, suit, num });
        solve(c, groups, depth + 1);
        groups.pop();
        c[key]++; c[k2]++; c[k3]++;
      }
    }

    // Try toitsu (pair)
    if (c[key] >= 2) {
      c[key] -= 2;
      groups.push({ type: "toitsu", key, suit, num });
      solve(c, groups, depth + 1);
      groups.pop();
      c[key] += 2;
    }

    // Leave as isolated and move on
    const leftover = c[key];
    c[key] = 0;
    groups.push({ type: "isolated", key, suit, num, count: leftover });
    solve(c, groups, depth + 1);
    groups.pop();
    c[key] = leftover;
  }

  const c = { ...counts };
  solve(c, [], 0);

  if (!bestResult) return [];

  // Now assign actual tile objects to each group
  const remaining = {};
  Object.keys(tilesByKey).forEach(k => { remaining[k] = [...tilesByKey[k]]; });

  function takeTiles(key, n) {
    const arr = remaining[key] || [];
    return arr.splice(0, n);
  }

  return bestResult.map(g => {
    if (g.type === "kantsu") {
      return { ...g, tiles: takeTiles(g.key, 4) };
    } else if (g.type === "koutsu") {
      return { ...g, tiles: takeTiles(g.key, 3) };
    } else if (g.type === "shuntsu") {
      const t1 = takeTiles(g.key, 1);
      const t2 = takeTiles(`${g.suit}${g.num + 1}`, 1);
      const t3 = takeTiles(`${g.suit}${g.num + 2}`, 1);
      return { ...g, tiles: [...t1, ...t2, ...t3] };
    } else if (g.type === "toitsu") {
      return { ...g, tiles: takeTiles(g.key, 2) };
    } else {
      return { ...g, tiles: takeTiles(g.key, g.count) };
    }
  });
}

// Also detect tatsu (partial sequences) from isolated tiles for extra insight
function detectTatsu(groups) {
  // Collect all isolated tiles back
  const isoTiles = [];
  const nonIso = [];
  groups.forEach(g => {
    if (g.type === "isolated") {
      g.tiles.forEach(t => isoTiles.push(t));
    } else {
      nonIso.push(g);
    }
  });

  if (isoTiles.length < 2) return groups;

  const sorted = sortTiles(isoTiles);
  const used = new Set();
  const tatsuGroups = [];

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].id)) continue;
    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(sorted[j].id)) continue;
      if (sorted[i].suit === sorted[j].suit && sorted[i].suit !== "z") {
        const diff = sorted[j].num - sorted[i].num;
        if (diff === 1 || diff === 2) {
          tatsuGroups.push({
            type: "tatsu",
            subtype: diff === 1 ? "連続" : "嵌張",
            suit: sorted[i].suit,
            tiles: [sorted[i], sorted[j]],
          });
          used.add(sorted[i].id);
          used.add(sorted[j].id);
          break;
        }
      }
    }
  }

  const remainingIso = sorted.filter(t => !used.has(t.id));
  const result = [...nonIso, ...tatsuGroups];
  if (remainingIso.length > 0) {
    result.push({ type: "isolated", tiles: remainingIso, count: remainingIso.length });
  }
  return result;
}

// ─── Structure Analysis (used by all yaku distance calcs) ───
function analyzeStructure(tiles) {
  const raw = decomposeHand(tiles);
  const groups = detectTatsu(raw);

  let shuntsuCount = 0, koutsuCount = 0, kantsuCount = 0;
  let toitsuCount = 0, tatsuCount = 0, isolatedCount = 0;
  const shuntsuList = [], koutsuList = [], toitsuList = [];

  groups.forEach(g => {
    switch (g.type) {
      case "shuntsu": shuntsuCount++; shuntsuList.push(g); break;
      case "koutsu":  koutsuCount++;  koutsuList.push(g); break;
      case "kantsu":  kantsuCount++;  break;
      case "toitsu":  toitsuCount++;  toitsuList.push(g); break;
      case "tatsu":   tatsuCount++;   break;
      case "isolated": isolatedCount += (g.tiles || []).length; break;
    }
  });

  const mentsu = shuntsuCount + koutsuCount + kantsuCount;
  const partial = toitsuCount + tatsuCount;
  const maxPartial = Math.min(partial, 4 - mentsu + 1);
  const shanten = Math.max(-1, 8 - 2 * mentsu - maxPartial);

  return {
    shuntsuCount, koutsuCount, kantsuCount, toitsuCount, tatsuCount, isolatedCount,
    mentsu, partial, shanten,
    shuntsuList, koutsuList, toitsuList, groups,
  };
}

// ─── Yaku Definitions ───
const YAKU_DEFS = [
  {
    name: "断么九", reading: "タンヤオ", han: 1,
    explain: "1・9・字牌を一切使わず、2〜8の数牌だけで手を作る。鳴いても成立（食いタン）。",
    calc: (hand, melds, ctx, struct) => {
      const all = [...hand, ...melds.flatMap(m => m.tiles)];
      const bad = all.filter(t => isTerminalOrHonor(t));
      const wanted = [];
      if (bad.length > 0) {
        for (const suit of ["m", "p", "s"])
          for (let n = 2; n <= 8; n++) wanted.push({ suit, num: n });
      }
      return { distance: bad.length, desc: `么九字牌: ${bad.length}枚`,
        obstacles: bad.filter(t => hand.some(h => h.id === t.id)),
        wanted: wanted.slice(0, 6),
        targetDesc: "全牌2〜8の数牌のみ" };
    }
  },
  {
    name: "役牌", reading: "ヤクハイ", han: 1,
    explain: "三元牌（白・發・中）、場風牌、自風牌のいずれかを刻子にする。鳴いてもOK。",
    calc: (hand, melds, ctx, struct) => {
      const all = [...hand, ...melds.flatMap(m => m.tiles)];
      const counts = countByKey(all);
      const yakuTiles = ["z5", "z6", "z7"];
      if (ctx?.seatWind) yakuTiles.push(`z${ctx.seatWind}`);
      if (ctx?.roundWind) yakuTiles.push(`z${ctx.roundWind}`);
      const meldYaku = melds.some(m => m.type === "pon" && yakuTiles.includes(tileKey(m.tiles[0])));
      if (meldYaku) return { distance: 0, desc: "役牌刻子あり", obstacles: [], wanted: [], targetDesc: "役牌刻子完成" };
      const handYaku = struct.koutsuList.some(g => yakuTiles.includes(g.key));
      if (handYaku) return { distance: 0, desc: "役牌刻子あり", obstacles: [], wanted: [], targetDesc: "役牌刻子完成" };
      let minDist = 99, bestKey = null;
      yakuTiles.forEach(k => {
        const c = counts[k] || 0;
        const d = Math.max(0, 3 - c);
        if (d < minDist) { minDist = d; bestKey = k; }
      });
      const wanted = bestKey ? [{ suit: bestKey[0], num: parseInt(bestKey[1]) }] : [];
      const nameMap = { z1: "東", z2: "南", z3: "西", z4: "北", z5: "白", z6: "發", z7: "中" };
      return { distance: minDist, desc: `最も近い役牌まで${minDist}枚`,
        obstacles: [], wanted,
        targetDesc: bestKey ? `${nameMap[bestKey]}${nameMap[bestKey]}${nameMap[bestKey]} + 通常手` : "" };
    }
  },
  {
    name: "平和", reading: "ピンフ", han: 1,
    explain: "4面子すべて順子、雀頭が役牌以外、両面待ちで聴牌。門前限定。",
    calc: (hand, melds, ctx, struct) => {
      if (melds.length > 0) return { distance: 99, desc: "門前のみ", obstacles: [], wanted: [], targetDesc: "" };
      const honorTiles = hand.filter(t => t.suit === "z");
      const pMentsu = struct.shuntsuCount;
      const yakuKeys = new Set(["z5", "z6", "z7"]);
      if (ctx?.seatWind) yakuKeys.add(`z${ctx.seatWind}`);
      if (ctx?.roundWind) yakuKeys.add(`z${ctx.roundWind}`);
      const nonHonorPairs = struct.toitsuList.filter(g => g.tiles[0].suit !== "z");
      const hasValidPair = nonHonorPairs.length > 0;
      const needShuntsu = 4 - pMentsu;
      const pairSlot = hasValidPair ? 1 : 0;
      const sparePairs = Math.max(0, nonHonorPairs.length - pairSlot);
      const partialsForShuntsu = struct.tatsuCount + sparePairs;
      const easyFills = Math.min(needShuntsu, partialsForShuntsu);
      const hardFills = needShuntsu - easyFills;
      const stuckMentsu = struct.koutsuCount + struct.kantsuCount;
      const pairPenalty = hasValidPair ? 0 : 1;
      let dist = easyFills + hardFills * 2 + stuckMentsu + pairPenalty;
      dist = Math.max(dist, honorTiles.length);
      // Hints
      const obstacles = [...honorTiles];
      struct.koutsuList.forEach(g => { if (g.tiles[0]) obstacles.push(g.tiles[0]); }); // koutsu is obstacle for pinfu
      const wanted = [];
      struct.groups.forEach(g => {
        if (g.type === "tatsu" && g.tiles.length === 2) {
          const t1 = g.tiles[0], t2 = g.tiles[1];
          const lo = Math.min(t1.num, t2.num), hi = Math.max(t1.num, t2.num);
          if (hi - lo === 1) { if (lo > 1) wanted.push({ suit: t1.suit, num: lo - 1 }); if (hi < 9) wanted.push({ suit: t1.suit, num: hi + 1 }); }
          else if (hi - lo === 2) wanted.push({ suit: t1.suit, num: lo + 1 });
        }
      });
      return { distance: dist, desc: `順子${pMentsu}/4 字牌${honorTiles.length}枚`,
        obstacles: obstacles.slice(0, 5), wanted: wanted.slice(0, 6),
        targetDesc: "順子×4 + 非役牌の対子 (両面待ち)" };
    }
  },
  {
    name: "一盃口", reading: "イーペーコー", han: 1,
    explain: "同じ種類・同じ数の順子を2組作る（例: 二三四 二三四）。門前限定。",
    calc: (hand, melds, ctx, struct) => {
      if (melds.length > 0) return { distance: 99, desc: "門前のみ", obstacles: [], wanted: [], targetDesc: "" };
      const counts = countByKey(hand);
      let best = 99, bestSuit = "m", bestStart = 1;
      for (const suit of ["m", "p", "s"])
        for (let start = 1; start <= 7; start++) {
          const keys = [0, 1, 2].map(i => `${suit}${start + i}`);
          const mins = keys.map(k => counts[k] || 0);
          const d = Math.min(...mins) >= 2 ? 0 : Math.max(0, 6 - mins.reduce((a, b) => a + Math.min(b, 2), 0));
          if (d < best) { best = d; bestSuit = suit; bestStart = start; }
        }
      if (best === 0) {
        const shuntsuKeys = struct.shuntsuList.map(g => g.key);
        const hasDup = shuntsuKeys.some((k, i) => shuntsuKeys.indexOf(k) !== i);
        if (!hasDup) best = 1;
      }
      const wanted = [];
      for (let i = 0; i < 3; i++) {
        const k = `${bestSuit}${bestStart + i}`;
        if ((counts[k] || 0) < 2) wanted.push({ suit: bestSuit, num: bestStart + i });
      }
      const sn = SUITS[bestSuit];
      return { distance: best, desc: `同順2組まで${best}枚`,
        obstacles: [], wanted: wanted.slice(0, 4),
        targetDesc: `${sn}${NUM_KANJI[bestStart]}${NUM_KANJI[bestStart+1]}${NUM_KANJI[bestStart+2]} × 2` };
    }
  },
  {
    name: "七対子", reading: "チートイツ", han: 2,
    explain: "7つの対子（同じ牌2枚）で構成する特殊形。面子を作らない。門前限定。",
    calc: (hand, melds, ctx, struct) => {
      if (melds.length > 0) return { distance: 99, desc: "門前のみ", obstacles: [], wanted: [], targetDesc: "" };
      const counts = countByKey(hand);
      const pairs = Object.entries(counts).filter(([, c]) => c >= 2);
      const singles = Object.entries(counts).filter(([, c]) => c === 1);
      const dist = Math.max(0, 7 - pairs.length);
      const wanted = singles.slice(0, dist).map(([k]) => ({ suit: k[0], num: parseInt(k.slice(1)) }));
      const obstacles = [];
      if (dist > 0) {
        // Tiles that are in triplets (extra copy wastes a slot)
        Object.entries(counts).forEach(([k, c]) => {
          if (c >= 3) {
            const t = hand.find(t2 => tileKey(t2) === k);
            if (t) obstacles.push(t);
          }
        });
      }
      return { distance: dist, desc: `対子: ${pairs.length}/7`,
        obstacles: obstacles.slice(0, 4), wanted: wanted.slice(0, 5),
        targetDesc: "7つの対子（すべて異なる牌×2枚）" };
    }
  },
  {
    name: "対々和", reading: "トイトイ", han: 2,
    explain: "4面子すべてを刻子（同じ牌3枚）で揃える。ポンで鳴いてもOK。",
    calc: (hand, melds, ctx, struct) => {
      const meldTrips = melds.filter(m => m.type === "pon").length;
      const total = meldTrips + struct.koutsuCount + struct.kantsuCount;
      const need = Math.max(0, 4 - total);
      const pairsAvail = Math.max(0, struct.toitsuCount - 1);
      const easy = Math.min(need, pairsAvail);
      const hard = need - easy;
      const dist = easy + hard * 2;
      // Wanted: tiles to upgrade pairs to triplets
      const wanted = struct.toitsuList.slice(0, need).map(g => ({ suit: g.suit, num: g.num }));
      // Obstacles: shuntsu tiles (shuntsu won't help toitoi)
      const obstacles = [];
      struct.shuntsuList.forEach(g => { if (g.tiles[0]) obstacles.push(g.tiles[0]); });
      return { distance: dist, desc: `刻子: ${total}/4`,
        obstacles: obstacles.slice(0, 4), wanted: wanted.slice(0, 4),
        targetDesc: "刻子×4 + 対子（雀頭）" };
    }
  },
  {
    name: "三色同順", reading: "サンショク", han: 2,
    explain: "萬子・筒子・索子の3色で同じ数の順子を作る（例: 萬123 筒123 索123）。",
    calc: (hand, melds, ctx, struct) => {
      const allShuntsu = [
        ...struct.shuntsuList.map(g => ({ suit: g.suit, num: g.num })),
        ...melds.filter(m => m.type === "chi").map(m => { const s = sortTiles(m.tiles); return { suit: s[0].suit, num: s[0].num }; }),
      ];
      const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];
      const counts = countByKey(allTiles);
      let best = 99, bestStart = 1;
      for (let start = 1; start <= 7; start++) {
        const completedSuits = new Set();
        allShuntsu.forEach(s => { if (s.num === start) completedSuits.add(s.suit); });
        let missing = 0;
        for (const suit of ["m", "p", "s"]) {
          if (completedSuits.has(suit)) continue;
          for (let i = 0; i < 3; i++) if (!(counts[`${suit}${start + i}`] > 0)) missing++;
        }
        if (missing < best) { best = missing; bestStart = start; }
      }
      const wanted = [];
      for (const suit of ["m", "p", "s"])
        for (let i = 0; i < 3; i++) {
          const k = `${suit}${bestStart + i}`;
          if (!(counts[k] > 0)) wanted.push({ suit, num: bestStart + i });
        }
      const nn = [NUM_KANJI[bestStart], NUM_KANJI[bestStart+1], NUM_KANJI[bestStart+2]].join("");
      return { distance: best, desc: `三色まで${best}枚`,
        obstacles: [], wanted: wanted.slice(0, 6),
        targetDesc: `萬${nn} 筒${nn} 索${nn}` };
    }
  },
  {
    name: "一気通貫", reading: "イッツー", han: 2,
    explain: "同じ種類で123・456・789の3つの順子を揃える。",
    calc: (hand, melds, ctx, struct) => {
      const allShuntsu = [
        ...struct.shuntsuList.map(g => ({ suit: g.suit, num: g.num })),
        ...melds.filter(m => m.type === "chi").map(m => { const s = sortTiles(m.tiles); return { suit: s[0].suit, num: s[0].num }; }),
      ];
      const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];
      const counts = countByKey(allTiles);
      let best = 99, bestSuit = "m";
      for (const suit of ["m", "p", "s"]) {
        let totalMissing = 0;
        for (const sn of [1, 4, 7]) {
          if (allShuntsu.some(s => s.suit === suit && s.num === sn)) continue;
          for (let i = 0; i < 3; i++) if (!(counts[`${suit}${sn + i}`] > 0)) totalMissing++;
        }
        if (totalMissing < best) { best = totalMissing; bestSuit = suit; }
      }
      const wanted = [];
      for (const sn of [1, 4, 7])
        for (let i = 0; i < 3; i++) {
          const k = `${bestSuit}${sn + i}`;
          if (!(counts[k] > 0)) wanted.push({ suit: bestSuit, num: sn + i });
        }
      const sn = SUITS[bestSuit];
      return { distance: best, desc: `通貫まで${best}枚`,
        obstacles: [], wanted: wanted.slice(0, 6),
        targetDesc: `${sn}一二三 ${sn}四五六 ${sn}七八九` };
    }
  },
  {
    name: "混全帯么九", reading: "チャンタ", han: 2,
    explain: "すべての面子と雀頭に1・9・字牌が含まれる。",
    calc: (hand, melds, ctx, struct) => {
      const meldCount = melds.length;
      const totalMentsu = struct.mentsu + meldCount;
      const needMentsu = Math.max(0, 4 - totalMentsu);

      // Check completed mentsu for chanta violation
      let badMentsu = 0;
      const completedGroups = [
        ...struct.groups.filter(g => ["shuntsu", "koutsu", "kantsu"].includes(g.type)),
        ...melds.map(m => ({ tiles: m.tiles })),
      ];
      completedGroups.forEach(g => {
        if (!g.tiles.some(t => isTerminalOrHonor(t))) badMentsu++;
      });

      // Pair check
      const hasValidPair = struct.toitsuList.some(g => g.tiles.some(t => isTerminalOrHonor(t)));
      const pairDist = struct.toitsuCount > 0 ? (hasValidPair ? 0 : 1) : 1;

      // Tatsu that can form chanta-valid sequences (123 or 789)
      let chantaTatsu = 0;
      struct.groups.forEach(g => {
        if (g.type !== "tatsu" || !g.tiles[0] || g.tiles[0].suit === "z") return;
        const nums = g.tiles.map(t => t.num);
        if (nums.some(n => n <= 2) || nums.some(n => n >= 8)) chantaTatsu++;
      });

      // Middle tiles (4-6) can never appear in 123 or 789
      const middleTiles = hand.filter(t => t.suit !== "z" && t.num >= 4 && t.num <= 6);

      // Distance: easy partials (chanta tatsu need 1 tile) + hard fills (2 per) + violations
      const easyFills = Math.min(needMentsu, chantaTatsu);
      const hardFills = needMentsu - easyFills;
      const dist = easyFills + hardFills * 2 + badMentsu + pairDist + middleTiles.length;

      const obstacles = [
        ...hand.filter(t => t.suit !== "z" && t.num >= 4 && t.num <= 6),
        ...completedGroups.filter(g => !g.tiles.some(t => isTerminalOrHonor(t)))
          .flatMap(g => g.tiles).filter(t => hand.some(h => h.id === t.id)),
      ];
      const wanted = [];
      struct.groups.forEach(g => {
        if (g.type !== "tatsu" || !g.tiles[0] || g.tiles[0].suit === "z") return;
        const nums = g.tiles.map(t => t.num).sort((a, b) => a - b);
        const s = g.tiles[0].suit;
        if (nums[0] <= 2 && nums[0] - 1 >= 1) wanted.push({ suit: s, num: nums[0] - 1 });
        if (nums[1] >= 8 && nums[1] + 1 <= 9) wanted.push({ suit: s, num: nums[1] + 1 });
        if (nums[1] - nums[0] === 2) wanted.push({ suit: s, num: nums[0] + 1 });
      });
      return { distance: Math.min(dist, 12),
        desc: `面子${totalMentsu}/4 非チャンタ${badMentsu} 中張${middleTiles.length}枚`,
        obstacles: obstacles.slice(0, 5), wanted: wanted.slice(0, 6) };
    }
  },
  {
    name: "混一色", reading: "ホンイツ", han: 3,
    explain: "1種類の数牌＋字牌だけで手を構成する。鳴くと2翻に下がる。",
    calc: (hand, melds, ctx, struct) => {
      const all = [...hand, ...melds.flatMap(m => m.tiles)];
      let best = 99, bestSuit = "m";
      for (const suit of ["m", "p", "s"]) {
        const bad = all.filter(t => t.suit !== suit && t.suit !== "z").length;
        if (bad < best) { best = bad; bestSuit = suit; }
      }
      const obstacles = hand.filter(t => t.suit !== bestSuit && t.suit !== "z");
      return { distance: best, desc: `他色数字: ${best}枚`,
        obstacles: obstacles.slice(0, 5), wanted: [],
        targetDesc: `${SUITS[bestSuit]}＋字牌のみ` };
    }
  },
  {
    name: "二盃口", reading: "リャンペーコー", han: 3,
    explain: "一盃口を2組作る。門前限定。七対子と同じ形になることもある。",
    calc: (hand, melds, ctx, struct) => {
      if (melds.length > 0) return { distance: 99, desc: "門前のみ", obstacles: [], wanted: [], targetDesc: "" };
      const counts = countByKey(hand);
      let pairSeqs = 0;
      for (const suit of ["m", "p", "s"])
        for (let s = 1; s <= 7; s++)
          if (Math.min(...[0, 1, 2].map(i => counts[`${suit}${s + i}`] || 0)) >= 2) pairSeqs++;
      const dist = Math.max(0, (2 - pairSeqs) * 3);
      return { distance: dist, desc: `同順対: ${pairSeqs}/2`,
        obstacles: [], wanted: [],
        targetDesc: "同一順子×2 を2セット + 対子" };
    }
  },
  {
    name: "清一色", reading: "チンイツ", han: 6,
    explain: "1種類の数牌のみで手を構成する（字牌なし）。鳴くと5翻。",
    calc: (hand, melds, ctx, struct) => {
      const all = [...hand, ...melds.flatMap(m => m.tiles)];
      let best = 99, bestSuit = "m";
      for (const suit of ["m", "p", "s"]) {
        const bad = all.filter(t => t.suit !== suit).length;
        if (bad < best) { best = bad; bestSuit = suit; }
      }
      const obstacles = hand.filter(t => t.suit !== bestSuit);
      return { distance: best, desc: `他色・字牌: ${best}枚`,
        obstacles: obstacles.slice(0, 6), wanted: [],
        targetDesc: `${SUITS[bestSuit]}のみ（字牌なし）` };
    }
  },
  {
    name: "国士無双", reading: "コクシ", han: 13,
    explain: "13種すべての么九牌（1・9・字牌）を1枚ずつ＋いずれか1枚で対子。門前限定。",
    calc: (hand, melds, ctx, struct) => {
      if (melds.length > 0) return { distance: 99, desc: "門前のみ", obstacles: [], wanted: [], targetDesc: "" };
      const needed = ["m1","m9","p1","p9","s1","s9","z1","z2","z3","z4","z5","z6","z7"];
      const counts = countByKey(hand);
      let have = 0, hasPair = false;
      needed.forEach(k => { if (counts[k] >= 1) have++; if (counts[k] >= 2) hasPair = true; });
      const missing = needed.filter(k => !(counts[k] > 0));
      const wanted = missing.map(k => ({ suit: k[0], num: parseInt(k.slice(1)) }));
      const obstacles = hand.filter(t => !isTerminalOrHonor(t));
      return { distance: Math.max(0, (13 - have) + (hasPair ? 0 : 1) - 1),
        desc: `${have}/13種 ${hasPair ? "雀頭有" : "雀頭無"}`,
        obstacles: obstacles.slice(0, 6), wanted: wanted.slice(0, 6),
        targetDesc: "一九萬 一九筒 一九索 東南西北白發中 + 1枚" };
    }
  },
  {
    name: "四暗刻", reading: "スーアンコー", han: 13,
    explain: "4つの面子すべてを暗刻（鳴かずに揃えた刻子）にする。門前限定。",
    calc: (hand, melds, ctx, struct) => {
      if (melds.length > 0) return { distance: 99, desc: "門前のみ", obstacles: [], wanted: [], targetDesc: "" };
      const trips = struct.koutsuCount + struct.kantsuCount;
      const need = Math.max(0, 4 - trips);
      const pairsAvail = Math.max(0, struct.toitsuCount - 1);
      const easy = Math.min(need, pairsAvail);
      const hard = need - easy;
      const dist = easy + hard * 2;
      const wanted = struct.toitsuList.slice(0, need).map(g => ({ suit: g.suit, num: g.num }));
      return { distance: dist, desc: `暗刻: ${trips}/4`,
        obstacles: [], wanted: wanted.slice(0, 4),
        targetDesc: "暗刻×4 + 対子（すべて門前）" };
    }
  },
  {
    name: "字一色", reading: "ツーイーソー", han: 13,
    explain: "すべての牌を字牌（東南西北白發中）だけで構成する。",
    calc: (hand, melds, ctx, struct) => {
      const all = [...hand, ...melds.flatMap(m => m.tiles)];
      const bad = all.filter(t => t.suit !== "z");
      const obstacles = bad.filter(t => hand.some(h => h.id === t.id));
      return { distance: bad.length, desc: `数牌: ${bad.length}枚`,
        obstacles: obstacles.slice(0, 6), wanted: [],
        targetDesc: "東南西北白發中のみ" };
    }
  },
  {
    name: "緑一色", reading: "リューイーソー", han: 13,
    explain: "索子の2・3・4・6・8と發のみで構成。すべて緑色の牌だけを使う。",
    calc: (hand, melds, ctx, struct) => {
      const green = new Set(["s2", "s3", "s4", "s6", "s8", "z6"]);
      const all = [...hand, ...melds.flatMap(m => m.tiles)];
      const bad = all.filter(t => !green.has(tileKey(t)));
      const obstacles = bad.filter(t => hand.some(h => h.id === t.id));
      const wanted = [{ suit: "s", num: 2 }, { suit: "s", num: 3 }, { suit: "s", num: 4 },
        { suit: "s", num: 6 }, { suit: "s", num: 8 }, { suit: "z", num: 6 }];
      return { distance: bad.length, desc: `緑以外: ${bad.length}枚`,
        obstacles: obstacles.slice(0, 6), wanted: wanted.slice(0, 4),
        targetDesc: "索子2346發 のみ" };
    }
  },
  {
    name: "清老頭", reading: "チンロートー", han: 13,
    explain: "数牌の1と9だけですべてを構成する（字牌なし）。必然的に対々和の形。",
    calc: (hand, melds, ctx, struct) => {
      const all = [...hand, ...melds.flatMap(m => m.tiles)];
      const bad = all.filter(t => !isTerminal(t));
      const obstacles = bad.filter(t => hand.some(h => h.id === t.id));
      const wanted = [{ suit: "m", num: 1 }, { suit: "m", num: 9 }, { suit: "p", num: 1 },
        { suit: "p", num: 9 }, { suit: "s", num: 1 }, { suit: "s", num: 9 }];
      return { distance: bad.length, desc: `非老頭: ${bad.length}枚`,
        obstacles: obstacles.slice(0, 6), wanted: wanted.slice(0, 4),
        targetDesc: "一九萬 一九筒 一九索 のみ（対々形）" };
    }
  },
];

function analyzeYaku(handTiles, melds, ctx, maxHan) {
  const struct = analyzeStructure(handTiles);
  return YAKU_DEFS
    .filter(y => y.han <= maxHan)
    .map(y => ({ name: y.name, reading: y.reading, han: y.han, explain: y.explain,
      result: y.calc(handTiles, melds, ctx, struct) }))
    .filter(r => r.result.distance < 13);
}

// ─── Score Calculation ───

function checkHandComplete(tiles, melds) {
  const totalTiles = tiles.length + melds.reduce((s, m) => s + m.tiles.length, 0);
  if (totalTiles !== 14) return null;

  const neededMentsu = 4 - melds.length;
  const struct = analyzeStructure(tiles);

  // Regular form: exactly neededMentsu mentsu + 1 pair, no leftovers
  if (struct.mentsu >= neededMentsu && struct.toitsuCount >= 1
      && struct.tatsuCount === 0 && struct.isolatedCount === 0) {
    return { type: "regular", struct };
  }

  // Seven pairs (menzen only)
  if (melds.length === 0) {
    const counts = countByKey(tiles);
    const entries = Object.entries(counts);
    if (entries.length === 7 && entries.every(([, c]) => c === 2)) {
      return { type: "chiitoi" };
    }
  }

  // Kokushi (menzen only)
  if (melds.length === 0) {
    const needed13 = ["m1","m9","p1","p9","s1","s9","z1","z2","z3","z4","z5","z6","z7"];
    const counts = countByKey(tiles);
    if (needed13.every(k => (counts[k] || 0) >= 1) && needed13.some(k => (counts[k] || 0) >= 2)) {
      return { type: "kokushi" };
    }
  }

  return null;
}

function resolveYakuConflicts(yakuList) {
  const names = new Set(yakuList.map(y => y.name));
  return yakuList.filter(y => {
    if (y.name === "混一色" && (names.has("清一色") || names.has("字一色"))) return false;
    if (y.name === "一盃口" && names.has("二盃口")) return false;
    if (y.name === "混全帯么九" && (names.has("清老頭") || names.has("純全帯么九"))) return false;
    if (y.name === "対々和" && (names.has("清老頭") || names.has("四暗刻"))) return false;
    return true;
  });
}

function calculateFu(agariInfo, melds, resolvedYaku, ctx) {
  if (agariInfo.type === "chiitoi") return 25;
  if (agariInfo.type === "kokushi") return 30;

  const isPinfu = resolvedYaku.some(y => y.name === "平和");
  if (isPinfu) return 30;

  const struct = agariInfo.struct;
  const isMenzen = melds.length === 0;
  let fu = isMenzen ? 30 : 20;

  // Hand koutsu/kantsu
  struct.groups.forEach(g => {
    if (g.type === "koutsu" && g.tiles[0]) {
      fu += isTerminalOrHonor(g.tiles[0]) ? 8 : 4;
    }
    if (g.type === "kantsu" && g.tiles[0]) {
      fu += isTerminalOrHonor(g.tiles[0]) ? 32 : 16;
    }
  });

  // Meld pon (open triplet)
  melds.forEach(m => {
    if (m.type === "pon" && m.tiles[0]) {
      fu += isTerminalOrHonor(m.tiles[0]) ? 4 : 2;
    }
  });

  // Yakuhai pair
  const yakuKeys = new Set(["z5", "z6", "z7"]);
  if (ctx?.seatWind) yakuKeys.add(`z${ctx.seatWind}`);
  if (ctx?.roundWind) yakuKeys.add(`z${ctx.roundWind}`);
  struct.toitsuList?.forEach(g => {
    if (yakuKeys.has(g.key)) fu += 2;
  });

  return Math.ceil(fu / 10) * 10;
}

function calculateScore(han, fu) {
  if (han >= 13) return { label: "役満", dealer: 48000, child: 32000 };
  if (han >= 11) return { label: "三倍満", dealer: 36000, child: 24000 };
  if (han >= 8) return { label: "倍満", dealer: 24000, child: 16000 };
  if (han >= 6) return { label: "跳満", dealer: 18000, child: 12000 };

  const base = fu * Math.pow(2, han + 2);
  const dealer = Math.ceil((base * 6) / 100) * 100;
  const child = Math.ceil((base * 4) / 100) * 100;

  if (han >= 5 || child >= 8000) {
    return { label: "満貫", dealer: 12000, child: 8000 };
  }

  return { label: null, dealer, child };
}

// ─── Shanten & Accept Tiles ───

function calculateShanten(handTiles, meldCount) {
  const struct = analyzeStructure(handTiles);
  const neededMentsu = 4 - meldCount;
  const mentsu = Math.min(struct.mentsu, neededMentsu);
  const remaining = neededMentsu - mentsu;
  const partial = struct.toitsuCount + struct.tatsuCount;
  const maxPartial = Math.min(partial, remaining + 1);
  const regularShanten = Math.max(-1, 2 * remaining - maxPartial);

  // Chiitoi (menzen only)
  let chiitoiShanten = 99;
  if (meldCount === 0) {
    const counts = countByKey(handTiles);
    const pairs = Object.values(counts).filter(c => c >= 2).length;
    chiitoiShanten = 6 - pairs;
  }

  // Kokushi (menzen only)
  let kokushiShanten = 99;
  if (meldCount === 0) {
    const needed13 = ["m1","m9","p1","p9","s1","s9","z1","z2","z3","z4","z5","z6","z7"];
    const counts = countByKey(handTiles);
    let have = 0, hasPair = false;
    needed13.forEach(k => { if ((counts[k] || 0) >= 1) have++; if ((counts[k] || 0) >= 2) hasPair = true; });
    kokushiShanten = 13 - have - (hasPair ? 1 : 0);
  }

  return Math.min(regularShanten, chiitoiShanten, kokushiShanten);
}

function findAcceptTiles(handTiles, melds, visibleTiles) {
  const meldCount = melds.length;
  const currentShanten = calculateShanten(handTiles, meldCount);

  if (currentShanten > 1 || currentShanten < 0) return { shanten: currentShanten, tiles: [] };

  const visibleCounts = countByKey(visibleTiles);
  const acceptTiles = [];

  const allTypes = [];
  for (const suit of ["m", "p", "s"])
    for (let num = 1; num <= 9; num++) allTypes.push({ suit, num });
  for (let num = 1; num <= 7; num++) allTypes.push({ suit: "z", num });

  for (const { suit, num } of allTypes) {
    const key = `${suit}${num}`;
    const visible = visibleCounts[key] || 0;
    if (visible >= 4) continue;

    const newTiles = [...handTiles, { suit, num, id: -1 }];
    const newShanten = calculateShanten(newTiles, meldCount);

    if (newShanten < currentShanten) {
      acceptTiles.push({ suit, num, remaining: 4 - visible });
    }
  }

  return { shanten: currentShanten, tiles: acceptTiles };
}

// ─── Quiz Hand Generation ───

function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function validateTileCounts(tiles) {
  if (tiles.length !== 14) return false;
  const counts = {};
  for (const t of tiles) {
    const k = `${t.suit}${t.num}`;
    counts[k] = (counts[k] || 0) + 1;
    if (counts[k] > 4) return false;
  }
  return true;
}

function genPinfuHand() {
  const tiles = [];
  for (let i = 0; i < 4; i++) {
    const suit = randItem(["m", "p", "s"]);
    const start = randInt(1, 7);
    tiles.push({ suit, num: start }, { suit, num: start + 1 }, { suit, num: start + 2 });
  }
  const suit = randItem(["m", "p", "s"]);
  const num = randInt(2, 8);
  tiles.push({ suit, num }, { suit, num });
  return tiles;
}

function genTanyaoHand() {
  const tiles = [];
  for (let i = 0; i < 4; i++) {
    if (Math.random() < 0.7) {
      const suit = randItem(["m", "p", "s"]);
      const start = randInt(2, 6);
      tiles.push({ suit, num: start }, { suit, num: start + 1 }, { suit, num: start + 2 });
    } else {
      const suit = randItem(["m", "p", "s"]);
      const num = randInt(2, 8);
      tiles.push({ suit, num }, { suit, num }, { suit, num });
    }
  }
  const suit = randItem(["m", "p", "s"]);
  const num = randInt(2, 8);
  tiles.push({ suit, num }, { suit, num });
  return tiles;
}

function genYakuhaiHand() {
  const tiles = [];
  const yakuNum = randItem([5, 6, 7]);
  tiles.push({ suit: "z", num: yakuNum }, { suit: "z", num: yakuNum }, { suit: "z", num: yakuNum });
  for (let i = 0; i < 3; i++) {
    const suit = randItem(["m", "p", "s"]);
    const start = randInt(1, 7);
    tiles.push({ suit, num: start }, { suit, num: start + 1 }, { suit, num: start + 2 });
  }
  const suit = randItem(["m", "p", "s"]);
  const num = randInt(1, 9);
  tiles.push({ suit, num }, { suit, num });
  return tiles;
}

function genChiitoiHand() {
  const tiles = [];
  const used = new Set();
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 50; j++) {
      const suit = randItem(["m", "p", "s", "z"]);
      const maxN = suit === "z" ? 7 : 9;
      const num = randInt(1, maxN);
      const k = `${suit}${num}`;
      if (!used.has(k)) {
        used.add(k);
        tiles.push({ suit, num }, { suit, num });
        break;
      }
    }
  }
  return tiles.length === 14 ? tiles : null;
}

function genToitoiHand() {
  const tiles = [];
  const used = new Set();
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 50; j++) {
      const suit = randItem(["m", "p", "s", "z"]);
      const maxN = suit === "z" ? 7 : 9;
      const num = randInt(1, maxN);
      const k = `${suit}${num}`;
      if (!used.has(k)) {
        used.add(k);
        tiles.push({ suit, num }, { suit, num }, { suit, num });
        break;
      }
    }
  }
  for (let j = 0; j < 50; j++) {
    const suit = randItem(["m", "p", "s", "z"]);
    const maxN = suit === "z" ? 7 : 9;
    const num = randInt(1, maxN);
    if (!used.has(`${suit}${num}`)) {
      tiles.push({ suit, num }, { suit, num });
      break;
    }
  }
  return tiles.length === 14 ? tiles : null;
}

function genHonitsuHand() {
  const suit = randItem(["m", "p", "s"]);
  const tiles = [];
  for (let i = 0; i < 3; i++) {
    if (Math.random() < 0.7) {
      const start = randInt(1, 7);
      tiles.push({ suit, num: start }, { suit, num: start + 1 }, { suit, num: start + 2 });
    } else {
      const num = randInt(1, 9);
      tiles.push({ suit, num }, { suit, num }, { suit, num });
    }
  }
  const hn = randInt(1, 7);
  tiles.push({ suit: "z", num: hn }, { suit: "z", num: hn }, { suit: "z", num: hn });
  if (Math.random() < 0.5) {
    const num = randInt(1, 9);
    tiles.push({ suit, num }, { suit, num });
  } else {
    let hn2;
    do { hn2 = randInt(1, 7); } while (hn2 === hn);
    tiles.push({ suit: "z", num: hn2 }, { suit: "z", num: hn2 });
  }
  return tiles;
}

function genKokushiHand() {
  const needed = [
    { suit: "m", num: 1 }, { suit: "m", num: 9 },
    { suit: "p", num: 1 }, { suit: "p", num: 9 },
    { suit: "s", num: 1 }, { suit: "s", num: 9 },
    { suit: "z", num: 1 }, { suit: "z", num: 2 }, { suit: "z", num: 3 },
    { suit: "z", num: 4 }, { suit: "z", num: 5 }, { suit: "z", num: 6 }, { suit: "z", num: 7 },
  ];
  const tiles = needed.map(t => ({ ...t }));
  tiles.push({ ...needed[randInt(0, 12)] });
  return tiles;
}

function genSanshokuHand() {
  const start = randInt(1, 7);
  const tiles = [];
  for (const suit of ["m", "p", "s"]) {
    tiles.push({ suit, num: start }, { suit, num: start + 1 }, { suit, num: start + 2 });
  }
  // 4th mentsu
  const suit4 = randItem(["m", "p", "s"]);
  if (Math.random() < 0.6) {
    const s = randInt(1, 7);
    tiles.push({ suit: suit4, num: s }, { suit: suit4, num: s + 1 }, { suit: suit4, num: s + 2 });
  } else {
    const n = randInt(1, 9);
    tiles.push({ suit: suit4, num: n }, { suit: suit4, num: n }, { suit: suit4, num: n });
  }
  // Pair
  const suitP = randItem(["m", "p", "s"]);
  const numP = randInt(1, 9);
  tiles.push({ suit: suitP, num: numP }, { suit: suitP, num: numP });
  return tiles;
}

function genIttsuHand() {
  const suit = randItem(["m", "p", "s"]);
  const tiles = [];
  for (const s of [1, 4, 7]) {
    tiles.push({ suit, num: s }, { suit, num: s + 1 }, { suit, num: s + 2 });
  }
  // 4th mentsu
  const suit4 = randItem(["m", "p", "s"]);
  if (Math.random() < 0.6) {
    const s = randInt(1, 7);
    tiles.push({ suit: suit4, num: s }, { suit: suit4, num: s + 1 }, { suit: suit4, num: s + 2 });
  } else {
    const n = randInt(1, 9);
    tiles.push({ suit: suit4, num: n }, { suit: suit4, num: n }, { suit: suit4, num: n });
  }
  // Pair
  const suitP = randItem(["m", "p", "s"]);
  const numP = randInt(1, 9);
  tiles.push({ suit: suitP, num: numP }, { suit: suitP, num: numP });
  return tiles;
}

function genChantaHand() {
  const tiles = [];
  for (let i = 0; i < 3; i++) {
    if (Math.random() < 0.7) {
      const suit = randItem(["m", "p", "s"]);
      const start = Math.random() < 0.5 ? 1 : 7;
      tiles.push({ suit, num: start }, { suit, num: start + 1 }, { suit, num: start + 2 });
    } else {
      if (Math.random() < 0.5) {
        const suit = randItem(["m", "p", "s"]);
        const num = Math.random() < 0.5 ? 1 : 9;
        tiles.push({ suit, num }, { suit, num }, { suit, num });
      } else {
        const num = randInt(1, 7);
        tiles.push({ suit: "z", num }, { suit: "z", num }, { suit: "z", num });
      }
    }
  }
  // 4th mentsu with terminal/honor
  if (Math.random() < 0.5) {
    const num = randInt(1, 7);
    tiles.push({ suit: "z", num }, { suit: "z", num }, { suit: "z", num });
  } else {
    const suit = randItem(["m", "p", "s"]);
    const start = Math.random() < 0.5 ? 1 : 7;
    tiles.push({ suit, num: start }, { suit, num: start + 1 }, { suit, num: start + 2 });
  }
  // Pair (terminal or honor)
  if (Math.random() < 0.5) {
    const suit = randItem(["m", "p", "s"]);
    const num = Math.random() < 0.5 ? 1 : 9;
    tiles.push({ suit, num }, { suit, num });
  } else {
    const num = randInt(1, 7);
    tiles.push({ suit: "z", num }, { suit: "z", num });
  }
  return tiles;
}

function genChinitsuHand() {
  const suit = randItem(["m", "p", "s"]);
  const tiles = [];
  for (let i = 0; i < 4; i++) {
    if (Math.random() < 0.7) {
      const start = randInt(1, 7);
      tiles.push({ suit, num: start }, { suit, num: start + 1 }, { suit, num: start + 2 });
    } else {
      const num = randInt(1, 9);
      tiles.push({ suit, num }, { suit, num }, { suit, num });
    }
  }
  const num = randInt(1, 9);
  tiles.push({ suit, num }, { suit, num });
  return tiles;
}

function genSuuankoHand() {
  const tiles = [];
  const used = new Set();
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 50; j++) {
      const suit = randItem(["m", "p", "s", "z"]);
      const maxN = suit === "z" ? 7 : 9;
      const num = randInt(1, maxN);
      const k = `${suit}${num}`;
      if (!used.has(k)) {
        used.add(k);
        tiles.push({ suit, num }, { suit, num }, { suit, num });
        break;
      }
    }
  }
  for (let j = 0; j < 50; j++) {
    const suit = randItem(["m", "p", "s", "z"]);
    const maxN = suit === "z" ? 7 : 9;
    const num = randInt(1, maxN);
    if (!used.has(`${suit}${num}`)) {
      tiles.push({ suit, num }, { suit, num });
      break;
    }
  }
  return tiles.length === 14 ? tiles : null;
}

function genTsuiisoHand() {
  const tiles = [];
  const nums = [1, 2, 3, 4, 5, 6, 7];
  const shuffled = shuffle(nums.map(n => n));
  // 4 triplets + 1 pair from 7 honor types
  for (let i = 0; i < 4; i++) {
    const num = shuffled[i];
    tiles.push({ suit: "z", num }, { suit: "z", num }, { suit: "z", num });
  }
  const pairNum = shuffled[4];
  tiles.push({ suit: "z", num: pairNum }, { suit: "z", num: pairNum });
  return tiles;
}

function genRyuiisoHand() {
  const greens = [
    { suit: "s", num: 2 }, { suit: "s", num: 3 }, { suit: "s", num: 4 },
    { suit: "s", num: 6 }, { suit: "s", num: 8 }, { suit: "z", num: 6 },
  ];
  const tiles = [];
  for (let i = 0; i < 4; i++) {
    if (Math.random() < 0.4) {
      // shuntsu 234
      tiles.push({ suit: "s", num: 2 }, { suit: "s", num: 3 }, { suit: "s", num: 4 });
    } else {
      const t = randItem(greens);
      tiles.push({ ...t }, { ...t }, { ...t });
    }
  }
  const p = randItem(greens);
  tiles.push({ ...p }, { ...p });
  return tiles;
}

function genChinrotoHand() {
  const terminals = [
    { suit: "m", num: 1 }, { suit: "m", num: 9 },
    { suit: "p", num: 1 }, { suit: "p", num: 9 },
    { suit: "s", num: 1 }, { suit: "s", num: 9 },
  ];
  const shuffled = shuffle([...terminals]);
  const tiles = [];
  for (let i = 0; i < 4; i++) {
    const t = shuffled[i];
    tiles.push({ ...t }, { ...t }, { ...t });
  }
  const p = shuffled[4];
  tiles.push({ ...p }, { ...p });
  return tiles;
}

function generateQuizHand(maxHan, ctx) {
  const strategies = [genPinfuHand, genTanyaoHand, genYakuhaiHand];
  if (maxHan >= 2) strategies.push(genChiitoiHand, genToitoiHand, genSanshokuHand, genIttsuHand, genChantaHand);
  if (maxHan >= 3) strategies.push(genHonitsuHand);
  if (maxHan >= 6) strategies.push(genChinitsuHand);
  if (maxHan >= 13) strategies.push(genKokushiHand, genSuuankoHand, genTsuiisoHand, genRyuiisoHand, genChinrotoHand);

  for (let i = 0; i < 200; i++) {
    const gen = randItem(strategies);
    const tiles = gen();
    if (!tiles || !validateTileCounts(tiles)) continue;

    const withIds = tiles.map((t, j) => ({ ...t, id: 2000 + j }));
    const analysis = analyzeYaku(withIds, [], ctx, maxHan);
    const completed = analysis.filter(y => y.result.distance === 0);
    const resolved = resolveYakuConflicts(completed);
    if (resolved.length === 0) continue;

    return sortTiles(withIds);
  }
  // Fallback
  const fb = genYakuhaiHand();
  return sortTiles(fb.map((t, i) => ({ ...t, id: 2000 + i })));
}

const LEVELS = [
  { name: "Lv.1 基本", maxHan: 1, label: "1翻" },
  { name: "Lv.2 応用", maxHan: 3, label: "〜3翻" },
  { name: "Lv.3 上級", maxHan: 6, label: "〜6翻" },
  { name: "Lv.4 役満", maxHan: 99, label: "全役" },
];

// ─── Meld simulation helpers ───
function simulatePon(hand, opponentTile) {
  const k = tileKey(opponentTile);
  const matching = hand.filter(t => tileKey(t) === k).slice(0, 2);
  if (matching.length < 2) return null;
  const newHand = [...hand];
  matching.forEach(mt => { const i = newHand.findIndex(t => t.id === mt.id); if (i !== -1) newHand.splice(i, 1); });
  return { hand: sortTiles(newHand), meld: { type: "pon", tiles: [...matching, opponentTile] } };
}

function findChiSequences(hand, opponentTile) {
  if (opponentTile.suit === "z") return [];
  const n = opponentTile.num, s = opponentTile.suit;
  const handSuit = hand.filter(t => t.suit === s);
  const seqs = [];
  for (const [a, b] of [[n-2, n-1], [n-1, n+1], [n+1, n+2]]) {
    if (a < 1 || a > 9 || b < 1 || b > 9) continue;
    const tA = handSuit.find(t => t.num === a);
    const tB = handSuit.find(t => t.num === b && t.id !== tA?.id);
    if (tA && tB) seqs.push([tA, tB]);
  }
  return seqs;
}

function simulateChi(hand, opponentTile, seqIdx = 0) {
  const seqs = findChiSequences(hand, opponentTile);
  if (seqs.length === 0) return null;
  const seq = seqs[Math.min(seqIdx, seqs.length - 1)];
  const newHand = [...hand];
  seq.forEach(st => { const i = newHand.findIndex(t => t.id === st.id); if (i !== -1) newHand.splice(i, 1); });
  return { hand: sortTiles(newHand), meld: { type: "chi", tiles: sortTiles([...seq, opponentTile]) } };
}

// ─── Diff merge logic ───
function mergeDiffs(currentAnalysis, previewAnalysis) {
  if (!previewAnalysis) {
    return currentAnalysis
      .sort((a, b) => a.result.distance - b.result.distance || a.han - b.han)
      .map(a => ({ ...a, diff: null }));
  }
  const curMap = {}, prevMap = {};
  currentAnalysis.forEach(a => { curMap[a.name] = a; });
  previewAnalysis.forEach(a => { prevMap[a.name] = a; });
  const allNames = new Set([...currentAnalysis.map(a => a.name), ...previewAnalysis.map(a => a.name)]);
  const merged = [];
  allNames.forEach(name => {
    const cur = curMap[name], prev = prevMap[name];
    if (cur && prev) merged.push({ ...prev, diff: prev.result.distance - cur.result.distance });
    else if (cur && !prev) merged.push({ ...cur, diff: "gone" });
    else if (!cur && prev) merged.push({ ...prev, diff: "new" });
  });
  return merged.sort((a, b) => {
    const ac = a.diff !== 0 && a.diff !== null ? 1 : 0;
    const bc = b.diff !== 0 && b.diff !== null ? 1 : 0;
    if (ac !== bc) return bc - ac;
    const av = a.diff === "new" ? -100 : a.diff === "gone" ? 100 : (typeof a.diff === "number" ? a.diff : 0);
    const bv = b.diff === "new" ? -100 : b.diff === "gone" ? 100 : (typeof b.diff === "number" ? b.diff : 0);
    if (av !== bv) return av - bv;
    return a.result.distance - b.result.distance || a.han - b.han;
  });
}

function computeSummary(list) {
  let closer = 0, farther = 0, newCount = 0, goneCount = 0;
  list.forEach(d => {
    if (typeof d.diff === "number" && d.diff < 0) closer++;
    if (typeof d.diff === "number" && d.diff > 0) farther++;
    if (d.diff === "new") newCount++;
    if (d.diff === "gone") goneCount++;
  });
  return { closer, farther, newCount, goneCount };
}

// ─── Group display config ───
const GROUP_STYLES = {
  kantsu:  { label: "槓子", color: "#e8a735", bg: "rgba(232,167,53,0.15)", border: "rgba(232,167,53,0.4)" },
  koutsu:  { label: "刻子", color: "#e87040", bg: "rgba(232,112,64,0.12)", border: "rgba(232,112,64,0.35)" },
  shuntsu: { label: "順子", color: "#4090e0", bg: "rgba(64,144,224,0.12)", border: "rgba(64,144,224,0.35)" },
  toitsu:  { label: "対子", color: "#a070d0", bg: "rgba(160,112,208,0.12)", border: "rgba(160,112,208,0.35)" },
  tatsu:   { label: "搭子", color: "#70b0a0", bg: "rgba(112,176,160,0.10)", border: "rgba(112,176,160,0.30)" },
  isolated:{ label: "孤立", color: "#6a7a5a", bg: "rgba(0,0,0,0.08)", border: "rgba(106,122,90,0.25)" },
};

// ─── Components ───

function Tile({ tile, onClick, selected, drawn, small, dimmed }) {
  const color = tile.suit === "z"
    ? (tile.num === 5 ? "#888" : tile.num === 6 ? "#27713a" : tile.num === 7 ? "#b8282e" : "#3a3226")
    : SUIT_COLORS[tile.suit];
  const bg = selected
    ? SUIT_BG[tile.suit].selected
    : SUIT_BG[tile.suit].normal;
  const borderColor = selected ? "#f0c050" : drawn ? "#e8a735" : SUIT_BORDER[tile.suit];
  const icon = SUIT_ICONS[tile.suit];
  return (
    <div onClick={onClick} style={{
      width: small ? 32 : 44, height: small ? 44 : 62,
      background: bg,
      borderRadius: 5,
      border: selected ? `2px solid #f0c050` : drawn ? `2px solid #e8a735` : `1px solid ${borderColor}`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      cursor: onClick ? "pointer" : "default",
      boxShadow: selected ? "0 0 16px rgba(240,192,80,0.7), 0 2px 4px rgba(0,0,0,0.3)"
        : drawn ? "0 0 10px rgba(232,167,53,0.5), 0 2px 4px rgba(0,0,0,0.3)"
        : "0 2px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.5)",
      transition: "all 0.15s ease",
      transform: selected ? "translateY(-12px)" : drawn ? "translateY(-6px)" : "none",
      opacity: dimmed ? 0.4 : 1, userSelect: "none", flexShrink: 0,
      position: "relative",
    }}>
      {icon && (
        <span style={{ position: "absolute", top: small ? 1 : 2, right: small ? 2 : 3,
          fontSize: small ? 7 : 9, color, opacity: 0.4, lineHeight: 1,
          fontFamily: "sans-serif" }}>{icon}</span>
      )}
      <span style={{ fontSize: small ? 16 : 22, fontWeight: 700, color, lineHeight: 1.1,
        fontFamily: "'Noto Serif JP', 'Hiragino Mincho ProN', serif" }}>{tileLabel(tile)}</span>
      {tile.suit !== "z" && (
        <span style={{ fontSize: small ? 8 : 10, color, opacity: 0.7, lineHeight: 1,
          fontFamily: "'Noto Serif JP', serif" }}>{tileSuitLabel(tile)}</span>
      )}
    </div>
  );
}

function MiniTile({ suit, num }) {
  const label = suit === "z" ? HONOR_NAMES[num] : NUM_KANJI[num];
  const sub = suit === "z" ? "" : SUITS[suit];
  const color = suit === "z"
    ? (num === 5 ? "#888" : num === 6 ? "#27713a" : num === 7 ? "#b8282e" : "#3a3226")
    : SUIT_COLORS[suit];
  const icon = SUIT_ICONS[suit];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 22, height: 28, borderRadius: 3,
      background: SUIT_BG[suit].normal,
      border: `1px solid ${SUIT_BORDER[suit]}`,
      fontSize: 13, fontWeight: 700, color, lineHeight: 1,
      fontFamily: "'Noto Serif JP', serif",
      boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
      flexShrink: 0, position: "relative",
    }}>
      {icon && <span style={{ position: "absolute", top: 0, right: 1,
        fontSize: 5, color, opacity: 0.4, fontFamily: "sans-serif" }}>{icon}</span>}
      {label}
      {sub && <span style={{ position: "absolute", bottom: 1, fontSize: 6,
        color, opacity: 0.6 }}>{sub}</span>}
    </span>
  );
}

function HintSection({ label, color, children }) {
  if (!children || (Array.isArray(children) && children.length === 0)) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 9, fontWeight: 600, color, fontFamily: "sans-serif",
        marginBottom: 3, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
        {children}
      </div>
    </div>
  );
}

function MeldGroup({ meld, preview }) {
  return (
    <div style={{
      display: "flex", gap: 2, padding: "4px 6px",
      background: preview ? "rgba(232,167,53,0.15)" : "rgba(0,0,0,0.15)",
      borderRadius: 6,
      border: preview ? "1px dashed rgba(232,167,53,0.4)" : "1px solid transparent",
    }}>
      {meld.tiles.map((t, i) => <Tile key={i} tile={t} small />)}
      <span style={{
        fontSize: 10, color: preview ? "#e8a735" : "#c8a64c", alignSelf: "flex-end",
        fontFamily: "sans-serif", marginLeft: 2,
      }}>
        {meld.type === "pon" ? "ポン" : "チー"}{preview && " ?"}
      </span>
    </div>
  );
}

function HandDecomposition({ groups }) {
  if (!groups || groups.length === 0) return null;

  const mentsuCount = groups.filter(g => ["kantsu", "koutsu", "shuntsu"].includes(g.type)).length;
  const toitsuCount = groups.filter(g => g.type === "toitsu").length;
  const tatsuCount = groups.filter(g => g.type === "tatsu").length;

  return (
    <div style={{
      marginBottom: 12, padding: "10px 12px",
      background: "rgba(0,0,0,0.15)", borderRadius: 8,
      border: "1px solid rgba(200,166,76,0.1)",
    }}>
      {/* Summary line */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 8, flexWrap: "wrap", gap: 6,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#c8a64c",
          fontFamily: "sans-serif", letterSpacing: 1 }}>
          手牌構成
        </span>
        <div style={{ display: "flex", gap: 8, fontSize: 10, fontFamily: "sans-serif" }}>
          {mentsuCount > 0 && <span style={{ color: "#8ab0d0" }}>面子×{mentsuCount}</span>}
          {toitsuCount > 0 && <span style={{ color: "#a070d0" }}>対子×{toitsuCount}</span>}
          {tatsuCount > 0 && <span style={{ color: "#70b0a0" }}>搭子×{tatsuCount}</span>}
        </div>
      </div>

      {/* Group tiles */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
        {groups.map((g, gi) => {
          const style = GROUP_STYLES[g.type] || GROUP_STYLES.isolated;
          return (
            <div key={gi} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            }}>
              <div style={{
                display: "flex", gap: 2, padding: "3px 5px",
                background: style.bg, borderRadius: 5,
                border: `1px solid ${style.border}`,
              }}>
                {(g.tiles || []).map((t, ti) => (
                  <Tile key={ti} tile={t} small />
                ))}
              </div>
              <span style={{
                fontSize: 9, fontWeight: 600, color: style.color,
                fontFamily: "sans-serif", letterSpacing: 0.5,
              }}>
                {style.label}
                {g.type === "tatsu" && g.subtype ? `(${g.subtype})` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DiffBadge({ summary }) {
  if (!summary) return null;
  const up = summary.closer + summary.newCount;
  const down = summary.farther + summary.goneCount;
  if (up === 0 && down === 0) return null;
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 11, fontFamily: "sans-serif" }}>
      {up > 0 && <span style={{ color: "#50c878", fontWeight: 600 }}>▲{up}役</span>}
      {down > 0 && <span style={{ color: "#dc503c", fontWeight: 600 }}>▼{down}役</span>}
    </div>
  );
}

function ScorePanel({ resolvedYaku, totalHan, fu, scoreInfo }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(232,167,53,0.2), rgba(240,200,80,0.08))",
      border: "1px solid rgba(232,167,53,0.5)",
      borderRadius: 8, padding: "12px 16px", marginBottom: 12,
      boxShadow: "0 0 20px rgba(232,167,53,0.15)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#f0c050",
          fontFamily: "'Noto Serif JP', serif" }}>和了</span>
        {scoreInfo.label && (
          <span style={{ fontSize: 14, fontWeight: 700, color: "#e8a735",
            fontFamily: "sans-serif", padding: "2px 10px", borderRadius: 4,
            background: "rgba(232,167,53,0.2)", border: "1px solid rgba(232,167,53,0.3)",
          }}>{scoreInfo.label}</span>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
        {resolvedYaku.map(y => (
          <span key={y.name} style={{
            padding: "2px 8px", borderRadius: 4,
            background: "rgba(232,167,53,0.12)", border: "1px solid rgba(232,167,53,0.25)",
            fontSize: 12, color: "#e8a735", fontFamily: "sans-serif", fontWeight: 600,
          }}>{y.name} {y.han >= 13 ? "役満" : `${y.han}翻`}</span>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap",
        fontSize: 12, color: "#b0a880", fontFamily: "sans-serif" }}>
        <span>{totalHan}翻 {fu}符</span>
        <span style={{ color: "#5a6a4a" }}>→</span>
        <span style={{ fontSize: 11, color: "#8a9a7a" }}>親</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#f0c050" }}>
          {scoreInfo.dealer.toLocaleString()}点
        </span>
        <span style={{ color: "#5a6a4a" }}>|</span>
        <span style={{ fontSize: 11, color: "#8a9a7a" }}>子</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#c8a64c" }}>
          {scoreInfo.child.toLocaleString()}点
        </span>
      </div>
    </div>
  );
}

function ShantenPanel({ shanten, acceptTiles }) {
  if (shanten > 1 || shanten < 0 || acceptTiles.length === 0) return null;

  const totalRemaining = acceptTiles.reduce((s, t) => s + t.remaining, 0);
  const isTenpai = shanten === 0;

  return (
    <div style={{
      marginBottom: 12, padding: "10px 12px",
      background: isTenpai
        ? "linear-gradient(135deg, rgba(80,200,120,0.15), rgba(80,200,120,0.05))"
        : "rgba(0,0,0,0.15)",
      borderRadius: 8,
      border: isTenpai
        ? "1px solid rgba(80,200,120,0.4)"
        : "1px solid rgba(200,166,76,0.15)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 16, fontWeight: 700,
          color: isTenpai ? "#50c878" : "#c8a64c",
          fontFamily: "'Noto Serif JP', serif",
        }}>{isTenpai ? "聴牌" : "一向聴"}</span>
        <span style={{ fontSize: 11, color: "#8a9a7a", fontFamily: "sans-serif" }}>
          {isTenpai ? "待ち" : "受入"} {acceptTiles.length}種 {totalRemaining}枚
        </span>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "flex-end" }}>
        {acceptTiles.map((t, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <MiniTile suit={t.suit} num={t.num} />
            <span style={{ fontSize: 8, color: "#6a7a5a", fontFamily: "sans-serif" }}>
              ×{t.remaining}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Quiz Yaku Tile Highlighting ───
function getYakuKeyTiles(yakuName, hand, ctx) {
  const struct = analyzeStructure(hand);
  const counts = countByKey(hand);

  switch (yakuName) {
    case "役牌": {
      const yakuKeys = new Set(["z5", "z6", "z7"]);
      if (ctx?.seatWind) yakuKeys.add(`z${ctx.seatWind}`);
      if (ctx?.roundWind) yakuKeys.add(`z${ctx.roundWind}`);
      const tiles = [];
      struct.koutsuList.forEach(g => {
        if (yakuKeys.has(g.key)) g.tiles.forEach(t => tiles.push(t));
      });
      return tiles.length > 0 ? sortTiles(tiles) : sortTiles(hand);
    }

    case "対々和":
    case "四暗刻": {
      const tiles = [];
      struct.koutsuList.forEach(g => g.tiles.forEach(t => tiles.push(t)));
      return tiles.length > 0 ? sortTiles(tiles) : sortTiles(hand);
    }

    case "三色同順": {
      for (let start = 1; start <= 7; start++) {
        if (["m", "p", "s"].every(suit =>
          struct.shuntsuList.some(g => g.suit === suit && g.num === start)
        )) {
          const tiles = [];
          ["m", "p", "s"].forEach(suit => {
            const g = struct.shuntsuList.find(g2 => g2.suit === suit && g2.num === start);
            if (g) g.tiles.forEach(t => tiles.push(t));
          });
          return sortTiles(tiles);
        }
      }
      return sortTiles(hand);
    }

    case "一気通貫": {
      for (const suit of ["m", "p", "s"]) {
        if ([1, 4, 7].every(start =>
          struct.shuntsuList.some(g => g.suit === suit && g.num === start)
        )) {
          const tiles = [];
          [1, 4, 7].forEach(start => {
            const g = struct.shuntsuList.find(g2 => g2.suit === suit && g2.num === start);
            if (g) g.tiles.forEach(t => tiles.push(t));
          });
          return sortTiles(tiles);
        }
      }
      return sortTiles(hand);
    }

    case "一盃口":
    case "二盃口": {
      const tiles = [];
      for (const suit of ["m", "p", "s"]) {
        for (let s = 1; s <= 7; s++) {
          const keys = [0, 1, 2].map(i => `${suit}${s + i}`);
          if (keys.every(k => (counts[k] || 0) >= 2)) {
            keys.forEach(k => {
              hand.filter(t => tileKey(t) === k).slice(0, 2).forEach(t => tiles.push(t));
            });
          }
        }
      }
      return tiles.length > 0 ? sortTiles(tiles) : sortTiles(hand);
    }

    default:
      return sortTiles(hand);
  }
}

// ─── Quiz Yaku Structural Breakdown ───
function getYakuBreakdown(yakuName, hand, ctx) {
  const struct = analyzeStructure(hand);
  const counts = countByKey(hand);

  switch (yakuName) {
    case "平和": {
      const groups = [];
      struct.shuntsuList.forEach((g, i) => {
        groups.push({ label: "順子", tiles: sortTiles(g.tiles) });
      });
      const pair = struct.toitsuList[0];
      if (pair) {
        const t = pair.tiles[0];
        const yakuKeys = new Set(["z5", "z6", "z7"]);
        if (ctx?.seatWind) yakuKeys.add(`z${ctx.seatWind}`);
        if (ctx?.roundWind) yakuKeys.add(`z${ctx.roundWind}`);
        const isYaku = yakuKeys.has(tileKey(t));
        groups.push({ label: isYaku ? "雀頭" : "雀頭（非役牌）", tiles: pair.tiles });
      }
      // 両面待ちの例を探す
      let ryanmenNote = null;
      for (const g of struct.shuntsuList) {
        const s = g.num;
        if (s >= 2) {
          ryanmenNote = `${SUITS[g.suit]}${NUM_KANJI[s]}${NUM_KANJI[s+1]}${NUM_KANJI[s+2]} ← ${NUM_KANJI[s-1]} or ${NUM_KANJI[s+2]}の両面待ち`;
          break;
        }
        if (s <= 6) {
          ryanmenNote = `${SUITS[g.suit]}${NUM_KANJI[s]}${NUM_KANJI[s+1]}${NUM_KANJI[s+2]} ← ${NUM_KANJI[s]} or ${NUM_KANJI[s+3]}の両面待ち`;
          break;
        }
      }
      return { groups, note: ryanmenNote };
    }

    case "七対子": {
      const groups = [];
      const used = new Set();
      const sorted = sortTiles(hand);
      for (let i = 0; i < sorted.length - 1; i++) {
        if (used.has(sorted[i].id)) continue;
        if (tileKey(sorted[i]) === tileKey(sorted[i + 1]) && !used.has(sorted[i + 1].id)) {
          groups.push({ label: "対子", tiles: [sorted[i], sorted[i + 1]] });
          used.add(sorted[i].id);
          used.add(sorted[i + 1].id);
        }
      }
      return { groups };
    }

    case "国士無双": {
      const needed = ["m1","m9","p1","p9","s1","s9","z1","z2","z3","z4","z5","z6","z7"];
      const sorted = sortTiles(hand);
      const singles = [];
      let pairTile = null;
      const seen = {};
      sorted.forEach(t => {
        const k = tileKey(t);
        if (!seen[k]) { seen[k] = [t]; singles.push(t); }
        else { pairTile = t; seen[k].push(t); }
      });
      const groups = [{ label: "么九牌13種", tiles: sortTiles(singles) }];
      if (pairTile) groups.push({ label: "雀頭", tiles: seen[tileKey(pairTile)] });
      return { groups };
    }

    case "断么九": {
      return { groups: [], note: "すべての牌が2〜8の数牌（么九牌・字牌なし）" };
    }

    case "混一色": {
      const all = [...hand];
      let bestSuit = "m", best = 99;
      for (const suit of ["m", "p", "s"]) {
        const bad = all.filter(t => t.suit !== suit && t.suit !== "z").length;
        if (bad < best) { best = bad; bestSuit = suit; }
      }
      const numTiles = sortTiles(hand.filter(t => t.suit === bestSuit));
      const honorTiles = sortTiles(hand.filter(t => t.suit === "z"));
      const groups = [];
      if (numTiles.length > 0) groups.push({ label: `${SUITS[bestSuit]}`, tiles: numTiles });
      if (honorTiles.length > 0) groups.push({ label: "字牌", tiles: honorTiles });
      return { groups };
    }

    case "清一色": {
      let bestSuit = "m", best = 99;
      for (const suit of ["m", "p", "s"]) {
        const bad = hand.filter(t => t.suit !== suit).length;
        if (bad < best) { best = bad; bestSuit = suit; }
      }
      return { groups: [{ label: `${SUITS[bestSuit]}のみ`, tiles: sortTiles(hand) }] };
    }

    case "混全帯么九": {
      const groups = [];
      struct.shuntsuList.forEach(g => {
        const hasTerminal = g.tiles.some(t => isTerminalOrHonor(t));
        groups.push({ label: hasTerminal ? "順子（端牌含）" : "順子", tiles: sortTiles(g.tiles) });
      });
      struct.koutsuList.forEach(g => {
        groups.push({ label: "刻子", tiles: g.tiles });
      });
      if (struct.toitsuList[0]) {
        groups.push({ label: "雀頭", tiles: struct.toitsuList[0].tiles });
      }
      return { groups };
    }

    case "対々和":
    case "四暗刻": {
      const groups = [];
      struct.koutsuList.forEach(g => {
        groups.push({ label: "刻子", tiles: g.tiles });
      });
      if (struct.toitsuList[0]) {
        groups.push({ label: "雀頭", tiles: struct.toitsuList[0].tiles });
      }
      return { groups };
    }

    default:
      return null;
  }
}

// ─── Quiz Mode Components ───
function QuizPanel({ quizHand, quizYakuList, quizSelected, onToggleYaku, onSubmit, quizResult, onNext, quizScore, ctx }) {
  return (
    <div style={{
      background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: 16,
      border: "1px solid rgba(200,166,76,0.2)",
    }}>
      {/* Quiz hand display */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#c8a64c", fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
          この手牌で成立している役を全て選んでください
        </div>
        <div style={{
          display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center",
          background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: "12px 8px",
        }}>
          {quizHand.map(t => (
            <Tile key={t.id} tile={t} />
          ))}
        </div>
      </div>

      {/* Yaku selection chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16, justifyContent: "center" }}>
        {quizYakuList.map(y => {
          const selected = quizSelected.includes(y.name);
          let chipBg = selected ? "rgba(232,167,53,0.25)" : "rgba(255,255,255,0.06)";
          let chipBorder = selected ? "1px solid #e8a735" : "1px solid rgba(255,255,255,0.1)";
          let chipColor = selected ? "#e8a735" : "#a0b090";

          if (quizResult) {
            const isCorrect = quizResult.correctNames.includes(y.name);
            const wasSelected = quizSelected.includes(y.name);
            if (isCorrect && wasSelected) {
              chipBg = "rgba(80,200,120,0.2)"; chipBorder = "1px solid #50c878"; chipColor = "#50c878";
            } else if (isCorrect && !wasSelected) {
              chipBg = "rgba(80,200,120,0.12)"; chipBorder = "1px dashed #50c878"; chipColor = "#50c878";
            } else if (!isCorrect && wasSelected) {
              chipBg = "rgba(220,80,60,0.15)"; chipBorder = "1px solid #dc503c"; chipColor = "#dc503c";
            }
          }

          return (
            <button key={y.name} onClick={() => !quizResult && onToggleYaku(y.name)} style={{
              padding: "6px 14px", fontSize: 13, borderRadius: 20, cursor: quizResult ? "default" : "pointer",
              background: chipBg, border: chipBorder, color: chipColor,
              fontWeight: selected ? 700 : 400, fontFamily: "'Noto Serif JP', serif",
              transition: "all 0.15s", opacity: quizResult && !quizResult.correctNames.includes(y.name) && !selected ? 0.4 : 1,
            }}>
              {y.name}
              <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.7, fontFamily: "sans-serif" }}>
                {y.han >= 13 ? "役満" : `${y.han}翻`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Submit / Result */}
      {!quizResult ? (
        <div style={{ textAlign: "center" }}>
          <button onClick={onSubmit} disabled={quizSelected.length === 0} style={{
            padding: "8px 32px", fontSize: 14, borderRadius: 6, fontWeight: 700,
            fontFamily: "'Noto Serif JP', serif", cursor: quizSelected.length === 0 ? "not-allowed" : "pointer",
            border: "1px solid #e8a735",
            background: quizSelected.length === 0 ? "rgba(0,0,0,0.2)" : "rgba(232,167,53,0.2)",
            color: quizSelected.length === 0 ? "#5a6a4a" : "#e8a735", letterSpacing: 2,
          }}>回答する</button>
        </div>
      ) : (
        <div>
          <div style={{
            fontSize: 18, fontWeight: 700, marginBottom: 8, textAlign: "center",
            color: quizResult.isCorrect ? "#50c878" : "#dc503c",
            fontFamily: "'Noto Serif JP', serif",
          }}>
            {quizResult.isCorrect ? "正解！" : "不正解…"}
          </div>

          {/* 各正解役の構成牌 */}
          <div style={{ marginBottom: 12 }}>
            {quizResult.correctNames.map(yakuName => {
              const yakuDef = quizYakuList.find(y => y.name === yakuName);
              const keyTiles = getYakuKeyTiles(yakuName, quizHand, ctx);
              const isAllTiles = keyTiles.length === quizHand.length;
              const breakdown = isAllTiles ? getYakuBreakdown(yakuName, quizHand, ctx) : null;
              return (
                <div key={yakuName} style={{
                  padding: "8px 10px", marginBottom: 6, borderRadius: 6,
                  background: "rgba(80,200,120,0.08)", border: "1px solid rgba(80,200,120,0.2)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#50c878",
                      fontFamily: "'Noto Serif JP', serif" }}>{yakuName}</span>
                    <span style={{ fontSize: 10, color: "#8a9a7a", fontFamily: "sans-serif" }}>
                      {yakuDef ? (yakuDef.han >= 13 ? "役満" : `${yakuDef.han}翻`) : ""}
                    </span>
                    {quizResult.missed.includes(yakuName) && (
                      <span style={{ fontSize: 10, color: "#dc503c", fontFamily: "sans-serif",
                        padding: "1px 6px", borderRadius: 3, background: "rgba(220,80,60,0.15)" }}>
                        選び漏れ
                      </span>
                    )}
                  </div>
                  {breakdown && breakdown.groups.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {breakdown.groups.map((g, gi) => (
                        <div key={gi} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 10, color: "#7a9a6a", fontFamily: "sans-serif",
                            minWidth: 72, flexShrink: 0 }}>{g.label}</span>
                          <div style={{ display: "flex", gap: 2 }}>
                            {g.tiles.map((t, ti) => <MiniTile key={ti} suit={t.suit} num={t.num} />)}
                          </div>
                        </div>
                      ))}
                      {breakdown.note && (
                        <div style={{ fontSize: 10, color: "#b0a060", fontFamily: "sans-serif", marginTop: 2 }}>
                          {breakdown.note}
                        </div>
                      )}
                    </div>
                  ) : breakdown && breakdown.note ? (
                    <div style={{ fontSize: 11, color: "#8a9a7a", fontFamily: "sans-serif" }}>
                      {breakdown.note}
                    </div>
                  ) : isAllTiles ? (
                    <span style={{ fontSize: 11, color: "#8a9a7a", fontFamily: "sans-serif" }}>
                      {yakuDef?.explain || ""}
                    </span>
                  ) : (
                    <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                      {keyTiles.map((t, i) => <MiniTile key={i} suit={t.suit} num={t.num} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {quizResult.wrong.length > 0 && (
            <div style={{ fontSize: 11, color: "#dc503c", marginBottom: 8, fontFamily: "sans-serif",
              padding: "6px 10px", borderRadius: 6,
              background: "rgba(220,80,60,0.08)", border: "1px solid rgba(220,80,60,0.15)" }}>
              誤選択: {quizResult.wrong.join("、")}
            </div>
          )}
          <div style={{ fontSize: 12, color: "#8a9a7a", marginBottom: 12, fontFamily: "sans-serif", textAlign: "center" }}>
            スコア: {quizScore.correct} / {quizScore.total}
          </div>
          <div style={{ textAlign: "center" }}>
            <button onClick={onNext} style={{
              padding: "8px 28px", fontSize: 14, borderRadius: 6, fontWeight: 700,
              fontFamily: "'Noto Serif JP', serif", cursor: "pointer",
              border: "1px solid #e8a735", background: "rgba(232,167,53,0.2)",
              color: "#e8a735", letterSpacing: 2,
            }}>次の問題</button>
          </div>
        </div>
      )}
    </div>
  );
}

function YakuRow({ name, reading, han, explain, result, diff, maxDist, expanded, onToggle, isTarget, onTarget, isHandComplete }) {
  const pct = maxDist > 0 ? Math.max(0, 1 - result.distance / maxDist) : 1;
  const hanLabel = han >= 13 ? "役満" : `${han}翻`;
  const distLabel = result.distance === 0
    ? (isHandComplete ? "成立！" : "条件○")
    : `あと${result.distance}枚`;
  const isCloser = typeof diff === "number" && diff < 0;
  const isFarther = typeof diff === "number" && diff > 0;
  const isNew = diff === "new";
  const isGone = diff === "gone";
  const changed = isCloser || isFarther || isNew || isGone;

  let rowBg = "rgba(255,255,255,0.03)", leftBorder = "3px solid transparent";
  if (isTarget) { rowBg = "rgba(240,200,80,0.15)"; leftBorder = "3px solid #f0c850"; }
  const isComplete = result.distance === 0 && isHandComplete;
  const isConditionMet = result.distance === 0 && !isHandComplete;
  if (isComplete && !isFarther && !isGone) { rowBg = "rgba(232,167,53,0.2)"; leftBorder = "3px solid #e8a735"; }
  if (isConditionMet && !isFarther && !isGone) { rowBg = "rgba(200,180,100,0.1)"; leftBorder = "3px solid #a0906a"; }
  if (isCloser || isNew) { rowBg = "rgba(80,200,120,0.12)"; leftBorder = "3px solid #50c878"; }
  if (isFarther || isGone) { rowBg = "rgba(220,80,60,0.1)"; leftBorder = "3px solid #dc503c"; }

  let barColor = "linear-gradient(90deg, #4a7a5a, #6aaa7a)";
  if (isComplete && !isFarther && !isGone) barColor = "linear-gradient(90deg, #e8a735, #f0c050)";
  if (isConditionMet && !isFarther && !isGone) barColor = "linear-gradient(90deg, #a0906a, #c0b080)";
  if (isCloser) barColor = "linear-gradient(90deg, #3a9a5a, #50c878)";
  if (isFarther) barColor = "linear-gradient(90deg, #b04030, #dc503c)";

  return (
    <div style={{
      background: rowBg, borderRadius: 6, borderLeft: leftBorder, transition: "all 0.25s ease",
      overflow: "hidden",
    }}>
      <div onClick={onToggle} style={{
        display: "flex", alignItems: "center", gap: 10, padding: "6px 10px",
        cursor: "pointer", userSelect: "none",
      }}>
        <div style={{ minWidth: 44, textAlign: "center" }}>
          <span style={{ fontSize: 10, color: han >= 13 ? "#e8a735" : "#8a9a7a",
            fontFamily: "sans-serif", fontWeight: 600 }}>{hanLabel}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700,
              color: isComplete ? "#e8a735" : isConditionMet ? "#b0a070" : "#e0d8c4",
              fontFamily: "'Noto Serif JP', serif" }}>{name}</span>
            <span style={{ fontSize: 11, color: "#8a9a7a", fontFamily: "sans-serif" }}>{reading}</span>
            <span style={{ fontSize: 9, color: "#5a6a4a", fontFamily: "sans-serif",
              marginLeft: "auto", flexShrink: 0, transition: "transform 0.2s",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            }}>▼</span>
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct * 100}%`, background: barColor,
              borderRadius: 2, transition: "width 0.4s ease" }} />
          </div>
          <div style={{ fontSize: 10, color: "#7a8a6a", marginTop: 2, fontFamily: "sans-serif" }}>{result.desc}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", minWidth: 80 }}>
          <span style={{ fontSize: 13, fontWeight: 700,
            color: isComplete ? "#e8a735" : isConditionMet ? "#b0a070" : "#a0b090", fontFamily: "sans-serif" }}>{distLabel}</span>
          {changed && (
            <span style={{ fontSize: 11, fontWeight: 700, marginTop: 2, fontFamily: "sans-serif",
              color: (isCloser || isNew) ? "#50c878" : "#dc503c",
              display: "flex", alignItems: "center", gap: 2, whiteSpace: "nowrap" }}>
              {isCloser && <>▲ {Math.abs(diff)}近づく</>}
              {isFarther && <>▼ {Math.abs(diff)}遠ざかる</>}
              {isNew && <>＋ 射程内に</>}
              {isGone && <>ー 射程外へ</>}
            </span>
          )}
        </div>
      </div>
      {expanded && (
        <div style={{
          padding: "6px 10px 10px 54px",
          fontSize: 11, lineHeight: 1.6, color: "#b0a880",
          fontFamily: "sans-serif",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(0,0,0,0.08)",
        }}>
          {explain && <div style={{ marginBottom: 6 }}>{explain}</div>}

          {result.obstacles && result.obstacles.length > 0 && (
            <HintSection label="切りたい牌" color="#dc503c">
              {result.obstacles.map((t, i) => (
                <MiniTile key={`o${i}`} suit={t.suit} num={t.num} />
              ))}
            </HintSection>
          )}

          {result.wanted && result.wanted.length > 0 && (
            <HintSection label="欲しい牌" color="#50c878">
              {result.wanted.map((w, i) => (
                <MiniTile key={`w${i}`} suit={w.suit} num={w.num} />
              ))}
            </HintSection>
          )}

          <div style={{ marginTop: 8 }}>
            <button onClick={(e) => { e.stopPropagation(); onTarget(); }} style={{
              padding: "4px 12px", fontSize: 11, borderRadius: 4, fontWeight: 600,
              fontFamily: "sans-serif", cursor: "pointer", transition: "all 0.15s",
              border: isTarget ? "1px solid #f0c850" : "1px solid #5a6a4a",
              background: isTarget ? "rgba(240,200,80,0.2)" : "rgba(0,0,0,0.2)",
              color: isTarget ? "#f0c850" : "#8a9a7a",
            }}>{isTarget ? "解除" : "この役を狙う"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MeldActionBtn({ label, active, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 16px", fontSize: 13, borderRadius: 5, fontWeight: 600,
      fontFamily: "sans-serif", cursor: "pointer", transition: "all 0.15s",
      border: `1px solid ${color}`,
      background: active ? `${color}30` : "rgba(0,0,0,0.2)",
      color: active ? color : `${color}99`,
      boxShadow: active ? `0 0 10px ${color}40` : "none",
      transform: active ? "scale(1.05)" : "none",
    }}>{label}</button>
  );
}

// ─── Main App ───
export default function MahjongYakuTrainer() {
  const [wall, setWall] = useState([]);
  const [hand, setHand] = useState([]);
  const [melds, setMelds] = useState([]);
  const [discardPool, setDiscardPool] = useState([]);
  const [drawnTile, setDrawnTile] = useState(null);
  const [phase, setPhase] = useState("init");
  const [level, setLevel] = useState(1);
  const [opponentTile, setOpponentTile] = useState(null);
  const [turnCount, setTurnCount] = useState(0);
  const [seatWind] = useState(1);
  const [roundWind] = useState(1);
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [meldPreview, setMeldPreview] = useState(null);
  const [expandedYaku, setExpandedYaku] = useState(null);
  const [targetYaku, setTargetYaku] = useState(null);

  // ─── Quiz Mode State ───
  const [mode, setMode] = useState("quiz"); // "trainer" | "quiz"
  const [quizHand, setQuizHand] = useState([]);
  const [quizSelected, setQuizSelected] = useState([]);
  const [quizResult, setQuizResult] = useState(null);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });

  const currentLevel = LEVELS[level];
  const ctx = useMemo(() => ({ seatWind, roundWind }), [seatWind, roundWind]);

  const resetSelections = useCallback(() => {
    setSelectedTileId(null); setMeldPreview(null);
  }, []);

  const dealHand = useCallback(() => {
    const w = shuffle(buildWall());
    setWall(w.slice(13)); setHand(sortTiles(w.slice(0, 13)));
    setMelds([]); setDiscardPool([]); setDrawnTile(null);
    setOpponentTile(null); setPhase("draw"); setTurnCount(0); resetSelections();
  }, [resetSelections]);

  useEffect(() => {
    dealHand();
    if (mode === "quiz") {
      const h = generateQuizHand(currentLevel.maxHan, ctx);
      setQuizHand(h);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drawTile = useCallback(() => {
    if (wall.length === 0) { setPhase("ended"); return; }
    setDrawnTile(wall[0]); setWall(w => w.slice(1));
    setPhase("discard"); setTurnCount(c => c + 1); resetSelections();
  }, [wall, resetSelections]);

  const confirmDiscard = useCallback((tileId) => {
    const allTiles = drawnTile ? [...hand, drawnTile] : [...hand];
    const discarded = allTiles.find(t => t.id === tileId);
    if (!discarded) return;
    const newHand = sortTiles(allTiles.filter(t => t.id !== tileId));
    setHand(newHand);
    setDiscardPool(d => [...d, discarded]);
    setDrawnTile(null); resetSelections();
    if (wall.length > 0) {
      const opp = wall[0];
      setWall(w => w.slice(1));
      // ポンもチーもできなければ自動スルー
      const canPonOpp = newHand.filter(t => tileKey(t) === tileKey(opp)).length >= 2;
      const canChiOpp = opp.suit !== "z" && findChiSequences(newHand, opp).length > 0;
      if (!canPonOpp && !canChiOpp) {
        setDiscardPool(d => [...d, opp]);
        setPhase("draw");
      } else {
        setOpponentTile(opp); setPhase("opponent");
      }
    } else { setPhase("draw"); }
  }, [hand, drawnTile, wall, resetSelections]);

  const handleTileClick = useCallback((tileId) => {
    if (phase !== "discard") return;
    if (selectedTileId === tileId) confirmDiscard(tileId);
    else setSelectedTileId(tileId);
  }, [phase, selectedTileId, confirmDiscard]);

  const canPon = useMemo(() => {
    if (!opponentTile) return false;
    return hand.filter(t => tileKey(t) === tileKey(opponentTile)).length >= 2;
  }, [hand, opponentTile]);

  const chiSequences = useMemo(() => {
    if (!opponentTile) return [];
    return findChiSequences(hand, opponentTile);
  }, [hand, opponentTile]);
  const canChi = chiSequences.length > 0;

  const executePon = useCallback(() => {
    const sim = simulatePon(hand, opponentTile);
    if (!sim) return;
    setMelds(m => [...m, sim.meld]); setHand(sim.hand);
    setOpponentTile(null); setPhase("discard"); resetSelections();
  }, [hand, opponentTile, resetSelections]);

  const executeChi = useCallback(() => {
    const sim = simulateChi(hand, opponentTile);
    if (!sim) return;
    setMelds(m => [...m, sim.meld]); setHand(sim.hand);
    setOpponentTile(null); setPhase("discard"); resetSelections();
  }, [hand, opponentTile, resetSelections]);

  const executeSkip = useCallback(() => {
    if (opponentTile) setDiscardPool(d => [...d, opponentTile]);
    setOpponentTile(null); setPhase("draw"); resetSelections();
  }, [opponentTile, resetSelections]);

  const confirmMeld = useCallback(() => {
    if (meldPreview === "pon") executePon();
    else if (meldPreview === "chi") executeChi();
    else if (meldPreview === "skip") executeSkip();
  }, [meldPreview, executePon, executeChi, executeSkip]);

  // ─── Analysis ───
  const allCurrentTiles = useMemo(() => drawnTile ? [...hand, drawnTile] : hand, [hand, drawnTile]);

  const currentAnalysis = useMemo(
    () => analyzeYaku(allCurrentTiles, melds, ctx, currentLevel.maxHan),
    [allCurrentTiles, melds, ctx, currentLevel]
  );

  const discardPreviewAnalysis = useMemo(() => {
    if (selectedTileId === null) return null;
    return analyzeYaku(allCurrentTiles.filter(t => t.id !== selectedTileId), melds, ctx, currentLevel.maxHan);
  }, [selectedTileId, allCurrentTiles, melds, ctx, currentLevel]);

  const meldPreviewData = useMemo(() => {
    if (!meldPreview || !opponentTile) return null;
    if (meldPreview === "skip") {
      return { analysis: analyzeYaku(hand, melds, ctx, currentLevel.maxHan), meld: null };
    }
    if (meldPreview === "pon") {
      const sim = simulatePon(hand, opponentTile);
      if (!sim) return null;
      return { analysis: analyzeYaku(sim.hand, [...melds, sim.meld], ctx, currentLevel.maxHan), meld: sim.meld };
    }
    if (meldPreview === "chi") {
      const sim = simulateChi(hand, opponentTile);
      if (!sim) return null;
      return { analysis: analyzeYaku(sim.hand, [...melds, sim.meld], ctx, currentLevel.maxHan), meld: sim.meld };
    }
    return null;
  }, [meldPreview, opponentTile, hand, melds, ctx, currentLevel]);

  const activePreview = discardPreviewAnalysis || (meldPreviewData?.analysis) || null;
  const isPreviewing = activePreview !== null;

  const displayList = useMemo(() => {
    const list = mergeDiffs(currentAnalysis, activePreview);
    if (!targetYaku) return list;
    return [...list].sort((a, b) => {
      if (a.name === targetYaku && b.name !== targetYaku) return -1;
      if (a.name !== targetYaku && b.name === targetYaku) return 1;
      return 0;
    });
  }, [currentAnalysis, activePreview, targetYaku]);
  const diffSummary = useMemo(() => isPreviewing ? computeSummary(displayList) : null, [displayList, isPreviewing]);

  const selectedTileObj = useMemo(
    () => selectedTileId !== null ? allCurrentTiles.find(t => t.id === selectedTileId) : null,
    [selectedTileId, allCurrentTiles]
  );

  const previewTitle = useMemo(() => {
    if (selectedTileId !== null) return "打牌シミュレーション";
    if (meldPreview === "pon") return "ポンした場合";
    if (meldPreview === "chi") return "チーした場合";
    if (meldPreview === "skip") return "スルーした場合";
    return "狙える役（距離順）";
  }, [selectedTileId, meldPreview]);

  // ─── Hand Decomposition ───
  const handDecomposition = useMemo(() => {
    const raw = decomposeHand(allCurrentTiles);
    return detectTatsu(raw);
  }, [allCurrentTiles]);

  // ─── Shanten & Accept Tiles ───
  const shantenInfo = useMemo(() => {
    const allVisible = [...hand, ...melds.flatMap(m => m.tiles), ...discardPool,
      ...(opponentTile ? [opponentTile] : [])];
    return findAcceptTiles(hand, melds, allVisible);
  }, [hand, melds, discardPool, opponentTile]);

  // ─── Score Calculation ───
  const isHandComplete = useMemo(
    () => checkHandComplete(allCurrentTiles, melds) !== null,
    [allCurrentTiles, melds]
  );

  const agariResult = useMemo(() => {
    const agari = checkHandComplete(allCurrentTiles, melds);
    if (!agari) return null;

    const completed = currentAnalysis.filter(y => y.result.distance === 0);
    if (completed.length === 0) return null;

    const resolved = resolveYakuConflicts(completed);
    if (resolved.length === 0) return null;

    const totalHan = resolved.reduce((sum, y) => sum + y.han, 0);
    const fu = calculateFu(agari, melds, resolved, ctx);
    const scoreInfo = calculateScore(totalHan, fu);

    return { resolvedYaku: resolved, totalHan, fu, scoreInfo };
  }, [allCurrentTiles, melds, currentAnalysis, ctx]);

  const maxDist = 13;

  // ─── Quiz Logic ───
  const quizCorrectYaku = useMemo(() => {
    if (mode !== "quiz" || quizHand.length === 0) return [];
    const analysis = analyzeYaku(quizHand, [], ctx, currentLevel.maxHan);
    const completed = analysis.filter(y => y.result.distance === 0);
    return resolveYakuConflicts(completed);
  }, [mode, quizHand, ctx, currentLevel]);

  const quizYakuList = useMemo(() => {
    if (mode !== "quiz") return [];
    return analyzeYaku(quizHand.length > 0 ? quizHand : [], [], ctx, currentLevel.maxHan);
  }, [mode, quizHand, ctx, currentLevel]);

  const startQuiz = useCallback(() => {
    const hand = generateQuizHand(currentLevel.maxHan, ctx);
    setQuizHand(hand);
    setQuizSelected([]);
    setQuizResult(null);
  }, [currentLevel, ctx]);

  const toggleQuizYaku = useCallback((name) => {
    setQuizSelected(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  }, []);

  const submitQuiz = useCallback(() => {
    const correctNames = quizCorrectYaku.map(y => y.name);
    const missed = correctNames.filter(n => !quizSelected.includes(n));
    const wrong = quizSelected.filter(n => !correctNames.includes(n));
    const isCorrect = missed.length === 0 && wrong.length === 0;

    setQuizResult({ correctNames, missed, wrong, isCorrect });
    setQuizScore(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));
  }, [quizCorrectYaku, quizSelected]);

  const nextQuiz = useCallback(() => {
    startQuiz();
  }, [startQuiz]);

  const switchMode = useCallback((newMode) => {
    setMode(newMode);
    if (newMode === "quiz") {
      const hand = generateQuizHand(currentLevel.maxHan, ctx);
      setQuizHand(hand);
      setQuizSelected([]);
      setQuizResult(null);
      setQuizScore({ correct: 0, total: 0 });
    }
  }, [currentLevel, ctx]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0f2a1a 0%, #1a3a2a 40%, #162e20 100%)",
      color: "#e0d8c4",
      fontFamily: "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif",
      padding: "16px", boxSizing: "border-box",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700,
            background: "linear-gradient(135deg, #e8a735, #f0d080)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: 2,
          }}>麻雀役道場</h1>
          <p style={{ fontSize: 11, color: "#6a7a5a", margin: "2px 0 0", fontFamily: "sans-serif" }}>
            {mode === "trainer" ? "手牌から狙える役を見極めよう" : "成立している役を当てよう"}</p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {/* Mode toggle */}
          <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", border: "1px solid #3a5a40" }}>
            {[{ key: "trainer", label: "道場" }, { key: "quiz", label: "クイズ" }].map(m => (
              <button key={m.key} onClick={() => switchMode(m.key)} style={{
                padding: "4px 10px", fontSize: 11, border: "none",
                background: mode === m.key ? "rgba(232,167,53,0.2)" : "rgba(0,0,0,0.2)",
                color: mode === m.key ? "#e8a735" : "#7a9a6a", cursor: "pointer", fontFamily: "sans-serif",
                fontWeight: mode === m.key ? 700 : 400,
              }}>{m.label}</button>
            ))}
          </div>
          {LEVELS.map((lv, i) => (
            <button key={i} onClick={() => setLevel(i)} style={{
              padding: "4px 10px", fontSize: 11, borderRadius: 4,
              border: i === level ? "1px solid #e8a735" : "1px solid #3a5a40",
              background: i === level ? "rgba(232,167,53,0.15)" : "rgba(0,0,0,0.2)",
              color: i === level ? "#e8a735" : "#7a9a6a", cursor: "pointer", fontFamily: "sans-serif",
            }}>{lv.name}</button>
          ))}
          <button onClick={mode === "trainer" ? dealHand : startQuiz} style={{
            padding: "6px 14px", fontSize: 12, borderRadius: 4,
            border: "1px solid #e8a735", background: "rgba(232,167,53,0.15)",
            color: "#e8a735", cursor: "pointer", fontWeight: 600, fontFamily: "sans-serif",
          }}>{mode === "trainer" ? "配牌" : "出題"}</button>
        </div>
      </div>

      {/* Info bar */}
      <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 12,
        color: "#8a9a7a", fontFamily: "sans-serif", flexWrap: "wrap" }}>
        {mode === "trainer" && <>
          <span>場風: {HONOR_NAMES[roundWind]}</span>
          <span>自風: {HONOR_NAMES[seatWind]}</span>
          <span>巡目: {turnCount}</span>
          <span>残り: {wall.length}枚</span>
        </>}
        <span>レベル: {currentLevel.label}</span>
        {mode === "quiz" && quizScore.total > 0 && (
          <span>正解率: {quizScore.correct}/{quizScore.total}</span>
        )}
      </div>

      {/* Quiz Mode */}
      {mode === "quiz" && quizHand.length > 0 && (
        <QuizPanel
          quizHand={quizHand}
          quizYakuList={quizYakuList}
          quizSelected={quizSelected}
          onToggleYaku={toggleQuizYaku}
          onSubmit={submitQuiz}
          quizResult={quizResult}
          onNext={nextQuiz}
          quizScore={quizScore}
          ctx={ctx}
        />
      )}

      {/* Trainer Mode */}
      {mode === "trainer" && (<>
      {/* Melds (committed + preview) */}
      {(melds.length > 0 || meldPreviewData?.meld) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
          {melds.map((m, i) => <MeldGroup key={i} meld={m} />)}
          {meldPreviewData?.meld && <MeldGroup meld={meldPreviewData.meld} preview />}
        </div>
      )}

      {/* Hand */}
      <div style={{
        background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: "14px 12px", marginBottom: 12,
        border: isPreviewing ? "1px solid rgba(240,192,80,0.3)" : "1px solid transparent",
        transition: "border-color 0.3s",
      }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "flex-end", justifyContent: "center" }}>
          {hand.map(t => (
            <Tile key={t.id} tile={t}
              selected={selectedTileId === t.id}
              onClick={phase === "discard" ? () => handleTileClick(t.id) : undefined}
            />
          ))}
          {drawnTile && (
            <>
              <div style={{ width: 10 }} />
              <Tile tile={drawnTile} drawn
                selected={selectedTileId === drawnTile.id}
                onClick={phase === "discard" ? () => handleTileClick(drawnTile.id) : undefined}
              />
            </>
          )}
        </div>

        {/* Phase actions */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8,
          marginTop: 12, minHeight: 44, alignItems: "center", flexWrap: "wrap" }}>

          {phase === "draw" && (
            <button onClick={drawTile} style={{
              padding: "8px 24px", fontSize: 14, borderRadius: 6,
              border: "none", background: "linear-gradient(135deg, #2a6a3a, #3a8a4a)",
              color: "#e0f0d0", cursor: "pointer", fontWeight: 700,
              fontFamily: "'Noto Serif JP', serif", letterSpacing: 2,
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}>ツモ</button>
          )}

          {phase === "discard" && selectedTileId === null && (
            <p style={{ fontSize: 12, color: "#c8a64c", margin: 0, fontFamily: "sans-serif" }}>
              牌をタップで選択 → 役への影響を確認</p>
          )}

          {phase === "discard" && selectedTileId !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: 6,
                background: "rgba(232,167,53,0.1)", border: "1px solid rgba(232,167,53,0.3)" }}>
                {selectedTileObj && <Tile tile={selectedTileObj} small />}
                <span style={{ fontSize: 12, color: "#c8a64c", fontFamily: "sans-serif" }}>を切ると…</span>
              </div>
              <DiffBadge summary={diffSummary} />
              <button onClick={() => confirmDiscard(selectedTileId)} style={{
                padding: "6px 18px", fontSize: 13, borderRadius: 5,
                border: "1px solid #e8a735", background: "rgba(232,167,53,0.2)",
                color: "#e8a735", cursor: "pointer", fontWeight: 700, fontFamily: "sans-serif",
              }}>打牌</button>
              <button onClick={() => setSelectedTileId(null)} style={{
                padding: "6px 14px", fontSize: 12, borderRadius: 5,
                border: "1px solid #5a7a5a", background: "rgba(0,0,0,0.2)",
                color: "#8a9a7a", cursor: "pointer", fontFamily: "sans-serif",
              }}>戻す</button>
            </div>
          )}

          {phase === "opponent" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#8a9a7a", fontFamily: "sans-serif" }}>他家の捨て牌:</span>
                  {opponentTile && <Tile tile={opponentTile} small />}
                </div>
                {canPon && (
                  <MeldActionBtn label="ポン" active={meldPreview === "pon"} color="#e87040"
                    onClick={() => meldPreview === "pon" ? confirmMeld() : setMeldPreview("pon")} />
                )}
                {canChi && (
                  <MeldActionBtn label="チー" active={meldPreview === "chi"} color="#4090e0"
                    onClick={() => meldPreview === "chi" ? confirmMeld() : setMeldPreview("chi")} />
                )}
                <MeldActionBtn label="スルー" active={meldPreview === "skip"} color="#7a9a7a"
                  onClick={() => meldPreview === "skip" ? confirmMeld() : setMeldPreview("skip")} />
              </div>
              {meldPreview && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center",
                  padding: "6px 12px", borderRadius: 6,
                  background: "rgba(232,167,53,0.08)", border: "1px solid rgba(232,167,53,0.2)" }}>
                  <span style={{ fontSize: 12, color: "#c8a64c", fontFamily: "sans-serif" }}>
                    {meldPreview === "pon" && "ポンすると…"}
                    {meldPreview === "chi" && "チーすると…"}
                    {meldPreview === "skip" && "スルーすると…"}
                  </span>
                  <DiffBadge summary={diffSummary} />
                  <button onClick={confirmMeld} style={{
                    padding: "5px 16px", fontSize: 12, borderRadius: 5,
                    border: "1px solid #e8a735", background: "rgba(232,167,53,0.2)",
                    color: "#e8a735", cursor: "pointer", fontWeight: 700, fontFamily: "sans-serif",
                  }}>確定</button>
                  <button onClick={() => setMeldPreview(null)} style={{
                    padding: "5px 12px", fontSize: 11, borderRadius: 5,
                    border: "1px solid #5a7a5a", background: "rgba(0,0,0,0.2)",
                    color: "#8a9a7a", cursor: "pointer", fontFamily: "sans-serif",
                  }}>比較</button>
                </div>
              )}
              {!meldPreview && (
                <p style={{ fontSize: 11, color: "#6a7a5a", margin: 0, fontFamily: "sans-serif" }}>
                  タップで役への影響をプレビュー → もう一度タップ or 確定で実行</p>
              )}
            </div>
          )}

          {phase === "ended" && (
            <p style={{ fontSize: 14, color: "#c8a64c", fontFamily: "sans-serif" }}>
              牌山がなくなりました（流局）</p>
          )}
        </div>
      </div>

      {/* Hand Decomposition */}
      <HandDecomposition groups={handDecomposition} />

      {/* Shanten & Accept Tiles */}
      <ShantenPanel shanten={shantenInfo.shanten} acceptTiles={shantenInfo.tiles} />

      {/* Discard pool */}
      {discardPool.length > 0 && (
        <div style={{ marginBottom: 12, padding: "8px 10px", background: "rgba(0,0,0,0.15)", borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: "#6a7a5a", marginBottom: 4, fontFamily: "sans-serif" }}>捨て牌</div>
          <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {discardPool.map((t, i) => <Tile key={i} tile={t} small dimmed />)}
          </div>
        </div>
      )}

      {/* Score Panel */}
      {agariResult && (
        <ScorePanel
          resolvedYaku={agariResult.resolvedYaku}
          totalHan={agariResult.totalHan}
          fu={agariResult.fu}
          scoreInfo={agariResult.scoreInfo}
        />
      )}

      {/* Yaku Analysis Panel */}
      <div style={{
        background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: 12,
        border: isPreviewing ? "1px solid rgba(232,167,53,0.35)" : "1px solid rgba(200,166,76,0.15)",
        transition: "border-color 0.3s ease",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#c8a64c", letterSpacing: 1 }}>
            {previewTitle}
          </div>
          {isPreviewing && (
            <div style={{ display: "flex", gap: 12, fontSize: 10, fontFamily: "sans-serif" }}>
              <span style={{ color: "#50c878" }}>▲ 近づく</span>
              <span style={{ color: "#dc503c" }}>▼ 遠ざかる</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {displayList.length === 0 && (
            <p style={{ fontSize: 12, color: "#5a6a4a", fontFamily: "sans-serif" }}>配牌してください</p>
          )}
          {displayList.map(item => (
            <YakuRow key={item.name} name={item.name} reading={item.reading} han={item.han}
              explain={item.explain}
              result={item.result} diff={item.diff} maxDist={maxDist}
              expanded={expandedYaku === item.name}
              onToggle={() => setExpandedYaku(expandedYaku === item.name ? null : item.name)}
              isTarget={targetYaku === item.name}
              onTarget={() => setTargetYaku(targetYaku === item.name ? null : item.name)}
              isHandComplete={isHandComplete}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        marginTop: 16, padding: "10px 12px", fontSize: 10, color: "#5a6a4a",
        fontFamily: "sans-serif", background: "rgba(0,0,0,0.1)", borderRadius: 6, lineHeight: 1.8,
      }}>
        <strong style={{ color: "#7a8a6a" }}>手牌構成:</strong>{" "}
        <span style={{ color: GROUP_STYLES.shuntsu.color }}>順子</span>　
        <span style={{ color: GROUP_STYLES.koutsu.color }}>刻子</span>　
        <span style={{ color: GROUP_STYLES.toitsu.color }}>対子</span>　
        <span style={{ color: GROUP_STYLES.kantsu.color }}>槓子</span>　
        <span style={{ color: GROUP_STYLES.tatsu.color }}>搭子</span>　
        <span style={{ color: GROUP_STYLES.isolated.color }}>孤立</span>　|　
        <strong style={{ color: "#7a8a6a" }}>操作:</strong>{" "}
        1タップ＝プレビュー → 2タップ/確定で実行　|　
        <span style={{ color: "#50c878" }}>緑＝近づく</span>
        <span style={{ color: "#dc503c" }}>赤＝遠ざかる</span>
      </div>
      </>)}
    </div>
  );
}
