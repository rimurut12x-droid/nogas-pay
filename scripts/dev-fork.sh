#!/usr/bin/env bash
# Local X Layer fork for development: anvil + Bensin deployed by an impersonated, BEM-funded account.
# Prints BENSIN address. Nothing here touches mainnet.
set -euo pipefail
cd "$(dirname "$0")/../contracts"
A=http://127.0.0.1:8545
DEPLOYER=0x000000000000000000000000000000000000bEEF
BEM=0x60e62Efa9405d6873C5deaBD4E6CC91c25363952
if ! cast chain-id --rpc-url $A >/dev/null 2>&1; then
  anvil --fork-url https://rpc.xlayer.tech --chain-id 196 --auto-impersonate --silent &
  for i in $(seq 1 30); do cast chain-id --rpc-url $A >/dev/null 2>&1 && break; sleep 1; done
fi
cast rpc anvil_setBalance $DEPLOYER 0x56BC75E2D63100000 --rpc-url $A >/dev/null
cast rpc anvil_setStorageAt $BEM "$(cast to-uint256 48792789944997011646187957336880487181889014336332485623466005660168911526225)" "$(cast to-uint256 100000000000)" --rpc-url $A >/dev/null
TREASURY=${TREASURY:-0x70997970C51812dc3A010C7d01b50e0d17dc79C8} forge script script/Deploy.s.sol \
  --rpc-url $A --unlocked --sender $DEPLOYER --broadcast 2>&1 | grep -E "processor|circuitId|bensin|Error"
