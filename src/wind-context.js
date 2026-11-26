// 初回は16通り。次回以降は場風・自風をそれぞれ前回以外の3通りから選ぶ。
export function randomWindContext(previous = null, random = Math.random) {
  if (!previous) {
    const index = Math.floor(random() * 16);
    return { roundWind: Math.floor(index / 4) + 1, seatWind: index % 4 + 1 };
  }

  const choice = Math.floor(random() * 9);
  const chooseOtherWind = (oldWind, offset) => {
    const candidate = offset + 1;
    return candidate >= oldWind ? candidate + 1 : candidate;
  };
  return {
    roundWind: chooseOtherWind(previous.roundWind, Math.floor(choice / 3)),
    seatWind: chooseOtherWind(previous.seatWind, choice % 3),
  };
}

export function windYakuHan(ctx, tileKey) {
  if (!/^z[1-4]$/.test(tileKey)) return 0;
  return Number(tileKey === `z${ctx?.roundWind}`) + Number(tileKey === `z${ctx?.seatWind}`);
}
