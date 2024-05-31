import { credentials } from '@grpc/grpc-js';
import {
    GatewayClient,
    GetQueryStatusRequest,
    PrepareQueryRequest,
    QueryStatus,
    SubmitAppCircuitProofRequest,
    type GetQueryStatusResponse,
    type PrepareQueryResponse,
    type SubmitAppCircuitProofResponse,
} from '../proto/brevis/gateway';
import { LogExtractInfo, ReceiptInfo, StorageQueryInfo, TransactionInfo } from '../proto/brevis/types';
import { AppCircuitInfo } from '../proto/common/circuit_data';
import { type ProveResponse } from '../proto/sdk/prover';
import { type ReceiptData, type StorageData, type TransactionData } from './../proto/sdk/types';
import { type ProofRequest } from './request';

export interface SubmitResponse {
    // the id of the request. use this id when calling BrevisRequest.sendRequest
    // note that brevisId is not the same as the proof_id you get from calling your prover service.
    brevisId: string;

    // amount of the fee to pay to BrevisRequest, in wei
    fee: string;
}

export interface FinalResult {
    // the request id
    brevisId: string;

    // the tx where the final proof is submitted on-chain and the app contract is called
    tx?: string;

    // whether the final proof submission tx succeeded
    success: boolean;
}

export class Brevis {
    private readonly client: GatewayClient;

    public constructor(url: string) {
        const cred = credentials.createSsl();
        this.client = new GatewayClient(url, cred);
    }

    public async submit(
        request: ProofRequest,
        proof: ProveResponse,
        srcChainId: number,
        dstChainId: number,
    ): Promise<SubmitResponse> {
        const res1 = await this._prepareQuery(request, proof.circuit_info, srcChainId, dstChainId);
        if (res1.has_err) {
            throw new Error(`failed to submit ${res1.err.msg}`);
        }
        console.log('brevis request id', res1.query_hash);
        const res2 = await this._submitProof(res1.query_hash, dstChainId, proof.proof);
        if (res2.has_err) {
            throw new Error(`failed to submit ${res2.err.msg}`);
        }

        return {
            brevisId: res1.query_hash,
            fee: res1.fee,
        };
    }

    public async prepareQuery(
        request: ProofRequest,
        circuitInfo: AppCircuitInfo,
        srcChainId: number,
        dstChainId: number,
    ): Promise<PrepareQueryResponse> {
        return this._prepareQuery(request, circuitInfo, srcChainId, dstChainId);
    }

    public async submitProof(id: string, dstChainId: number, proof: string) {
        await this._submitProof(id, dstChainId, proof);
    }

    // wait untill the final proof is submitted on-chain and the app contract is called
    public async wait(id: string, dstChainId: number): Promise<FinalResult> {
        const interval = 10000;
        const count = 50;

        for (let i = 0; i < count; i++) {
            const res = await this.getQueryStatus(id, dstChainId);
            switch (res.status) {
                case QueryStatus.QS_COMPLETE:
                    console.log(`request ${id} success, tx ${res.tx_hash}`);
                    return { brevisId: id, tx: res.tx_hash, success: true };
                case QueryStatus.QS_FAILED:
                    console.log(`request ${id} failed`);
                    return { brevisId: id, success: false };
                case QueryStatus.QS_TO_BE_PAID:
                    console.log(
                        `query ${id} waiting for payment. call BrevisRequest.sendRequest to initiate the payment`,
                    );
                    break;
                default:
                    console.log(`query ${id} waiting for final tx`);
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        console.log(`query ${id} timed out after ${interval * count} seconds`);
        return { brevisId: id, success: false };
    }

    private async _prepareQuery(
        request: ProofRequest,
        circuitInfo: AppCircuitInfo,
        srcChainId: number,
        dstChainId: number,
    ): Promise<PrepareQueryResponse> {
        const req = new PrepareQueryRequest({
            chain_id: srcChainId,
            target_chain_id: dstChainId,
            receipt_infos: request.getReceipts().map(r => this.buildReceiptInfo(r.data)),
            storage_query_infos: request.getStorages().map(s => this.buildStorageInfo(s.data)),
            transaction_infos: request.getTransactions().map(t => this.buildTransactionInfo(t.data)),
            use_app_circuit_info: true,
            app_circuit_info: circuitInfo,
        });
        const res = await this.client.PrepareQuery(req);
        return res;
    }

    private async _submitProof(id: string, dstChainId: number, proof: string): Promise<SubmitAppCircuitProofResponse> {
        const req = new SubmitAppCircuitProofRequest({
            query_hash: id,
            target_chain_id: dstChainId,
            proof,
        });
        const res = await this.client.SubmitAppCircuitProof(req);
        if (res.has_err) {
            throw new Error(`error while submitting proof to brevis: ${res.err.msg}`);
        }
        return res;
    }

    private async getQueryStatus(id: string, dstChainId: number): Promise<GetQueryStatusResponse> {
        const req = new GetQueryStatusRequest({ query_hash: id, target_chain_id: dstChainId });
        const res = await this.client.GetQueryStatus(req);
        if (res.has_err) {
            throw new Error(`error while waiting for final result: ${res.err.msg}`);
        }
        return res;
    }

    private buildReceiptInfo(data: ReceiptData): ReceiptInfo {
        return new ReceiptInfo({
            blk_num: data.block_num,
            transaction_hash: data.tx_hash,
            log_extract_infos: data.fields.map(f => {
                return new LogExtractInfo({
                    contract_address: f.contract,
                    log_index: f.log_index,
                    log_topic0: f.event_id,
                    value_from_topic: f.is_topic,
                    value_index: f.field_index,
                    value: f.value,
                });
            }),
        });
    }

    private buildStorageInfo(data: StorageData): StorageQueryInfo {
        return new StorageQueryInfo({
            account: data.address,
            storage_keys: [data.slot],
            blk_num: data.block_num,
        });
    }

    private buildTransactionInfo(data: TransactionData): TransactionInfo {
        return new TransactionInfo({ transaction_hash: data.hash });
    }
}
