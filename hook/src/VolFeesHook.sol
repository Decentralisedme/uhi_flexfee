// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/console.sol";
import {BaseHook} from "v4-periphery/BaseHook.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {SwapFeeLibrary} from "./SwapFeeLibrary.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./brevis/BrevisApp.sol";
import "./brevis/IBrevisProof.sol";

contract VolFeesHook is BaseHook, BrevisApp, Ownable {
    using SwapFeeLibrary for uint24;

    event VolatilityUpdated(uint256 volatility);

    bytes32 public vkHash;

    uint256 public volatility;

    //mapping(PoolId => uint256 count) public beforeSwapCount;
    /////////
    // ERRORs
    /////////

    error MustUseDynamicFee();

    /////////////////
    // State Variables
    ///////////////
    uint24 public constant BASE_FEE = 3000; // 0.3%
    uint24 public constant HOOK_COMMISSION = 100; // 0.01%

    uint256 public constant PRICE = 3800 * 10 ** 18;
    uint256 private s_volatility = 20 * 10 ** 16;

    // Initial BaseHook Parent Contract
    constructor(IPoolManager _poolManager, address brevisProof)
        BaseHook(_poolManager)
        BrevisApp(IBrevisProof(brevisProof))
        Ownable(msg.sender)
    {}

    ///////////
    //FUNCTIONS
    ///////////

    // Permissions: Required override function for BaseHook to let the PoolManager know which hooks are implemented
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // - DYNAMIC_FEE_FLAG = 0x800000
    // Check if the pool is enabled for dynamic fee
    function beforeInitialize(address, PoolKey calldata key, uint160, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        // isDynamicFee: in Hooks  >> from SwapFeeLibrary>> need to set to value 0x800000
        if (!key.fee.isDynamicFee()) revert MustUseDynamicFee();

        return this.beforeInitialize.selector;
    }

    function beforeSwap(address, PoolKey calldata key, IPoolManager.SwapParams calldata swapParams, bytes calldata)
        external
        override
        poolManagerOnly
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        //takeCommission(key, swapParams);

        // Calculate how much fee shold be charged:
        uint24 fee = calculateFee(abs(swapParams.amountSpecified), s_volatility, PRICE);
        // update here the fee charged in the pool
        // poolManager.updateDynamicSwapFee(key, fee);
        // return this.beforeSwap.selector;

        fee = 30000; // hard-code 30% for testing

        fee = fee | LPFeeLibrary.OVERRIDE_FEE_FLAG; // we need to apply override flag

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee);
    }

    /// POC taking commissions to cover Brevis costs
    function takeCommission(PoolKey calldata key, IPoolManager.SwapParams calldata swapParams) internal {
        uint256 tokenAmount =
            swapParams.amountSpecified < 0 ? uint256(-swapParams.amountSpecified) : uint256(swapParams.amountSpecified);

        uint256 commissionAmt = Math.mulDiv(tokenAmount, HOOK_COMMISSION, 10000);

        // determine inbound token based on 0->1 or 1->0 swap
        Currency inbound = swapParams.zeroForOne ? key.currency0 : key.currency1;

        // take the inbound token from the PoolManager, debt is paid by the swapper via the swap router
        // (inbound token is added to hook's reserves)
        poolManager.take(inbound, address(this), commissionAmt);
    }

    ///////////////////
    // Helper Functions
    ///////////////////

    // Calculate Fee we will charge
    function calculateFee(uint256 volume, uint256 volatility, uint256 price) internal pure returns (uint24) {
        uint256 scaled_volume = volume / 150;
        uint256 longterm_eth_volatility = 60;
        uint256 scaled_vol = volatility / longterm_eth_volatility;
        uint256 constant_factor = 2;
        uint256 fee_per_lot = BASE_FEE + (constant_factor * scaled_volume * scaled_vol ** 2);
        return uint24((fee_per_lot / price / 1e10));
    }

    function abs(int256 x) private pure returns (uint256) {
        if (x >= 0) {
            return uint256(x);
        }
        return uint256(-x);
    }

    // Get Fee
    function getFee(int256 amnt) external view returns (uint24) {
        return calculateFee(abs(amnt), s_volatility, PRICE);
    }

    // Get Vol
    function getVol() public view returns (uint256) {
        return s_volatility;
    }

    // Update Volatility with brevis value
    function volUpdate(uint256 brevisVol) external returns (uint256) {
        s_volatility = brevisVol;
    }

    ///////////////////
    // Brevis Functions
    ///////////////////

    // BrevisQuery contract will call our callback once Brevis backend submits the proof.
    function handleProofResult(bytes32, /*_requestId*/ bytes32 _vkHash, bytes calldata _circuitOutput)
        internal
        override
    {
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
