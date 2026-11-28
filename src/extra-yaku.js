const keyOf = tile => `${tile.suit}${tile.num}`;
const DRAGONS = ["z5", "z6", "z7"];
const WINDS = ["z1", "z2", "z3", "z4"];
const GREEN = new Set(["s2", "s3", "s4", "s6", "s8", "z6"]);

function regularDecompositions(hand, melds) {
  const counts = {};
  for (const tile of hand) counts[keyOf(tile)] = (counts[keyOf(tile)] || 0) + 1;
  const fixed = melds.map(meld => {
    const tiles = meld.tiles || [];
    if (meld.type === "kan" && tiles.length === 4 && tiles.every(t => keyOf(t) === keyOf(tiles[0])))
      return { type: "kantsu", key: keyOf(tiles[0]) };
    if (meld.type === "pon" && tiles.length === 3 && tiles.every(t => keyOf(t) === keyOf(tiles[0])))
      return { type: "koutsu", key: keyOf(tiles[0]) };
    if (meld.type === "chi" && tiles.length === 3) {
      const sorted = [...tiles].sort((a, b) => a.num - b.num);
      if (sorted[0].suit !== "z" && sorted.every(t => t.suit === sorted[0].suit)
          && sorted[1].num === sorted[0].num + 1 && sorted[2].num === sorted[0].num + 2)
        return { type: "shuntsu", key: keyOf(sorted[0]) };
    }
    return null;
  });
  if (fixed.includes(null) || hand.length + melds.length * 3 !== 14) return [];

  const results = [];
  function search(pair, groups) {
    const key = Object.keys(counts).sort().find(k => counts[k] > 0);
    if (!key) {
      if (groups.length + fixed.length === 4 && pair) results.push({ pair, groups: [...groups, ...fixed] });
      return;
    }
    if (groups.length + fixed.length >= 4) return;
    if (counts[key] >= 3) {
      counts[key] -= 3;
      search(pair, [...groups, { type: "koutsu", key }]);
      counts[key] += 3;
    }
    const suit = key[0], number = Number(key.slice(1));
    if (suit !== "z" && number <= 7) {
      const keys = [key, `${suit}${number + 1}`, `${suit}${number + 2}`];
      if (keys.every(k => counts[k] > 0)) {
        keys.forEach(k => { counts[k]--; });
        search(pair, [...groups, { type: "shuntsu", key }]);
        keys.forEach(k => { counts[k]++; });
      }
    }
  }
  for (const pair of Object.keys(counts)) {
    if (counts[pair] < 2) continue;
    counts[pair] -= 2;
    search(pair, []);
    counts[pair] += 2;
  }
  return results;
}

export function evaluateExtraYaku(hand, melds = []) {
  const all = [...hand, ...melds.flatMap(m => m.tiles)];
  const physicalCounts = {};
  for (const tile of all) {
    const key = keyOf(tile);
    physicalCounts[key] = (physicalCounts[key] || 0) + 1;
    if (physicalCounts[key] > 4) return {};
  }
  const decompositions = regularDecompositions(hand, melds);
  const sevenPairs = melds.length === 0 && hand.length === 14
    && Object.keys(physicalCounts).length === 7
    && Object.values(physicalCounts).every(count => count === 2);
  const complete = decompositions.length > 0 || sevenPairs;
  const allTerminalOrHonor = all.every(t => t.suit === "z" || t.num === 1 || t.num === 9);
  const kanCount = melds.filter(m => m.type === "kan" && m.tiles.length === 4).length;
  const tripletKeys = groups => new Set(groups.filter(g => g.type === "koutsu" || g.type === "kantsu").map(g => g.key));

  return {
    "混老頭": complete && allTerminalOrHonor && all.some(t => t.suit === "z") && all.some(t => t.suit !== "z"),
    "三色同刻": decompositions.some(({ groups }) => {
      const trips = tripletKeys(groups);
      return Array.from({ length: 9 }, (_, i) => i + 1).some(n => ["m", "p", "s"].every(s => trips.has(`${s}${n}`)));
    }),
    "三槓子": decompositions.length > 0 && kanCount === 3,
    "小三元": decompositions.some(({ pair, groups }) => DRAGONS.includes(pair)
      && DRAGONS.filter(key => tripletKeys(groups).has(key)).length === 2),
    "大三元": decompositions.some(({ groups }) => DRAGONS.every(key => tripletKeys(groups).has(key))),
    "小四喜": decompositions.some(({ pair, groups }) => WINDS.includes(pair)
      && WINDS.filter(key => tripletKeys(groups).has(key)).length === 3),
    "緑一色": decompositions.length > 0 && all.every(t => GREEN.has(keyOf(t))),
    "四槓子": decompositions.length > 0 && kanCount === 4,
    "九蓮宝燈": melds.length === 0 && hand.length === 14 && ["m", "p", "s"].some(suit => {
      if (!hand.every(t => t.suit === suit)) return false;
      const base = [0, 3, 1, 1, 1, 1, 1, 1, 1, 3];
      return Array.from({ length: 9 }, (_, i) => i + 1).every(n => (physicalCounts[`${suit}${n}`] || 0) >= base[n]);
    }),
  };
}

export function estimateExtraYakuDistance(name, hand, melds = []) {
  const all = [...hand, ...melds.flatMap(m => m.tiles)];
  const counts = {};
  for (const tile of all) counts[keyOf(tile)] = (counts[keyOf(tile)] || 0) + 1;
  const missing = (key, count) => Math.max(0, count - (counts[key] || 0));
  const kanCount = melds.filter(m => m.type === "kan").length;
  let distance = 12;
  switch (name) {
    case "混老頭":
      distance = all.filter(t => t.suit !== "z" && t.num !== 1 && t.num !== 9).length
        + Number(!all.some(t => t.suit === "z")) + Number(!all.some(t => t.suit !== "z"));
      break;
    case "三色同刻":
      distance = Math.min(...Array.from({ length: 9 }, (_, i) => i + 1)
        .map(n => ["m", "p", "s"].reduce((sum, suit) => sum + missing(`${suit}${n}`, 3), 0)));
      break;
    case "三槓子": distance = (3 - kanCount) * 3; break;
    case "四槓子": distance = (4 - kanCount) * 3; break;
    case "小三元":
      distance = Math.min(...DRAGONS.map(pair => missing(pair, 2)
        + DRAGONS.filter(key => key !== pair).reduce((sum, key) => sum + missing(key, 3), 0)));
      break;
    case "大三元": distance = DRAGONS.reduce((sum, key) => sum + missing(key, 3), 0); break;
    case "小四喜":
      distance = Math.min(...WINDS.map(pair => missing(pair, 2)
        + WINDS.filter(key => key !== pair).reduce((sum, key) => sum + missing(key, 3), 0)));
      break;
    case "緑一色": distance = all.filter(t => !GREEN.has(keyOf(t))).length; break;
    case "九蓮宝燈":
      distance = Math.min(...["m", "p", "s"].map(suit => {
        const base = [0, 3, 1, 1, 1, 1, 1, 1, 1, 3];
        return all.filter(t => t.suit !== suit).length
          + Array.from({ length: 9 }, (_, i) => i + 1).reduce((sum, n) => sum + missing(`${suit}${n}`, base[n]), 0);
      }));
      break;
  }
  return Math.min(12, Math.max(1, distance));
}
