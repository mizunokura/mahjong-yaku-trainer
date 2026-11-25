// 東・南・西・北の16通りから選ぶ。前回と同じ組み合わせは続けない。
export function randomWindContext(previous = null, random = Math.random) {
  const previousIndex = previous
    ? (previous.roundWind - 1) * 4 + previous.seatWind - 1
    : -1;
  const choice = Math.floor(random() * (previous ? 15 : 16));
  const index = previous && choice >= previousIndex ? choice + 1 : choice;
  return { roundWind: Math.floor(index / 4) + 1, seatWind: index % 4 + 1 };
}

export function windYakuHan(ctx, tileKey) {
  if (!/^z[1-4]$/.test(tileKey)) return 0;
  return Number(tileKey === `z${ctx?.roundWind}`) + Number(tileKey === `z${ctx?.seatWind}`);
}
