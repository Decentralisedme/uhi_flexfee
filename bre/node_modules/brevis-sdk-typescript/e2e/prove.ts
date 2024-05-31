import { ErrCode } from '../proto/sdk/prover';
import { Field, ReceiptData, StorageData, TransactionData } from '../proto/sdk/types';
import { Brevis } from '../src/brevis-client';
import { asBytes32, asInt248, asUint248, asUint521 } from '../src/circuit-types';
import { Prover } from '../src/prover-client';
import { ProofRequest } from '../src/request';

async function main() {
    const prover = new Prover('localhost:33247');
    const brevis = new Brevis('appsdk.brevis.network:11080');

    const proofReq = new ProofRequest();
    proofReq.addReceipt(
        new ReceiptData({
            block_num: 18064070,
            tx_hash: '0x53b37ec7975d217295f4bdadf8043b261fc49dccc16da9b9fc8b9530845a5794',
            fields: [
                new Field({
                    contract: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
                    log_index: 3,
                    event_id: '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
                    is_topic: false,
                    field_index: 0,
                    value: '724999999',
                }),
                new Field({
                    contract: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
                    log_index: 3,
                    event_id: '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
                    is_topic: true,
                    field_index: 2,
                    value: '0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B',
                }),
                new Field({
                    contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                    log_index: 2,
                    event_id: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
                    is_topic: true,
                    field_index: 1,
                    value: '0xaefB31e9EEee2822f4C1cBC13B70948b0B5C0b3c',
                }),
            ],
        }),
    );
    proofReq.addStorage(
        new StorageData({
            block_num: 18233760,
            address: '0x5427FEFA711Eff984124bFBB1AB6fbf5E3DA1820',
            slot: '0x0000000000000000000000000000000000000000000000000000000000000000',
            value: '0xf380166f8490f24af32bf47d1aa217fba62b6575',
        }),
    );
    proofReq.addTransaction(
        new TransactionData({
            hash: '0x6dc75e61220cc775aafa17796c20e49ac08030020fce710e3e546aa4e003454c',
            chain_id: 1,
            block_num: 19073244,
            nonce: 0,
            gas_tip_cap_or_gas_price: '90000000000',
            gas_fee_cap: '90000000000',
            gas_limit: 21000,
            from: '0x6c2843bA78Feb261798be1AAC579d1A4aE2C64b4',
            to: '0x2F19E5C3C66C44E6405D4c200fE064ECe9bC253a',
            value: '22329290000000000',
        }),
    );
    proofReq.setCustomInput({
        u248Var: asUint248('0'),
        u521Var: asUint521('1'),
        i248Var: asInt248('-2'),
        b32Var: asBytes32('0x3333333333333333333333333333333333333333333333333333333333333333'),
        u248Arr: [asUint248('1'), asUint248('2'), asUint248('3')],
        u521Arr: [asUint521('11'), asUint521('22'), asUint521('33')],
        i248Arr: [asInt248('111'), asInt248('-222'), asInt248('333')],
        b32Arr: [
            asBytes32('0x1111111111111111111111111111111111111111111111111111111111111111'),
            asBytes32('0x2222222222222222222222222222222222222222222222222222222222222222'),
        ],
    });

    const proofRes = await prover.prove(proofReq);
    // error handling
    if (proofRes.has_err) {
        const err = proofRes.err;
        switch (err.code) {
            case ErrCode.ERROR_INVALID_INPUT:
                console.error('invalid receipt/storage/transaction input:', err.msg);
                // handle invalid data input...
                break;

            case ErrCode.ERROR_INVALID_CUSTOM_INPUT:
                console.error('invalid custom input:', err.msg);
                // handle invalid custom input assignment...
                break;

            case ErrCode.ERROR_FAILED_TO_PROVE:
                console.error('failed to prove:', err.msg);
                // handle failed to prove case...
                break;
        }
        return;
    }
    console.log('proof', proofRes.proof);

    try {
        const brevisRes = await brevis.submit(proofReq, proofRes, 1, 11155111);
        console.log('brevis res', brevisRes);

        brevis.wait(brevisRes.brevisId, 11155111);
    } catch (err) {
        console.error(err);
    }
}

main();
