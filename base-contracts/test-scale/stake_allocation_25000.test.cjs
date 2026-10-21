// t272u item 1, large size: allocateEpoch gas with 10, 1,000, 10,000 and
// 25,000 historical positions. Not in the default suite (run time). Run:
//   npx hardhat test test-scale/stake_allocation_25000.test.cjs
// Nothing is broadcast. No keys.
const { runScale, report } = require("./stakeAllocScale.cjs");

describe("t272u allocateEpoch constant cost up to 25,000 historical positions", function () {
  this.timeout(14400000);
  it("same allocateEpoch gas at 10, 1,000, 10,000 and 25,000 positions (spread at most 100 gas)", async () => {
    const res = [];
    for (const P of [10, 1000, 10000, 25000]) res.push(await runScale(P));
    report(res, 100);
  });
});
