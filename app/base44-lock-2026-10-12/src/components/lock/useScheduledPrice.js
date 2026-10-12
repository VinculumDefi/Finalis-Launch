import { useEffect, useState } from "react";
import { readMintContext } from "@/lib/lockMint";
export default function useScheduledPrice(provider, isBase, asset) {
  const [state, setState] = useState({ context: null, error: null, loading: false });
  useEffect(() => {
    let active = true;
    if (!provider || !isBase || !asset) { setState({ context: null, error: null, loading: false }); return; }
    setState({ context: null, error: null, loading: true });
    readMintContext(provider, asset).then(context => {
      if (active) setState({ context, error: null, loading: false });
    }).catch(error => {
      if (active) setState({ context: null, error: error.shortMessage || error.message, loading: false });
    });
    return () => { active = false; };
  }, [provider, isBase, asset]);
  return state;
}