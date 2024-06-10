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

	app.AddStorage(sdk.StorageData{
		BlockNum: big.NewInt(19996326),
		Address:  usdcPool,
		Slot:     common.HexToHash("0x0"),
		Value:    common.HexToHash("0x00010002d302d3006802f57f0000000000003f73f1eef341535bdd27ba150f8f"),
	})

	app.AddStorage(sdk.StorageData{
		BlockNum: big.NewInt(19996331),
		Address:  usdcPool,
		Slot:     common.HexToHash("0x0"),
		Value:    common.HexToHash("0x00010002d302d3006802f57f0000000000003f73f8c2359ddd1b7c9f5c6dc6be"),
	})

	app.AddStorage(sdk.StorageData{
		BlockNum: big.NewInt(19996333),
		Address:  usdcPool,
		Slot:     common.HexToHash("0x0"),
		Value:    common.HexToHash("0x00010002d302d3006802f57f0000000000003f73f8c2359ddd1b7c9f5c6dc6be"),
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
