// =============================================================================
// PROVENANCE: Vinculum_Finalis_Approved_Asset_Registry.json — Revision 6, 2026-07-28
// Governing source SHA-256: 5a9350618d81005d53b4d05628e7403e8c39fe63847a46576a5fadfbd4ef0bf9
//
// This file embeds all 78 Solana-environment entries from the authoritative 1,001-entry
// registry. Every field is transcribed verbatim — no canonical field is altered, substituted,
// or invented. VF-REG-001: "The approved asset registry is the sole source of recognized
// external asset identities for Commitment Vault Locks."
//
// VF-REG-011 / P1-02 acceptance: "Displays exactly 1,001 entries across exactly 17 environments
// with unchanged canonical fields." This module exposes the 78 Solana entries with unchanged
// canonical fields.
//
// Verified: all 78 entries are class S3 (1.0x multiplier). None are S1 or S2.
// =============================================================================

const ENVIRONMENT = 'Solana';
const CLASS = 'S3';

// Compact tuple format: [registry_row, symbol, asset_name, contract_or_native_identifier, pricing_identifier]
const RAW = [
  [5, 'SOL', 'Solana', 'NATIVE (So11111111111111111111111111111111111111112 wrapped)', 'solana'],
  [16, 'USDC_SOL', 'USDC on Solana', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'usd-coin'],
  [30, 'BONK', 'BONK', 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', 'bonk'],
  [31, 'PENGU', 'Pudgy Penguins', '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv', 'pudgy-penguins'],
  [33, 'WIF', 'Dogwifhat', 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', 'dogwifcoin'],
  [72, 'PYTH', 'Pyth Network', 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', 'pyth-network'],
  [78, 'JTO', 'Jito', 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', 'jito-governance-token'],
  [79, 'JUP', 'Jupiter', 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', 'jupiter-exchange-solana'],
  [80, 'RAY', 'Raydium', '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', 'raydium'],
  [104, 'RNDR', 'Render Network', '0x6De037ef9aD2725EB40118Bb1702EBb27e4Aeb24', 'render-token'],
  [105, 'POPCAT', 'Popcat', '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', 'popcat'],
  [106, 'FARTCOIN', 'Fartcoin', '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', 'fartcoin'],
  [107, 'MEW', 'Cat in a Dogs World', 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5', 'cat-in-a-dogs-world'],
  [122, 'ai16Z', 'ai16z', 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC', 'ai16z'],
  [142, 'PNUT', 'Peanut', '2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump', 'peanut-the-squirrel'],
  [143, 'BOME', 'Book of Meme', 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82', 'book-of-meme'],
  [149, 'TRUMP', 'Official Trump', '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN', 'official-trump'],
  [150, 'TNSR', 'Tensor', 'TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6', 'tensor'],
  [163, 'jitoSOL', 'JitoSOL', 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', 'jito-staked-sol'],
  [170, 'HNT', 'Helium', 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux', 'helium'],
  [171, 'ORCA', 'Orca', 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE', 'orca'],
  [172, 'DRIFT', 'Drift Protocol', 'DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7', 'drift-protocol'],
  [176, 'KMNO', 'Kamino Finance', 'KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS', 'kamino'],
  [177, 'mSOL', 'Marinade SOL', 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', 'msol'],
  [179, 'ELIZA', 'elizaOS', '5voS9evDjxF589WuEub5i4ti7FWQmZCsAsyD5ucbuRqM', 'eliza'],
  [180, 'PONKE', 'Ponke', '5z3EqYQo9HiCEs3R84RCDMu2n7anpDMxRhdK8PSWmrRC', 'ponke'],
  [181, 'MOODENG', 'Moo Deng', 'ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY', 'moo-deng'],
  [183, 'MUMU', 'Mumu the Bull', '5LafQUrVco6o7KMz42eqVEJ9LW31StPyGjeeu5sKoMtA', 'mumu-the-bull-3'],
  [192, 'PIPPIN', 'Pippin', 'Dfh5DzRgSvvCFDoYc2ciTkMrbDfRKybA4SoFbPmApump', 'pippin'],
  [196, 'GOAT', 'Goat', 'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump', 'goatseus-maximus'],
  [197, 'CHILLGUY', 'Chill Guy', 'Df6yfrKC8kZE3KNkr8Z8DL5Bv31HkXqsrahTTUCZeZg4', 'chill-guy'],
  [199, 'IO', 'io.net', 'BZLbGTNCSFfoth2GYDtwr7e4imWzpR5jqcUuGEwr646K', 'io-net'],
  [200, 'STEPN', 'GST (Solana)', 'AFbX8oGjGpmVFywbVouvhQSRmiW2aR1mohfahi4Y2AdB', 'green-satoshi-token'],
  [210, 'GRASS', 'Grass', 'Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs', 'grass'],
  [238, 'MPLX', 'Metaplex', 'METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m', 'metaplex'],
  [239, 'MOBILE', 'Helium Mobile', 'mb1eu7TzEc71KxDpsmsKoucSSuuoGLv1drys1oP2jh6', 'helium-mobile'],
  [240, 'MNDE', 'Marinade Finance', 'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey', 'marinade'],
  [246, 'CLOUD', 'Sanctum', 'CLoUDKc4Ane7HeQcPpE3YHnznRxhMimJ4MyaUqyHFzAu', 'sanctum-2'],
  [276, 'TNSR2', 'Tensor (defi)', 'TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6', 'tensor'],
  [277, 'ZEREBRO', 'Zerebro', '8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn', 'zerebro'],
  [278, 'ARC', 'AI Rig Complex', '61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump', 'ai-rig-complex'],
  [280, 'HONEY_HM', 'Hivemapper Honey', '4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy', 'hivemapper'],
  [281, 'ATLAS', 'Star Atlas', 'ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx', 'star-atlas'],
  [288, 'DEGENAI', 'Degen AI', 'Gu3LDkn7Vx3bmCzLafYNKcDxv2mH7YN44NJZFXnypump', 'degen-ai'],
  [300, 'DOGE2', 'Dogecoin (Solana wrap)', 'A6aK89T94bVkknpFELSHqcm1axGvVqxbH3tnLPHDpump', 'dogecoin'],
  [301, 'ACT', 'Act I', 'GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgUnpump', 'act-i-the-ai-prophecy'],
  [302, 'MYRO', 'Myro', 'HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg4', 'myro'],
  [303, 'WEN', 'WEN', 'WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk', 'wen-4'],
  [308, 'TROLL', 'TROLL', '5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2', 'troll-2'],
  [309, 'GIGA', 'Gigachad', '63LfDmNb3MQ8mw9MtZ2To9bEA2M71kZUUGq5tiJxcqj9', 'gigachad-2'],
  [318, 'TRUTH', 'Truth Terminal', '8sgkCEdLpcNGqDsLDBgrqsbqFkRBJsbaHcQXjbpDpump', 'truth-terminal'],
  [319, 'MELANIA', 'Melania', 'FUAfBo2jgks6gB4Z4LfZkqSZgzNucisEHqnNebaRxM1P', 'melania-meme'],
  [334, 'PUNCH', 'Punch', 'NV2RYH954cTJ3ckFUpvfqaQXU4ARqqDH3562nFSpump', 'punch'],
  [335, 'SLERF', 'Slerf', '7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx7LoiVkM3', 'slerf'],
  [336, 'VVAIFU', 'VVaifu', 'FQ1tyso61AH1tzodyJfSwmzsD3GToybbRNoZxUBz21p8', 'dasha'],
  [337, 'HARAMBE', 'Harambe', 'Fch1oixTPri8zxBnmdCEADoJW2toyFHxqDZacQkwdvSP', 'harambe'],
  [338, 'FWOG', 'Fwog', 'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump', 'fwog'],
  [339, 'KNINE', 'K9 Finance', 'EKtMEENYmE4o6xyMbM3tAK7f4BkmKKNBY8dNRGBpump', 'k9-finance-dao'],
  [374, 'SAMO', 'Samoyedcoin', '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', 'samoyedcoin'],
  [375, 'HXRO', 'Hxro Network', 'HxhWkVpk5NS4Ltg5nij2G671CKXFRKPK8vy271Ub4uEK', 'hxro'],
  [376, 'POLIS', 'Star Atlas POLIS', 'poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk', 'star-atlas-dao'],
  [378, 'IOT', 'Helium IoT', 'iotEVVZLEywoTn1QdwNPddxPWszn3zFhEot3MfL9fns', 'helium-iot'],
  [380, 'HONEY_SOL', 'Hivemapper Honey', '4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy', 'hivemapper'],
  [381, 'GRIFFAIN', 'Griffain', 'KENJSUYLASHUMfHyy5o4Hp2FdNqZg1AsUPhfH2kYvEP', 'griffain'],
  [382, 'RETARDIO', 'Retardio', '6ogzHhzdrQr9Pgv6hZ2MNze7UrzBMAFyBBWUYp1Fhitx', 'retardio'],
  [386, 'LUNA_AI', 'Luna AI agent', '9se6kma7LeGcQWyRBNcYzyxZPE3r9t9qWZ8SnjnN3jJ7', 'luna-by-virtuals'],
  [388, 'TREMP', 'Tremp', 'FU1q8vJpZNUrmqsciSjp8bAKKidGsLmouB8CBdf8TKQv', 'doland-tremp'],
  [389, 'BODEN', 'Jeo Boden', '3psH1Mj1f7yUfaD5gh6Zj7epE8hhrMkMETgv5TshQA4o', 'jeo-boden'],
  [392, 'VIRTUAL2', 'Virtuals (Solana)', '3iQL8BFS2vE7mww4ehAqQHAsbmRNCrPxizWAT2Zfyr9y', 'virtual-protocol'],
  [394, 'GNON', 'Gnon', 'HeJUFDxfJSzYFUuHLxkMqCgytU31G6mjP4wKviwqpump', 'gnon'],
  [407, 'STEP', 'Step Finance', 'StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT', 'step-finance'],
  [409, 'SIGMA', 'Sigma', '5SVG3T9CNQsm2kEwzbRq6hASqh1oGfjqTtLXYUibpump', 'sigma-sol'],
  [414, 'NATIX', 'NATIX', 'FRySi8LPkuByB7VPSCCggxpewFUeeJiwEGRKKuhwpKcX', 'natix-network'],
  [416, 'MNGO', 'Mango Markets', 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac', 'mango-markets'],
  [436, 'RNDR_SOL', 'RNDR (Solana)', 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof', 'render-token'],
  [477, '2Z', 'DoubleZero', 'J6pQQ3FAcJQeWPPGppWRb4nM8jU3wLyYbRrLh7feMfvd', 'doublezero'],
  [519, 'YZY', 'YZY Money', 'DrZ26cKJDksVRWib3DVVsjo9eeXccc7hKhDJviiYEEZY', 'yzy'],
  [520, 'ZBCN', 'Zebec Network', 'ZBCNpuD7YMXzTHB2fhGkGi78MNsHGLRXUhRewNRm9RU', 'zebec-network'],
];

export const SOLANA_REGISTRY = RAW.map(
  ([registry_row, symbol, asset_name, contract_or_native_identifier, pricing_identifier]) => ({
    registry_row,
    symbol,
    asset_name,
    environment: ENVIRONMENT,
    contract_or_native_identifier,
    class: CLASS,
    pricing_identifier,
  }),
);

export const SOLANA_REGISTRY_COUNT = SOLANA_REGISTRY.length; // 78