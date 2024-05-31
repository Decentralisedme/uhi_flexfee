package age

import (
	"github.com/brevis-network/brevis-sdk/sdk"
)

type AppCircuit struct{}

func (c *AppCircuit) Allocate() (maxReceipts, maxStorage, maxTransactions int) {
	// Our app is only ever going to use one storage data at a time so
	// we can simply limit the max number of data for storage to 1 and
	// 0 for all others
	return 0, 0, 1
}

func (c *AppCircuit) Define(api *sdk.CircuitAPI, in sdk.DataInput) error {
	// receipts := sdk.NewDataStream(api, in.Receipts)

	// prices := sdk.Map(receipts, func (receipt sdk.Receipt) sdk.Uint248 {
	// 	return api.ToUint248(receipt.Fields[0].Value)
	// })

	// mean := sdk.Mean(prices)

	// fmt.Println("mean prices")
	// fmt.Println(mean)

	txs := sdk.NewDataStream(api, in.Transactions)

	tx := sdk.GetUnderlying(txs, 0)
	// This is our main check logic
	api.Uint248.AssertIsEqual(tx.Nonce, sdk.ConstUint248(0))

	// Output variables can be later accessed in our app contract
	api.OutputAddress(tx.From)
	api.OutputUint(64, tx.BlockNum)

	return nil
}
