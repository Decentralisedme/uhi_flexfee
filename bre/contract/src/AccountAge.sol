// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";

import "../brevis/BrevisApp.sol";
import "../brevis/IBrevisProof.sol";

contract AccountAge is BrevisApp, Ownable {
    event AccountAgeAttested(address account, uint64 blockNum);

    bytes32 public vkHash;

    constructor(address brevisProof) BrevisApp(IBrevisProof(brevisProof)) Ownable(msg.sender) {}

    // BrevisQuery contract will call our callback once Brevis backend submits the proof.
    function handleProofResult(
        bytes32 /*_requestId*/,
        bytes32 _vkHash,
        bytes calldata _circuitOutput
    ) internal override {
        // We need to check if the verifying key that Brevis used to verify the proof generated by our circuit is indeed
        // our designated verifying key. This proves that the _circuitOutput is authentic
        require(vkHash == _vkHash, "invalid vk");

        (address txFrom, uint64 blockNum) = decodeOutput(_circuitOutput);

        emit AccountAgeAttested(txFrom, blockNum);
    }

    // In app circuit we have:
    // api.OutputAddress(tx.From)
    // api.OutputUint(64, tx.BlockNum)
    function decodeOutput(bytes calldata o) internal pure returns (address, uint64) {
        address txFrom = address(bytes20(o[0:20])); // txFrom was output as an address
        uint64 blockNum = uint64(bytes8(o[20:28])); // blockNum was output as a uint64 (8 bytes)
        return (txFrom, blockNum);
    }

    function setVkHash(bytes32 _vkHash) external onlyOwner {
        vkHash = _vkHash;
    }
}