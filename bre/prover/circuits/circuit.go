package volatility

import (
	"fmt"

	"github.com/brevis-network/brevis-sdk/sdk"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
)

// This example circuit analyzes the swap events between USDC and ETH/WETH for a user.

type AppCircuit struct {
}

// Your guest circuit must implement the sdk.AppCircuit interface
var _ sdk.AppCircuit = &AppCircuit{}

// sdk.ParseXXX APIs are used to convert Go/EVM data types into circuit types.
// Note that you can only use these outside of circuit (making constant circuit
// variables)

var EventIdSwap = sdk.ParseEventID(
	hexutil.MustDecode("0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"))

var RouterAddress = sdk.ConstUint248(
	common.HexToAddress("0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B"))
var UsdcPoolAddress = sdk.ConstUint248(
	common.HexToAddress("0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640"))

var twoPower96 = sdk.ConstUint248("79228162514264337593543950336")

func (c *AppCircuit) Allocate() (maxReceipts, maxSlots, maxTransactions int) {
	// Allocating regions for different source data. Here, we are allocating 5 data
	// slots for "receipt" data, and none for other data types. Please note that if
	// you allocate it this way and compile your circuit, the circuit structure will
	// always have 5 processing "chips" for receipts and none for others. It means
	// your compiled circuit will always be only able to process up to 5 receipts and
	// cannot process other types unless you change the allocations and recompile.
	return 3, 0, 0
}

func (c *AppCircuit) Define(api *sdk.CircuitAPI, in sdk.DataInput) error {
	u248 := api.Uint248

	// In order to use the nice methods such as .Map() and .Reduce(), raw data needs
	// to be wrapped in a DataStream. You could also use the raw data directly if you
	// are familiar with writing gnark circuits.
	receipts := sdk.NewDataStream(api, in.Receipts)

	// Main application logic: Run the assert function on each receipt. The function
	// should return 1 if assertion successes and 0 otherwise
	sdk.AssertEach(receipts, func(l sdk.Receipt) sdk.Uint248 {
		assertionPassed := u248.And(
			// Check that the contract address of each log field is the expected contract
			u248.IsEqual(l.Fields[0].Contract, UsdcPoolAddress),
			// Check the EventID of the fields are as expected
			u248.IsEqual(l.Fields[0].EventID, EventIdSwap),
			// Check the index of the fields are as expected
			u248.IsZero(l.Fields[0].IsTopic),                     // `sqrtPriceX96` is not a topic field
			u248.IsEqual(l.Fields[0].Index, sdk.ConstUint248(2)), // `sqrtPriceX96` is the index 2 data field in the `Swap` event
		)
		return assertionPassed
	})

	sqrtPriceX96s := sdk.Map(receipts, func(receipt sdk.Receipt) sdk.Uint248 {
		return api.ToUint248(receipt.Fields[0].Value)
	})

	// convert sqrtPriceX96 to price
	// price = (sqrtPriceX96 / (2 ^ 96)) ^ 2
	prices := sdk.Map(sqrtPriceX96s, func(sqrtPriceX96 sdk.Uint248) sdk.Uint248 {
		i, _ := u248.Div(sqrtPriceX96, twoPower96)
		return u248.Mul(i, i)
	})

	mean := sdk.Mean(prices)

	sqrd_variance := sdk.Map(prices, func(price sdk.Uint248) sdk.Uint248 {
		variance := u248.Sub(price, mean)
		return u248.Mul(variance, variance)
	})

	sum_variance := sdk.Mean(sqrd_variance)

	mean_var, _ := u248.Div(sum_variance, sdk.ConstUint248(len(in.Receipts.Toggles)-1))
	vol := u248.Sqrt(mean_var)

	fmt.Println("vol:")
	fmt.Println(vol)

	// Output will be reflected in app contract's callback in the form of
	// _circuitOutput: abi.encodePacked(uint256,uint248,uint64,address)
	// this variable Salt isn't used anywhere. it's just here to demonstrate how to output bytes32/uint256
	api.OutputUint(248, mean)

	return nil
}
