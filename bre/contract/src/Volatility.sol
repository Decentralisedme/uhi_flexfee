// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./brevis/BrevisApp.sol";
import "./brevis/IBrevisProof.sol";

/**
    This is an example contract for handling the callback from the Brevis service with the volaitility data
    the actualy contract used by the FlexFee project is in the "hook" folder
 */
contract Volatility is BrevisApp, Ownable {
    event VolatilityUpdated(uint256 volatility);

    bytes32 public vkHash;

    uint256 public volatility;

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

        volatility = decodeOutput(_circuitOutput);

        emit VolatilityUpdated(volatility);
    }

    // In app circuit we have:
    // api.OutputUint(248, vol)
    function decodeOutput(bytes calldata o) internal pure returns (uint256) {
        uint248 vol = uint248(bytes31(o[0:31])); // vol is output as a uint248 (31 bytes)   
        return uint256(vol);
    }

    function setVkHash(bytes32 _vkHash) external onlyOwner {
        vkHash = _vkHash;
    }
}