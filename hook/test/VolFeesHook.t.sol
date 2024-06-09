// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {Deployers} from "v4-core/test/utils/Deployers.sol";
import {MockERC20} from "solmate/test/utils/mocks/MockERC20.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {SwapFeeLibrary} from "../src/SwapFeeLibrary.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "./utils/HookMiner.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {VolFeesHook} from "../src/VolFeesHook.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";

contract TestVolFeesHook is Test, Deployers {
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;

    address internal constant BREVIS_PROOF = 0x4446e0f8417C1db113899929A8F3cEe8e0DcBCDb;

    VolFeesHook hook;

    function setUp() public {
        // Deploy v4-core
        Deployers.deployFreshManagerAndRouters();
        // Deploy, mint tokens, and approve all periphery contracts for two tokens
        //(currency0, currency1) = deployMintAndApprove2Currencies();
        Deployers.deployMintAndApprove2Currencies();

        // Deploy our hook with the proper flags
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG);
        (, bytes32 salt) = HookMiner.find(address(this), flags, type(VolFeesHook).creationCode, abi.encode(manager));

        // DEPLOY HOOK
        hook = new VolFeesHook{salt: salt}(manager, BREVIS_PROOF);

        // Initialize a pool
        // Usually in 4th position you will have value of the fees (ie 3000)
        // We need to set it to 0x80000 by calling flag-it anble the Dynamic Fees
        (key,) = initPool(currency0, currency1, hook, SwapFeeLibrary.DYNAMIC_FEE_FLAG, SQRT_PRICE_1_1, ZERO_BYTES);

        // Add some liquidity
        // modifyLiquidityRouter.modifyLiquidity(
        //     key,
        //     IPoolManager.ModifyLiquidityParams({tickLower: -60, tickUpper: 60, liquidityDelta: 100 ether}),
        //     ZERO_BYTES
        // );
        modifyLiquidityRouter.modifyLiquidity(
            key, IPoolManager.ModifyLiquidityParams(-60, 60, 100 ether, 0), ZERO_BYTES
        );
    }

    function test_feeCalculation() public {
        int256 amountSpecified = 10 ether;
        uint24 fee = hook.getFee(amountSpecified);
        uint256 vol = hook.getVol();
        console.log("Test1 Vol value: ", vol);
        console.log("Test1 Fee value: ", fee);
        assertNotEq(fee, 0);
    }

    function test_volUpdate_feeCalculation() public {
        uint256 s_volatility = hook.volUpdate(80 * 10 ** 16);
        int256 amountSpecified = 10 ether;
        uint24 fee = hook.getFee(amountSpecified);
        uint256 vol = hook.getVol();
        console.log("Test2 Vol value: ", vol);
        console.log("Test2 fee value: ", fee);
        //console.log("Test2 vol: ", s_volatility);
        assertNotEq(fee, 0);
    }

    function test_low_vol_low_amt() public {
        // Arrange
        uint256 balance1Before = currency1.balanceOfSelf();
        bool zeroForOne = true;
        int256 amountSpecified = 10_000;

        // Act
        uint24 fee = hook.getFee(amountSpecified);
        BalanceDelta swapDelta = Deployers.swap(key, zeroForOne, amountSpecified, ZERO_BYTES);

        console.logInt(swapDelta.amount0());
        console.logInt(swapDelta.amount1());

        // Assert
        // assertEq(fee, 8398819); // 0.1544%

        assertEq(swapDelta.amount0(), -10_311);

        uint256 token1Output = currency1.balanceOfSelf() - balance1Before;
        assertEq(int256(swapDelta.amount1()), int256(token1Output));

        assertEq(int256(token1Output), amountSpecified);
    }
}
