// RETIRED (t251u). Do not use. This script sends nothing.
//
// It deployed VCLM, CHONX, a Base lock, a Verifier, Forge and Stake on Base
// mainnet, outside the ceremony (no readers, no registry, no finalize).
// It is not part of the Revision B deployment.
//
// For the deployment use only the pages in scripts/deploy-pages/: the six lock
// pages, then base.html. The order is in deployment/DEPLOYMENT_DAY_RUNBOOK.md.
// The previous version of this script is in git history (before commit t251u).
//
// This file loads no wallet, network or contract code. Running it, directly or
// through "npx hardhat run", prints this notice and exits with an error.
"use strict";

console.error(
  "RETIRED: scripts/broadcastRepresentativeBase.cjs is retired and sends nothing.\n" +
  "Use the deploy pages in scripts/deploy-pages/ and follow deployment/DEPLOYMENT_DAY_RUNBOOK.md."
);
process.exitCode = 1;
