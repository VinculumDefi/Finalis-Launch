#!/bin/bash
# Fetches forge-std at the pinned tag (not committed) and checks Foundry.
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.foundry/bin:$PATH"
command -v forge >/dev/null || { curl -L https://foundry.paradigm.xyz | bash; "$HOME/.foundry/bin/foundryup"; }
[ -d lib/forge-std ] || git clone -q --depth 1 --branch v1.9.7 https://github.com/foundry-rs/forge-std lib/forge-std
forge --version
