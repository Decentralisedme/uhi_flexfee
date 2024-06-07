import { Brevis, ErrCode, ProofRequest, Prover, TransactionData, ReceiptData, Field } from 'brevis-sdk-typescript';
import Web3, { Contract, ContractAbi, EventLog } from 'web3';
import { readFileSync } from 'fs';


const rootBrevisDirectory = __dirname.split('/').slice(0, -1).join('/')

const USDC_WETH_V3_ABI = JSON.parse(readFileSync(rootBrevisDirectory + '/ABI/usdcWethV3.json', 'utf-8'));


async function getSwapLogsFromBlock(blockNum: any){

}

async function getSwapLogsFromBlocks(contract: Contract<any>, startBlock: any, endBlock: any) {
    const events = await contract.getPastEvents("allEvents", {
        fromBlock: startBlock,
        toBlock: endBlock
    });
    return events;
}

function convertLogToReceiptData(log: EventLog) {

    // console.log(log.topics[0])
    // typecasting
    const sqrtPriceX96 = log.returnValues.sqrtPriceX96 as BigInt;
    // convert to string
    const sqrtPriceX96Str = sqrtPriceX96.toString();

    var logIndex;

    // match type case of logIndex string or number or BigInt and make it number
    if (typeof log.logIndex === 'string') {
        logIndex = parseInt(log.logIndex);
    } else if (typeof log.logIndex === 'number') {
        logIndex = log.logIndex;
    } else if (typeof log.logIndex === 'bigint') {
        logIndex = Number(log.logIndex);
    } else {
        throw new Error('Invalid logIndex type');
    }

    var bln;

    // match type case of block number string or number or BigInt and make it number
    if (typeof log.blockNumber === 'string') {
        bln = parseInt(log.blockNumber);
    } else if (typeof log.blockNumber === 'number') {
        bln = log.blockNumber;
    } else if (typeof log.blockNumber === 'bigint') {
        bln = Number(log.blockNumber);
    } else {
        throw new Error('Invalid block number type');
    }


    // create receipt data
    const rD = new ReceiptData({
        block_num:  bln,
        tx_hash: log.transactionHash,
        fields: [
            new Field({
                contract: log.address,
                log_index: logIndex,
                event_id: log.topics[0],
                is_topic: false,
                field_index: 2,
                value: sqrtPriceX96Str,
            }),               
        ],
    })

    return rD;
}

async function getPreviousLogs(creationTX: any, contractAddress: any, abi: any, web3Provider: Web3, minLogNumber: number) {
    const contractInstance = new web3Provider.eth.Contract(abi, contractAddress);

    // some rpcs limit how many blocks you can explore
    const maxBlockDiff = 100;

    // avoid some reorg or dropped txs (re-check this issue)
    const endBlock = 19308800 //Number(await web3Provider.eth.getBlockNumber()) - 30000;

    // get the start block of this pool
    const receipt = await web3Provider.eth.getTransactionReceipt(creationTX);
    const startBlock = Number(receipt.blockNumber); // Use receipt.blockNumber for dynamic start block

    var logList = [];
    
    var receiptDataList = [];

    var curStart = endBlock - maxBlockDiff;

    var breakLogCollectionFlag = false;

    // get logs until we have enough or run out of blocks
    while (logList.length < minLogNumber) {

        if (curStart <= startBlock) {
            breakLogCollectionFlag = true;
            curStart = startBlock;
        }

        var logs = await getSwapLogsFromBlocks(contractInstance, curStart, endBlock);
        
        curStart = curStart - maxBlockDiff;
        for (var i = 0; i < logs.length; i++) {
            var log = logs[i] as EventLog
            if (log.topics[0] === '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67') {
                logList.push(log);
            }
        }

        if (breakLogCollectionFlag) {
            break;
        }
    }

    // convert logs
    for (var i = 0; i < logList.length; i++) {
        var log = logList[i]
        var r = convertLogToReceiptData(log as EventLog)
        receiptDataList.push(r);
    }

    return receiptDataList;
}

async function main() {

    const web3 = new Web3('https://eth.llamarpc.com');
    const prover = new Prover('localhost:33247');
    const brevis = new Brevis('appsdk.brevis.network:11080');

    // const tempWeb3Addr = new Web3("https://eth.llamarpc.com")
    // getPreviousLogs("0x125e0b641d4a4b08806bf52c0c6757648c9963bcda8681e4f996f09e00d4c2cc", "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640", ABI, tempWeb3Addr)

    // var receiptList = await getPreviousLogs("0x125e0b641d4a4b08806bf52c0c6757648c9963bcda8681e4f996f09e00d4c2cc", "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640", USDC_WETH_V3_ABI, web3, 1500)

    // console.log("got all receipts")

    const proofReq = new ProofRequest();

    // // work backwards on receiptList

    // for (var i = receiptList.length - 1; i >= 0 ; i--) {
    //     var indexPos = (receiptList.length - i) - 1;
    //     console.log("indexPos", indexPos)
    //     // push
    //     proofReq.addReceipt(receiptList[i], indexPos);

    //     console.log(JSON.stringify(receiptList[i], null, 2))

    //     console.log("added receipt")

    //     console.log("num receipts", proofReq.getReceipts().length)

    //     if (proofReq.getReceipts().length >= 2) {
    //         break;
    //     }
    // }

    proofReq.addReceipt(
        new ReceiptData({
            block_num: 19308799,
            tx_hash: '0xfe8c6f82c3da2c3ccf65623f52a9e0d4d5af825e7ae3c32c013988efb403949b',
            fields: [
                new Field({
                    contract: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
                    log_index: 153,
                    event_id: '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
                    is_topic: false,
                    field_index: 2,
                    value: '1412045384449495693860528555476309',
                }),               
            ],
        }), 0
    );       

    proofReq.addReceipt(
        new ReceiptData({
            block_num: 19308798,
            tx_hash: '0xf5ff0afb6acc8124eb00231cf93b4c378d013a9b94adb0b1b1b75c4a2fd7f45f',
            fields: [
                new Field({
                    contract: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
                    log_index: 236,
                    event_id: '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
                    is_topic: false,
                    field_index: 2,
                    value: '1422062131426387928667329689726225',
                }),               
            ],
        }), 1
    ); 
    
    proofReq.addReceipt(
        new ReceiptData({
            block_num: 19308798,
            tx_hash: '0xf5ff0afb6acc8124eb00231cf93b4c378d013a9b94adb0b1b1b75c4a2fd7f45f',
            fields: [
                new Field({
                    contract: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
                    log_index: 236,
                    event_id: '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
                    is_topic: false,
                    field_index: 2,
                    value: '1442062131426387928667329689726225',
                }),               
            ],
        }), 2
    ); 

    console.log("going to prove")

    const proofRes = await prover.prove(proofReq);

    // console.log(proofRes)

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

    console.log("\n\ngoing to go submit\n\n")

    try {

        const brevisRes = await brevis.submit(proofReq, proofRes, 1, 11155111);
        console.log('brevis res', brevisRes);

        await brevis.wait(brevisRes.brevisId, 11155111);
    } catch (err) {
        console.error(err);
    }
}

main();

