import { describe, it } from 'mocha';
import { asBytes32, asInt248, asUint248, asUint521, type CustomInput } from './circuit-types';

describe('custom input marshalling', () => {
    const basic: CustomInput = {
        u248Var: asUint248('0'),
        u521Var: asUint521('1'),
        i248Var: asInt248('-2'),
        b32Var: asBytes32('0x3333333333333333333333333333333333333333333333333333333333333333'),
    };
    const array: CustomInput = {
        ...basic,
        u248Arr: [asUint248('1'), asUint248('2'), asUint248('3')],
        u521Arr: [asUint521('11'), asUint521('22'), asUint521('33')],
        i248Arr: [asInt248('111'), asInt248('-222'), asInt248('333')],
        b32Arr: [
            asBytes32('0x1111111111111111111111111111111111111111111111111111111111111111'),
            asBytes32('0x2222222222222222222222222222222222222222222222222222222222222222'),
        ],
    };
    it('marshals correctly', () => {
        console.log(JSON.stringify(array, null, 4));
    });
});
