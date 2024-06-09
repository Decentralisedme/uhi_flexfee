// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "Solidity-RLP/RLPReader.sol";

library Brevis {
    uint256 constant NumField = 5; // supports at most 5 fields per receipt log

    struct ReceiptInfo {
        uint64 blkNum;
        uint64 receiptIndex; // ReceiptIndex in the block
        LogInfo[NumField] logs;
    }

    struct LogInfo {
        LogExtraInfo logExtraInfo;
        uint64 logIndex; // LogIndex of the field
        bytes32 value;
    }

    struct LogExtraInfo {
        uint8 valueFromTopic;
        uint64 valueIndex; // index of the fields in topic or data
        address contractAddress;
        bytes32 logTopic0;
    }

    struct StorageInfo {
        bytes32 blockHash;
        address account;
        bytes32 slot;
        bytes32 slotValue;
        uint64 blockNumber;
    }

    struct TransactionInfo {
        bytes32 leafHash;
        bytes32 blockHash;
        uint64 blockNumber;
        uint64 blockTime;
        bytes leafRlpPrefix;
    }

    struct ExtractInfos {
        bytes32 smtRoot;
        ReceiptInfo[] receipts;
        StorageInfo[] stores;
        TransactionInfo[] txs;
    }

    // retrieved from proofData, to align the logs with circuit...
    struct ProofData {
        bytes32 commitHash;
        uint256 length; // for contract computing proof only
        bytes32 vkHash;
        bytes32 appCommitHash; // zk-program computing circuit commit hash
        bytes32 appVkHash; // zk-program computing circuit Verify Key hash
        bytes32 smtRoot; // for zk-program computing proof only
    }
}

library Tx {
    using RLPReader for bytes;
    using RLPReader for uint256;
    using RLPReader for RLPReader.RLPItem;

    struct TxInfo {
        uint64 chainId;
        uint64 nonce;
        uint256 gasTipCap;
        uint256 gasFeeCap;
        uint256 gas;
        address to;
        uint256 value;
        bytes data;
        address from; // calculate from V R S
    }

    function recover(bytes32 message, bytes32 r, bytes32 s, uint8 v) internal pure returns (address) {
        if (v < 27) {
            v += 27;
        }
        return ecrecover(message, v, r, s);
    }
}
