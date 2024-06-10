package volatility

import (
	"math/big"
	"testing"

	"github.com/brevis-network/brevis-sdk/sdk"
	"github.com/brevis-network/brevis-sdk/test"
	"github.com/ethereum/go-ethereum/common"
)

// In this example, we want to analyze the `Swap` events emitted by Uniswap's
// UniversalRouter contract. Let's declare the fields we want to use:

func TestCircuit(t *testing.T) {
	app, err := sdk.NewBrevisApp()
	check(err)

	usdcPool := common.HexToAddress("0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640")
	swapEvent := common.HexToHash("0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67")

	var num, _ = new(big.Int).SetString("1286977918479647748315046269489039", 10)
	sqrtPriceX96_1 := common.BytesToHash(big.NewInt(num.Int64()).Bytes())

	// Adding a receipt query into the querier
	app.AddReceipt(sdk.ReceiptData{
		BlockNum: big.NewInt(19996326),
		TxHash:   common.HexToHash("0xb79c3ff11f9f402439915669be5d01f767e167c30ac24a09f66c69c0ed6cdaac"),
		Fields: [sdk.NumMaxLogFields]sdk.LogFieldData{
			{Contract: usdcPool, LogIndex: 12, EventID: swapEvent, IsTopic: false, FieldIndex: 2, Value: sqrtPriceX96_1}, // field: USDCPool.Swap.sqrtPriceX96
		},
	})

	num, _ = new(big.Int).SetString("1286977918479647748315046269489039", 10)
	sqrtPriceX96_2 := common.BytesToHash(big.NewInt(num.Int64()).Bytes())

	app.AddReceipt(sdk.ReceiptData{
		BlockNum: big.NewInt(19996331),
		TxHash:   common.HexToHash("0xae1e58570ff0d9fcf450814a9e467905c131cd7c654c2ef758dd0bc1d4267027"),
		Fields: [sdk.NumMaxLogFields]sdk.LogFieldData{
			{Contract: usdcPool, LogIndex: 3, EventID: swapEvent, IsTopic: false, FieldIndex: 2, Value: sqrtPriceX96_2}, // field: USDCPool.Swap.sqrtPriceX96
		},
	})

	num, _ = new(big.Int).SetString("1286980030786437829223832265541310", 10)
	sqrtPriceX96_3 := common.BytesToHash(big.NewInt(num.Int64()).Bytes())

	app.AddReceipt(sdk.ReceiptData{
		BlockNum: big.NewInt(19996331),
		TxHash:   common.HexToHash("0x4da85fde8c012f8fd6847e86e7114bc3c65731f315ee20abbf6c3b2f798439a7"),
		Fields: [sdk.NumMaxLogFields]sdk.LogFieldData{
			{Contract: usdcPool, LogIndex: 3, EventID: swapEvent, IsTopic: false, FieldIndex: 2, Value: sqrtPriceX96_3}, // field: USDCPool.Swap.sqrtPriceX96
		},
	})

	// Initialize our AppCircuit and prepare the circuit assignment
	appCircuit := &AppCircuit{}
	appCircuitAssignment := &AppCircuit{}

	// Execute the added queries and package the query results into circuit inputs
	in, err := app.BuildCircuitInput(appCircuit)
	check(err)

	///////////////////////////////////////////////////////////////////////////////
	// Testing
	///////////////////////////////////////////////////////////////////////////////

	// Use the test package to check if the circuit can be solved using the given
	// assignment
	test.ProverSucceeded(t, appCircuit, appCircuitAssignment, in)
}

func check(err error) {
	if err != nil {
		panic(err)
	}
}
