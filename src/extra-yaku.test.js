import test from "node:test";
import assert from "node:assert/strict";
import { evaluateExtraYaku } from "./extra-yaku.js";

function tiles(...groups) {
  return groups.flatMap(group => [...group.slice(1)].map(num => ({ suit: group[0], num: Number(num) })));
}

function kan(suit, num) {
  return { type: "kan", tiles: Array.from({ length: 4 }, () => ({ suit, num })) };
}

test("混老頭は数牌の老頭牌と字牌を両方含む完成形だけ", () => {
  assert.equal(evaluateExtraYaku(tiles("m111", "p999", "z555", "z666", "z77"))["混老頭"], true);
  assert.equal(evaluateExtraYaku(tiles("z111", "z222", "z333", "z444", "z55"))["混老頭"], false);
  assert.equal(evaluateExtraYaku(tiles("m111", "m999", "p111", "p999", "s11"))["混老頭"], false);
});

test("三色同刻は同じ数字の刻子を3色とも使う", () => {
  assert.equal(evaluateExtraYaku(tiles("m555", "p555", "s555", "z111", "z22"))["三色同刻"], true);
  assert.equal(evaluateExtraYaku(tiles("m555", "p456", "s555", "z111", "z22"))["三色同刻"], false);
});

test("小三元と大三元は三元牌の雀頭と刻子を区別する", () => {
  const small = evaluateExtraYaku(tiles("z555", "z666", "z77", "m123", "p789"));
  assert.equal(small["小三元"], true);
  assert.equal(small["大三元"], false);
  const big = evaluateExtraYaku(tiles("z555", "z666", "z777", "m123", "p99"));
  assert.equal(big["大三元"], true);
  assert.equal(big["小三元"], false);
});

test("小四喜は風牌3刻子と残りの風牌の雀頭で成立する", () => {
  assert.equal(evaluateExtraYaku(tiles("z111", "z222", "z333", "z44", "m123"))["小四喜"], true);
  assert.equal(evaluateExtraYaku(tiles("z111", "z222", "z333", "z55", "m123"))["小四喜"], false);
});

test("緑一色は緑の牌だけの完成形で成立する", () => {
  assert.equal(evaluateExtraYaku(tiles("s222", "s333", "s444", "s666", "s88"))["緑一色"], true);
  assert.equal(evaluateExtraYaku(tiles("s2222", "s3333", "s6666", "s88"))["緑一色"], false);
  assert.equal(evaluateExtraYaku(tiles("s222", "s333", "s444", "s777", "s88"))["緑一色"], false);
});

test("三槓子・四槓子は宣言した4枚組でのみ成立する", () => {
  const three = evaluateExtraYaku(tiles("m789", "z77"), [kan("m", 2), kan("p", 3), kan("s", 4)]);
  assert.equal(three["三槓子"], true);
  assert.equal(three["四槓子"], false);
  const four = evaluateExtraYaku(tiles("z66"), [kan("m", 2), kan("p", 3), kan("s", 4), kan("z", 5)]);
  assert.equal(four["四槓子"], true);
  assert.equal(four["三槓子"], false);
  assert.equal(evaluateExtraYaku(tiles("m2222", "p3333", "s4444", "z55"))["三槓子"], false);
});

test("九蓮宝燈は門前の1112345678999と同色の1枚", () => {
  assert.equal(evaluateExtraYaku(tiles("m11123456789995"))["九蓮宝燈"], true);
  assert.equal(evaluateExtraYaku(tiles("m1112345678999", "p5"))["九蓮宝燈"], false);
});
