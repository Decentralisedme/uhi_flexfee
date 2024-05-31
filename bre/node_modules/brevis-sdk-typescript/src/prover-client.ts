import { credentials } from '@grpc/grpc-js';
import {
    GetProofRequest,
    GetProofResponse,
    ProveAsyncResponse,
    ProverClient,
    type ProveResponse,
} from '../proto/sdk/prover';
import { type ProofRequest } from './request';

export class Prover {
    private readonly client: ProverClient;

    public constructor(url: string) {
        const cred = credentials.createInsecure();
        this.client = new ProverClient(url, cred);
    }

    public async prove(request: ProofRequest): Promise<ProveResponse> {
        const res = await this.client.Prove(request.build());
        return res;
    }

    public async proveAsync(request: ProofRequest): Promise<ProveAsyncResponse> {
        const res = await this.client.ProveAsync(request.build());
        return res;
    }

    public async getProof(id: string): Promise<GetProofResponse> {
        const res = await this.client.GetProof(new GetProofRequest({ proof_id: id }));
        return res;
    }
}
