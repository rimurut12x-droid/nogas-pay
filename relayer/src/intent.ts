import { encodeAbiParameters, keccak256, type Address, type Hex } from "viem";

export type Intent = {
  token: Address;
  from: Address;
  to: Address;
  amount: bigint;
  fee: bigint;
  action: number; // 0 send, 1 refuel
  minOkbOut: bigint;
  validBefore: bigint;
  salt: Hex;
};

export const intentAbi = {
  type: "tuple",
  components: [
    { name: "token", type: "address" },
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "fee", type: "uint256" },
    { name: "action", type: "uint8" },
    { name: "minOkbOut", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "salt", type: "bytes32" },
  ],
} as const;

/** Same as Bensin.intentNonce: keccak256(abi.encode(chainid, bensin, intent)). */
export function intentNonce(it: Intent, chainId: bigint, bensin: Address): Hex {
  return keccak256(
    encodeAbiParameters([{ type: "uint256" }, { type: "address" }, intentAbi], [chainId, bensin, it]),
  );
}

/** EIP-3009 ReceiveWithAuthorization typed-data message the user signs. */
export const receiveWithAuthorizationTypes = {
  ReceiveWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;
