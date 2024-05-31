import { Brevis, ErrCode, ProofRequest, Prover, TransactionData, ReceiptData, Field } from 'brevis-sdk-typescript';
import Web3, { ContractAbi } from 'web3';

async function getPreviousLogs(contractAddress: String, abi: ContractAbi, web3Provider: Web3) {
    const contractInstance = new web3Provider.eth.Contract(abi, )

}

async function main() {

    const web3 = new Web3('https://eth.llamarpc.com');
    const prover = new Prover('localhost:33247');
    const brevis = new Brevis('appsdk.brevis.network:11080');

    const proofReq = new ProofRequest();
    // proofReq.addTransaction(
    //     new TransactionData({
    //         hash: '0x6dc75e61220cc775aafa17796c20e49ac08030020fce710e3e546aa4e003454c',
    //         chain_id: 1,
    //         block_num: 19073244,
    //         nonce: 0,
    //         gas_tip_cap_or_gas_price: '90000000000',
    //         gas_fee_cap: '90000000000',
    //         gas_limit: 21000,
    //         from: '0x6c2843bA78Feb261798be1AAC579d1A4aE2C64b4',
    //         to: '0x2F19E5C3C66C44E6405D4c200fE064ECe9bC253a',
    //         value: '22329290000000000',
    //     }),
    // );


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
                    value: '24999999',
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
        }), 0
    );

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
        }), 1
    );
    


    const proofRes = await prover.prove(proofReq);

    console.log(proofRes)

    // error handling
    if (proofRes.has_err) {
        const err = proofRes.err;
        switch (err.code) {
            case ErrCode.ERROR_INVALID_INPUT:
                console.error('invalid receipt/storage/transaction input:', err.msg);
                break;

            case ErrCode.ERROR_INVALID_CUSTOM_INPUT:
                console.error('invalid custom input:', err.msg);
                break;

            case ErrCode.ERROR_FAILED_TO_PROVE:
                console.error('failed to prove:', err.msg);
                break;
        }
        return;
    }
    console.log('proof', proofRes.proof);

    try {
        const brevisRes = await brevis.submit(proofReq, proofRes, 1, 11155111);
        console.log('brevis res', brevisRes);

        await brevis.wait(brevisRes.brevisId, 11155111);
    } catch (err) {
        console.error(err);
    }
}

main();
