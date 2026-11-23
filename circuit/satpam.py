"""Satpam: Bensin's sponsorship policy as a TapeOut circuit (NAND-only, combinational).

Input bits (LSB first): 0-1 amountBucket, 2-3 dailyBucket, 4 isRefuel, 5 firstTime.
Output bits:            0 allow, 1-2 feeTier.

Rules:
  allow = amount != 3 and daily != 3 and not (refuel and amount != 0)
  tier  = 0 if firstTime and amount == 0 and not refuel   (first small send is free)
          2 if amount == 2 and not refuel                  (large send)
          1 otherwise
"""
from __future__ import annotations

import os
import subprocess
import sys

N_IN = 6
N_OUT = 3


def satpam_spec(x: int) -> int:
    amt, day = x & 3, (x >> 2) & 3
    refuel, first = (x >> 4) & 1, (x >> 5) & 1
    allow = int(amt != 3 and day != 3 and not (refuel and amt != 0))
    if first and amt == 0 and not refuel:
        tier = 0
    elif amt == 2 and not refuel:
        tier = 2
    else:
        tier = 1
    return allow | (tier << 1)


class _Builder:
    def __init__(self, n_in: int):
        self.next = 2 + n_in
        self.out = bytearray()

    def nand(self, a: int, b: int) -> int:
        self.out += bytes([0]) + a.to_bytes(3, "big") + b.to_bytes(3, "big")
        s = self.next
        self.next += 1
        return s

    def inv(self, a: int) -> int:
        return self.nand(a, a)

    def and_(self, a: int, b: int) -> int:
        return self.inv(self.nand(a, b))


def build_netlist() -> bytes:
    g = _Builder(N_IN)
    a0, a1, d0, d1, r, f = range(2, 8)
    na0, na1, nr = g.inv(a0), g.inv(a1), g.inv(r)

    amt3_n = g.nand(a0, a1)                      # NOT (amount == 3)
    day3_n = g.nand(d0, d1)                      # NOT (daily == 3)
    amt_nz = g.nand(na0, na1)                    # amount != 0
    badref_n = g.nand(r, amt_nz)                 # NOT (refuel and amount != 0)
    allow_n = g.nand(g.and_(amt3_n, day3_n), badref_n)

    free = g.and_(g.and_(f, na0), g.and_(na1, nr))
    large = g.and_(g.and_(a1, na0), nr)          # amount == 2 and not refuel
    large_n = g.inv(large)
    tier0_n = g.nand(g.inv(free), large_n)       # NOT (tier == 1)

    # The last three produced signals are the outputs, in order (TAP-02 §4 step 4).
    g.inv(allow_n)
    g.inv(tier0_n)
    g.inv(large_n)
    return bytes(g.out)


def main() -> None:
    nl = build_netlist()
    hexnl = "0x" + nl.hex()
    try:
        keccak = subprocess.run(["cast", "keccak", hexnl], capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        keccak = "unavailable (install foundry cast)"
    print(f"netlist={hexnl}")
    print(f"keccak={keccak}")
    print(f"nIn={N_IN} nOut={N_OUT} gates={len(nl) // 7}")


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(__file__))
    main()
