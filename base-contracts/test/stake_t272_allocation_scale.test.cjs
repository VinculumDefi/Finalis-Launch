// t272u item 1: allocateEpoch cost does not grow with the number of
// historical positions (10, 1,000 and 10,000 here; 25,000 in
// test-scale/stake_allocation_25000.test.cjs, run separately because of its
// run time). Nothing is broadcast. No keys.
const { runScale, report } = require("../test-scale/stakeAllocScale.cjs");

describe("t272u allocateEpoch constant cost: 10, 1,000 and 10,000 historical positions", function () {
  this.timeout(7200000);
  it("same allocateEpoch gas at every size (spread at most 100 gas)", async () => {
    const res = [];
    for (const P of [10, 1000, 10000]) res.push(await runScale(P));
    report(res, 100);
  });
});
