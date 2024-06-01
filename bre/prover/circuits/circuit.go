package volatility

import (
	"github.com/brevis-network/brevis-sdk/sdk"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
)

// This example circuit analyzes the swap events between USDC and ETH/WETH for a user.

// AppCircuit is a developer-defined circuit that performs checks and data analysis
// over the input Receipt. The proof of this circuit is to be verified in Brevis
// in conjunction with various data validity checks. A final proof is then
// submitted on-chain and expose the output to the developer's contract.
// The Brevis side ensures that all receipts
type AppCircuit struct {
	// You can define your own custom circuit inputs here, but note that they cannot
	// have the `gnark:",public"` tag.
	UserAddr sdk.Uint248
}

// Your guest circuit must implement the sdk.AppCircuit interface
var _ sdk.AppCircuit = &AppCircuit{}

// sdk.ParseXXX APIs are used to convert Go/EVM data types into circuit types.
// Note that you can only use these outside of circuit (making constant circuit
// variables)

var EventIdSwap = sdk.ParseEventID(
	hexutil.MustDecode("0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"))
var EventIdTransfer = sdk.ParseEventID(
	hexutil.MustDecode("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"))

var RouterAddress = sdk.ConstUint248(
	common.HexToAddress("0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B"))
var UsdcPoolAddress = sdk.ConstUint248(
	common.HexToAddress("0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640"))

func (c *AppCircuit) Allocate() (maxReceipts, maxSlots, maxTransactions int) {
	// Allocating regions for different source data. Here, we are allocating 5 data
	// slots for "receipt" data, and none for other data types. Please note that if
	// you allocate it this way and compile your circuit, the circuit structure will
	// always have 5 processing "chips" for receipts and none for others. It means
	// your compiled circuit will always be only able to process up to 5 receipts and
	// cannot process other types unless you change the allocations and recompile.
	return 100, 0, 0
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
			// 2. Check that the contract address of each log field is the expected contract
			u248.IsEqual(l.Fields[0].Contract, UsdcPoolAddress),
			// 3. Check the EventID of the fields are as expected
			u248.IsEqual(l.Fields[0].EventID, EventIdSwap),
			// 4. Check the index of the fields are as expected
			u248.IsZero(l.Fields[0].IsTopic),                     // `sqrtPriceX96` is not a topic field
			u248.IsEqual(l.Fields[0].Index, sdk.ConstUint248(2)), // `sqrtPriceX96` is the 2nd data field in the `Swap` event
		)
		return assertionPassed
	})

	blockNums := sdk.Map(receipts, func(cur sdk.Receipt) sdk.Uint248 { return cur.BlockNum })

	volumes := sdk.Map(receipts, func(cur sdk.Receipt) sdk.Uint248 {
		valInt := api.ToInt248(cur.Fields[0].Value)
		return api.Int248.ABS(valInt)
	})

	// Find out the minimum block number. This enables us to find out over what range
	// the user has a specific trading volume
	minBlockNum := sdk.Min(blockNums)

	// Sum up the volume of each trade
	sumVolume := sdk.Sum(volumes)

	// Output will be reflected in app contract's callback in the form of
	// _circuitOutput: abi.encodePacked(uint256,uint248,uint64,address)
	// this variable Salt isn't used anywhere. it's just here to demonstrate how to output bytes32/uint256
	api.OutputUint(248, sumVolume)
	api.OutputUint(64, minBlockNum)

	return nil
}
