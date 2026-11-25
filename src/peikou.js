// 同順を組むたびに実際の牌を消費し、重なった順子で同じ牌を使い回さない。
export function countDisjointPeikouPairs(tiles) {
  const counts = Object.create(null);
  for (const tile of tiles) {
    const key = `${tile.suit}${tile.num}`;
    counts[key] = (counts[key] || 0) + 1;
  }

  function search(startIndex) {
    let best = 0;
    for (let index = startIndex; index < 21; index++) {
      const suit = ["m", "p", "s"][Math.floor(index / 7)];
      const start = index % 7 + 1;
      const keys = [0, 1, 2].map(offset => `${suit}${start + offset}`);
      if (!keys.every(key => (counts[key] || 0) >= 2)) continue;
      keys.forEach(key => { counts[key] -= 2; });
      best = Math.max(best, 1 + search(index));
      keys.forEach(key => { counts[key] += 2; });
    }
    return best;
  }

  return search(0);
}

// 完成形の4面子1雀頭を全探索し、一盃口／二盃口を満たす分解を返す。
// 七対子と同じ牌姿でも、4面子1雀頭に分けられる場合だけ成立する。
export function findPeikouGroups(tiles, requiredPairs) {
  if (tiles.length !== 14) return null;
  const counts = Object.create(null);
  for (const tile of tiles) {
    const key = `${tile.suit}${tile.num}`;
    counts[key] = (counts[key] || 0) + 1;
  }

  function search(groups) {
    const key = Object.keys(counts).sort().find(candidate => counts[candidate] > 0);
    if (!key) {
      if (groups.length !== 4) return null;
      const sequences = Object.create(null);
      for (const group of groups) {
        if (group.type === "shuntsu") sequences[group.key] = (sequences[group.key] || 0) + 1;
      }
      const pairs = Object.values(sequences).reduce((sum, count) => sum + Math.floor(count / 2), 0);
      return pairs >= requiredPairs ? [...groups] : null;
    }
    if (groups.length >= 4) return null;

    if (counts[key] >= 3) {
      counts[key] -= 3;
      const found = search([...groups, { type: "koutsu", key }]);
      counts[key] += 3;
      if (found) return found;
    }
    const suit = key[0], start = Number(key.slice(1));
    if (suit !== "z" && start <= 7) {
      const keys = [0, 1, 2].map(offset => `${suit}${start + offset}`);
      if (keys.every(candidate => counts[candidate] > 0)) {
        keys.forEach(candidate => { counts[candidate]--; });
        const found = search([...groups, { type: "shuntsu", key }]);
        keys.forEach(candidate => { counts[candidate]++; });
        if (found) return found;
      }
    }
    return null;
  }

  for (const pairKey of Object.keys(counts).sort()) {
    if (counts[pairKey] < 2) continue;
    counts[pairKey] -= 2;
    const found = search([]);
    counts[pairKey] += 2;
    if (found) return found;
  }
  return null;
}
