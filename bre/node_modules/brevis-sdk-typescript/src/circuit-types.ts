import { ethers } from 'ethers';

export type CustomInput = Record<string, CircuitValue | CircuitValue[]>;

export type CircuitDataType = 'Uint248' | 'Uint521' | 'Int248' | 'Bytes32';

export interface CircuitValue {
    type: CircuitDataType;
    data: string;
}

export function asUint248(input: string): CircuitValue {
    const big = ethers.getBigInt(input);
    return { type: 'Uint248', data: big.toString(10) };
}

export function asUint521(input: string): CircuitValue {
    const big = ethers.getBigInt(input);
    return { type: 'Uint521', data: big.toString(10) };
}

export function asInt248(input: string): CircuitValue {
    const big = ethers.getBigInt(input);
    return { type: 'Int248', data: big.toString(10) };
}

export function asBytes32(input: string): CircuitValue {
    if (!ethers.isHexString(input)) {
        throw new Error(`value ${input} is not bytes32`);
    }
    const bs = ethers.getBytes(input);
    if (bs.length !== 32) {
        throw new Error(`asBytes32 must take bytes of length 32: actual ${bs.length}`);
    }
    return { type: 'Bytes32', data: input };
}
