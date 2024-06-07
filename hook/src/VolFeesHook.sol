// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {console} from "forge-std/console.sol";
import {BaseHook} from "v4-periphery/BaseHook.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {SwapFeeLibrary} from "v4-core/src/libraries/SwapFeeLibrary.sol";

contract VolFeesHook is BaseHook {
    using SwapFeeLibrary for uint24;

    //mapping(PoolId => uint256 count) public beforeSwapCount;
    /////////
    // ERRORs
    /////////

    error MustUseDynamicFee();

    /////////////////
    // State Variables
    ///////////////
    uint24 public constant BASE_FEE = 3000; // 0.3%
    uint256 public constant PRICE = 3800 * 10 ** 18;
    uint256 private s_volatility = 20 * 10 ** 16;

    // Initial BaseHook Parent Contract
    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}

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
        // Calculate how much fee shold be charged:
        uint24 fee = calculateFee(abs(swapParams.amountSpecified), s_volatility, PRICE);
        // update here the fee charged in the pool
        // poolManager.updateDynamicSwapFee(key, fee);
        // return this.beforeSwap.selector;
        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee);
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
}
