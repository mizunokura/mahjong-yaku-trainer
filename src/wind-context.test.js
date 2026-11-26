import test from "node:test";
import assert from "node:assert/strict";
import { randomWindContext, windYakuHan } from "./wind-context.js";

test("場風と自風の全16通りを選べる", () => {
  const combinations = new Set();
  for (let choice = 0; choice < 16; choice++) {
    const ctx = randomWindContext(null, () => choice / 16);
    combinations.add(`${ctx.roundWind}${ctx.seatWind}`);
  }
  assert.equal(combinations.size, 16);
  assert.ok(combinations.has("11"));
  assert.ok(combinations.has("44"));
});

test("次の問題では場風と自風がそれぞれ前回から変わる", () => {
  for (let roundWind = 1; roundWind <= 4; roundWind++) {
    for (let seatWind = 1; seatWind <= 4; seatWind++) {
      const previous = { roundWind, seatWind };
      const combinations = new Set();
      for (let choice = 0; choice < 9; choice++) {
        const next = randomWindContext(previous, () => choice / 9);
        assert.notEqual(next.roundWind, roundWind);
        assert.notEqual(next.seatWind, seatWind);
        combinations.add(`${next.roundWind}${next.seatWind}`);
      }
      assert.equal(combinations.size, 9);
    }
  }
});

test("役牌の翻数は場風・自風に応じて変わり、連風牌は2翻になる", () => {
  assert.equal(windYakuHan({ roundWind: 1, seatWind: 2 }, "z1"), 1);
  assert.equal(windYakuHan({ roundWind: 1, seatWind: 2 }, "z2"), 1);
  assert.equal(windYakuHan({ roundWind: 1, seatWind: 2 }, "z3"), 0);
  assert.equal(windYakuHan({ roundWind: 3, seatWind: 3 }, "z3"), 2);
  assert.equal(windYakuHan({ roundWind: 3, seatWind: 3 }, "z5"), 0);
});
