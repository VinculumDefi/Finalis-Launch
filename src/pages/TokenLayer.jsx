import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TokenLayerState, formatTokenAmount } from '@/lib/vfTokenEngine';
import { VerifierState, verifyProof } from '@/lib/vfVerifierEngine';
import { buildMockEvent, buildFinalityProof } from '@/lib/vfMockEventBuilder';
import { normalizeSolanaEvidence, normalizeXrplEvidence, normalizeUtxoEvidence, normalizeStellarEvidence, normalizeCosmosEvidence, normalizeEvmEvidence } from '@/lib/vfProofNormalizer';
import { COMMITMENT_DURATIONS, SCALE, CHONX_ACTIVATION_THRESHOLD, SYNTH_ACTIVATION_THRESHOLD, SYNTH_FORGE } from '@/lib/vfRevision6Authority';
import TokenOverview from '@/components/tokens/TokenOverview';
import ForgePanel from '@/components/tokens/ForgePanel';
import IssuancePipeline from '@/components/tokens/IssuancePipeline';
import EpochRewardPanel from '@/components/tokens/EpochRewardPanel';
import { Coins, Zap, Activity, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchAssetPrice, getAssetPricingInfo, computeVerifiedGrossUsdMicro } from '@/lib/vfPriceService';

const ENV_OPTIONS = [
  'Solana', 'XRPL', 'Stellar',
  'Bitcoin', 'Litecoin', 'Dogecoin', 'DigiByte', 'Zcash', 'BitcoinCash',
  'Ethereum', 'BNB', 'Avalanche', 'Polygon', 'Arbitrum', 'Optimism',
];

export default function TokenLayer() {
  const [tokenState, setTokenState] = useState(() => new TokenLayerState());
  const [verifierState, setVerifierState] = useState(() => new VerifierState());
  const [env, setEnv] = useState('Solana');
  const [durationIdx, setDurationIdx] = useState(1); // 7 days
  const [outputToken, setOutputToken] = useState('VCLM');
  const [pipeline, setPipeline] = useState({});
  const [account, setAccount] = useState('0x' + '1'.repeat(40));
  const [livePrices, setLivePrices] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceInfo, setPriceInfo] = useState(null);

  const duration = COMMITMENT_DURATIONS[durationIdx];
  const stats = useMemo(() => tokenState.getStats(), [tokenState]);

  const updateState = () => {
    setTokenState(Object.assign(new TokenLayerState(), tokenState));
    setVerifierState(Object.assign(new VerifierState(), verifierState));
  };

  const runPipeline = async () => {
    const ts = Object.assign(new TokenLayerState(), tokenState);
    const vs = Object.assign(new VerifierState(), verifierState);
    const newPipeline = {};

    // Step 1: Source Lock
    newPipeline.lock = { status: 'done', detail: `${env} · ${duration.label}` };

    // Step 2: Normalize
    const mock = buildMockEvent(env, duration.secs, outputToken);
    const finalityProof = buildFinalityProof(env);
    let normResult;
    if (mock.type === 'solana') normResult = normalizeSolanaEvidence(mock.event, finalityProof);
    else if (mock.type === 'xrpl') normResult = normalizeXrplEvidence(mock.event.escrow, mock.event.payment, finalityProof);
    else if (mock.type === 'utxo') normResult = normalizeUtxoEvidence(env, mock.event, finalityProof);
    else if (mock.type === 'stellar') normResult = normalizeStellarEvidence(mock.event, finalityProof);
    else if (mock.type === 'cosmos') normResult = normalizeCosmosEvidence(mock.event, finalityProof);
    else normResult = normalizeEvmEvidence(env, mock.event, finalityProof);

    if (!normResult.ok) {
      newPipeline.normalize = { status: 'failed', detail: normResult.errors?.join('; ') };
      newPipeline.verify = { status: 'pending' };
      newPipeline.mint = { status: 'pending' };
      newPipeline.forge = { status: 'pending' };
      newPipeline.result = { ok: false, reason: 'Normalization failed' };
      setPipeline(newPipeline);
      return;
    }
    newPipeline.normalize = { status: 'done', detail: '24-field ProofPackage' };

    // Step 3: Verify — fetch live price or use simulation value
    let usd;
    if (livePrices) {
      const assetInfo = getAssetPricingInfo(normResult.package.source_environment_id, normResult.package.canonical_asset_id);
      if (!assetInfo) {
        newPipeline.verify = { status: 'failed', detail: 'No price source mapped for environment' };
        newPipeline.mint = { status: 'pending' };
        newPipeline.forge = { status: 'pending' };
        newPipeline.result = { ok: false, reason: 'Price source unavailable' };
        setPipeline(newPipeline);
        return;
      }
      setPriceLoading(true);
      const priceResult = await fetchAssetPrice(assetInfo);
      setPriceLoading(false);
      if (priceResult.usd == null) {
        // Master Spec: fail rather than fabricate a price
        newPipeline.verify = { status: 'failed', detail: `Price fetch failed: ${priceResult.error || 'no source'}` };
        newPipeline.mint = { status: 'pending' };
        newPipeline.forge = { status: 'pending' };
        newPipeline.result = { ok: false, reason: 'Price unavailable — pipeline blocked per Master Spec (VF-ORC-001)' };
        setPipeline(newPipeline);
        setPriceInfo({ error: priceResult.error || 'no source' });
        return;
      }
      const grossAmount = normResult.package.gross_amount_smallest_units;
      const decimals = normResult.package.asset_precision;
      usd = computeVerifiedGrossUsdMicro(grossAmount, decimals, priceResult.usd, SCALE).toString();
      setPriceInfo({ price: priceResult.usd, source: priceResult.source, asset: assetInfo.symbol });
    } else {
      // VF-COM-003/009: Handshake durations require $0.95–$1.05; standard requires >= $10.00.
      const isHandshake = Number(duration.secs) === 3600;
      usd = (isHandshake ? 1n : 10n) * SCALE; // Simulation: $1.00 handshake, $10.00 standard
      setPriceInfo({ simulation: true, usd: isHandshake ? 1 : 10 });
    }
    const verifyResult = verifyProof(vs, normResult.package, { verifiedGrossUsdMicro: usd, daysSinceLaunch: 0 });
    if (!verifyResult.ok) {
      newPipeline.verify = { status: 'failed', detail: verifyResult.reason };
      newPipeline.mint = { status: 'pending' };
      newPipeline.forge = { status: 'pending' };
      newPipeline.result = { ok: false, reason: verifyResult.reason };
      setPipeline(newPipeline);
      return;
    }
    newPipeline.verify = { status: 'done', detail: '14/14 checks passed' };

    // Sync token state from verifier (cumulative + activation state already includes this issuance)
    ts.syncFromVerifier(vs);

    // Step 4: Mint — skip cumulative update since verifier already updated it via syncFromVerifier
    const mintResult = verifyResult.issuance.token === 'VCLM'
      ? ts.mintVclm(verifyResult.issuance.recipient, BigInt(verifyResult.issuance.amount), { skipCumulativeUpdate: true })
      : ts.mintChonx(verifyResult.issuance.recipient, BigInt(verifyResult.issuance.amount), { skipCumulativeUpdate: true });

    if (!mintResult.ok) {
      newPipeline.mint = { status: 'failed', detail: mintResult.reason };
      newPipeline.forge = { status: 'pending' };
      newPipeline.result = { ok: false, reason: mintResult.reason };
      setPipeline(newPipeline);
      setTokenState(ts);
      setVerifierState(vs);
      return;
    }
    newPipeline.mint = { status: 'done', detail: `${formatTokenAmount(verifyResult.issuance.amount)} ${verifyResult.issuance.token}` };

    // Record RAC credit for epoch distribution (VF-RAC)
    if (verifyResult.racCredit) {
      ts.recordRacCredit(
        verifyResult.racCredit.racIdentity,
        verifyResult.issuance.recipient,
        verifyResult.racCredit.credit,
        verifyResult.racCredit.epoch,
      );
    }

    // Step 5: Forge (optional — only if SYNTH activated)
    if (ts.synthActivated) {
      newPipeline.forge = { status: 'active', detail: 'available' };
    } else {
      newPipeline.forge = { status: 'pending', detail: 'SYNTH not activated' };
    }

    newPipeline.result = {
      ok: true,
      issuance: verifyResult.issuance,
    };

    setPipeline(newPipeline);
    setTokenState(ts);
    setVerifierState(vs);
  };

  const handleForge = (count) => {
    const ts = Object.assign(new TokenLayerState(), tokenState);
    const r = ts.forgeSynth(account, count);
    setTokenState(ts);
    return r;
  };

  const simulateActivation = () => {
    const ts = Object.assign(new TokenLayerState(), tokenState);
    // Mint enough VCLM to activate CHONX
    if (!ts.chonxActivated) {
      ts.mintVclm(account, CHONX_ACTIVATION_THRESHOLD);
    }
    // Mint enough CHONX to activate SYNTH
    if (!ts.synthActivated) {
      ts.mintChonx(account, SYNTH_ACTIVATION_THRESHOLD);
    }
    // Mint forge materials
    ts.mintVclm(account, SYNTH_FORGE.vclm_burn * 10n);
    ts.mintChonx(account, SYNTH_FORGE.chonx_burn * 10n);
    setTokenState(ts);
  };

  const handleDistributeEpoch = (epoch) => {
    const ts = Object.assign(new TokenLayerState(), tokenState);
    const r = ts.distributeEpochRewards(epoch);
    setTokenState(ts);
    return r;
  };

  const reset = () => {
    setTokenState(new TokenLayerState());
    setVerifierState(new VerifierState());
    setPipeline({});
    setPriceInfo(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Coins className="w-7 h-7 text-amber-400" />
                Base Token Layer
              </h1>
              <p className="text-sm text-slate-400 mt-1">VCLM · CHONX · SYNTH — Integrated issuance pipeline (Revision 6)</p>
            </div>
            <div className="flex gap-2">
              <Link to="/stake-layer">
                <Button variant="outline" size="sm" className="border-slate-700 text-slate-300">
                  <Coins className="w-4 h-4 mr-1" /> Stake
                </Button>
              </Link>
              <Link to="/base-verifier">
                <Button variant="outline" size="sm" className="border-slate-700 text-slate-300">
                  <ShieldCheck className="w-4 h-4 mr-1" /> Verifier
                </Button>
              </Link>
              <Link to="/">
                <Button variant="ghost" size="sm" className="text-slate-400">Home</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Provenance Banner */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-xs text-slate-400">
          <Badge className="bg-blue-600 mr-2">Revision 6</Badge>
          <span>VF-TOK-001 (18 decimals) · VF-TOK-002 (CHONX activation: 10M VCLM) · VF-TOK-003 (SYNTH activation: 100M CHONX) · VF-TOK-004 (forge: 1,000 VCLM + 10,000 CHONX → 1 SYNTH) · VF-TOK-009/010 (hard caps) · VF-SUP-015 (cap rejection)</span>
        </div>

        {/* Token Overview */}
        <TokenOverview stats={stats} />

        {/* Issuance Pipeline */}
        <IssuancePipeline pipeline={pipeline} />

        {/* Simulation Controls */}
        <Card className="p-5 bg-slate-900 border-slate-700">
          <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-400" /> Issuance Simulation
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs text-slate-400">Source Environment</Label>
              <Select value={env} onValueChange={setEnv}>
                <SelectTrigger className="bg-slate-800 border-slate-600 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {ENV_OPTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Duration</Label>
              <Select value={String(durationIdx)} onValueChange={(v) => setDurationIdx(Number(v))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600 max-h-60">
                  {COMMITMENT_DURATIONS.map((d, i) => <SelectItem key={i} value={String(i)}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Output Token</Label>
              <Select value={outputToken} onValueChange={setOutputToken}>
                <SelectTrigger className="bg-slate-800 border-slate-600 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="VCLM">VCLM</SelectItem>
                  <SelectItem value="CHONX" disabled={!tokenState.chonxActivated}>CHONX {!tokenState.chonxActivated && '(locked)'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={runPipeline} className="bg-blue-600 hover:bg-blue-700 flex-1">
                <Activity className="w-4 h-4 mr-1" /> Run Pipeline
              </Button>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button onClick={simulateActivation} variant="outline" size="sm" className="border-slate-700 text-slate-300">
              Simulate Full Activation
            </Button>
            <Button onClick={reset} variant="ghost" size="sm" className="text-slate-400">
              Reset State
            </Button>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => setLivePrices(!livePrices)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                livePrices
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-slate-800 border-slate-600 text-slate-400'
              }`}
            >
              {livePrices ? '✓ Live Prices' : 'Simulation Prices'}
            </button>
            {priceLoading && <span className="text-xs text-slate-500 animate-pulse">Fetching price...</span>}
            {priceInfo && !priceInfo.simulation && !priceInfo.error && (
              <span className="text-xs text-slate-400">
                {priceInfo.asset}: ${priceInfo.price?.toFixed(4)} <span className="text-slate-600">[{priceInfo.source}]</span>
              </span>
            )}
            {priceInfo?.simulation && (
              <span className="text-xs text-amber-500">Simulation: $10.00 (not live)</span>
            )}
            {priceInfo?.error && (
              <span className="text-xs text-rose-400">Price fetch failed: {priceInfo.error}</span>
            )}
          </div>
        </Card>

        {/* Forge Panel */}
        <ForgePanel tokenState={tokenState} onForge={handleForge} account={account} />

        {/* Epoch Reward Distribution */}
        <EpochRewardPanel tokenState={tokenState} onDistribute={handleDistributeEpoch} />

        {/* Mint/Forge History */}
        {(tokenState.mintHistory.length > 0 || tokenState.forgeHistory.length > 0) && (
          <Card className="p-5 bg-slate-900 border-slate-700">
            <h3 className="text-lg font-bold text-slate-100 mb-3">History</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {[...tokenState.mintHistory.map((h, i) => ({ ...h, idx: i, type: 'mint' })),
                ...tokenState.forgeHistory.map((h, i) => ({ ...h, idx: i, type: 'forge' }))]
                .sort((a, b) => b.ts - a.ts)
                .map((h) => (
                  <div key={`${h.type}-${h.idx}-${h.ts}`} className="text-xs font-mono text-slate-400 flex justify-between">
                    <span>{h.type === 'mint' ? `Minted ${formatTokenAmount(h.amount)} ${h.token} → ${h.to?.slice(0,10)}...` : `Forged ${h.count} SYNTH (burned ${formatTokenAmount(h.vclmBurn)} VCLM + ${formatTokenAmount(h.chonxBurn)} CHONX)`}</span>
                    <span className="text-slate-600">{new Date(h.ts).toLocaleTimeString()}</span>
                  </div>
                ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}