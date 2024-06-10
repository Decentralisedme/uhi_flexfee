import { Brevis, ErrCode, ProofRequest, Prover, TransactionData, ReceiptData, Field, StorageData } from 'brevis-sdk-typescript';
import Web3, { Contract, ContractAbi, EventLog } from 'web3';
import { readFileSync } from 'fs';
import { RegisteredSubscription } from 'web3/lib/commonjs/eth.exports';


const rootBrevisDirectory = __dirname.split('/').slice(0, -1).join('/')

const USDC_WETH_V3_ABI = JSON.parse(readFileSync(rootBrevisDirectory + '/ABI/usdcWethV3.json', 'utf-8'));
const BREVIS_REQUEST_ABI = JSON.parse(readFileSync(rootBrevisDirectory + '/ABI/brevisRequest.json', 'utf-8'));

const web3Sepolia = new Web3("https://1rpc.io/sepolia")
const brevisRequestAddr = "0x5fB46FF3565a78bCC83F8394AC72933503b704FA"
const brevisRequestContract = new web3Sepolia.eth.Contract(BREVIS_REQUEST_ABI, brevisRequestAddr)

const SECONDS_IN_MINUTE = 60
const MS_IN_SECOND = 100

var gasPrice, gasLimit;

interface SubmitResponse {
    brevisId: string;
    fee: string;
}

async function getStorageDataAtBlock(chosenBlock: number, contractAddress: string, index: number, web3: Web3<RegisteredSubscription>) {
    const storageVal = await web3.eth.getStorageAt(contractAddress, index, chosenBlock);

    const storageData = new StorageData({
        block_num: chosenBlock,
        address: contractAddress,
        slot: "0x0000000000000000000000000000000000000000000000000000000000000000", //TODO fix this up
        value: storageVal
    })

    return storageData
}

async function getStorageDataPoints(numDataPoints: number, startingBlock: number, contractAddress: string, index: number, web3: Web3<RegisteredSubscription>){
    var dataPoints = []

    var curBlock = startingBlock;

    console.log("hello")

    while (dataPoints.length < numDataPoints) {
        const storageItem = await getStorageDataAtBlock(curBlock, contractAddress, index, web3);
        dataPoints.push(storageItem)
        curBlock --;
    }

    console.log(dataPoints)
    console.log(dataPoints.length)
    return dataPoints;
}

function formatBrevisData(brevisRes: SubmitResponse, refundee: string, callback: string){
    const data = brevisRequestContract.methods.sendRequest(brevisRes.brevisId, refundee, callback).encodeABI();
    return data
}

function getAccount(privKey: string) {
    return web3Sepolia.eth.accounts.privateKeyToAddress(privKey);
}

async function sendTransaction(from: string, to: string, givenData: string, privKey: string){

    var signedTx = await web3Sepolia.eth.accounts.signTransaction(
        {
            from: from,
            to: to,
            value: 0,
            maxFeePerGas: 3000000000,
            maxPriorityFeePerGas: 2000000000,
            data: givenData
        }, privKey);

    var receipt = await web3Sepolia.eth.sendSignedTransaction(signedTx.rawTransaction);

    console.log(receipt);
}


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



async function performRequest(web3: Web3<RegisteredSubscription>, prover: Prover, brevis: Brevis, privateKey: string) {

    const proofReq = new ProofRequest();

    const storageDataList = await getStorageDataPoints(15, 19308799, "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640", 0, web3)

    for (let i = 0; i < storageDataList.length; i++){
        proofReq.addStorage(storageDataList[0], i)
    }

    console.log("going to prove")

    const proofRes = await prover.prove(proofReq);

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

        // const refundee = getAccount(privateKey);
        // const callback = "0xef1B4B164Fd3b7933bfaDb042373560e715Ec5D6";

        // var brevisDataToSend = (formatBrevisData(brevisRes, refundee, callback))
        // console.log(refundee, brevisRequestAddr, brevisDataToSend, privateKey)

        // await sendTransaction(refundee, brevisRequestAddr, brevisDataToSend, privateKey)

        await brevis.wait(brevisRes.brevisId, 11155111);
    } catch (err) {
        console.error(err);
    }
}


async function main(){
    const web3 = new Web3('https://eth.llamarpc.com');
    const prover = new Prover('localhost:33247');
    const brevis = new Brevis('appsdk.brevis.network:11080');

    const minsToSleep = 5

    const privateKey = process.argv[2]
    console.log(privateKey)

    while (true) {
        await performRequest(web3, prover, brevis, privateKey)
        await new Promise(r => setTimeout(r, minsToSleep*SECONDS_IN_MINUTE*MS_IN_SECOND));
    }
}

main()