import test from "node:test";
import assert from "node:assert/strict";
import { countDisjointPeikouPairs, findPeikouGroups } from "./peikou.js";

function souzu(numbers) {
  return [...numbers].map(num => ({ suit: "s", num: Number(num) }));
}

test("報告された牌姿では四索を重複利用せず、盃口は成立しない", () => {
  const hand = souzu("23344455667899");
  assert.equal(countDisjointPeikouPairs(hand), 1);
  assert.equal(findPeikouGroups(hand, 1), null);
  assert.equal(findPeikouGroups(hand, 2), null);
});

test("2組の順子が実際に分けられる二盃口は成立する", () => {
  const hand = souzu("22334455667788");
  assert.equal(countDisjointPeikouPairs(hand), 2);
  assert.ok(findPeikouGroups(hand, 2));
});

test("同じ順子4組と別の雀頭でも二盃口が成立する", () => {
  const hand = souzu("22223333444499");
  assert.equal(countDisjointPeikouPairs(hand), 2);
  assert.ok(findPeikouGroups(hand, 2));
});

test("一盃口だけ成立する完成形と、七対子だけの牌姿を区別する", () => {
  const iipeikou = souzu("22334456778999");
  assert.ok(findPeikouGroups(iipeikou, 1));
  assert.equal(findPeikouGroups(iipeikou, 2), null);

  const chiitoi = souzu("1133557799").concat(
    [{ suit: "m", num: 1 }, { suit: "m", num: 1 }],
    [{ suit: "p", num: 1 }, { suit: "p", num: 1 }],
  );
  assert.equal(findPeikouGroups(chiitoi, 1), null);
});
