package volatility

import (
	"fmt"

	"github.com/brevis-network/brevis-sdk/sdk"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	// "strconv"
)

// This example circuit analyzes the swap events between USDC and ETH/WETH for a user.

type AppCircuit struct {
	// UserAddr sdk.Uint248
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
	return 0, 500, 0
}

func toBoolean(val sdk.Uint248, api *sdk.CircuitAPI) bool {
	bin := api.Uint248.ToBinary(val, 1).Values()
	var x = bin[0]
	var sss = fmt.Sprintf("%v", x)

	if sss == "0" {
		return false
	} else {
		return true
	}

}

func absDiff(api *sdk.CircuitAPI, a, b sdk.Uint248) sdk.Uint248 {
	u248 := api.Uint248

	aLessThanB := u248.IsLessThan(a, b)
	cond := toBoolean(aLessThanB, api)

	if cond {
		return u248.Sub(b, a)
	}
	return u248.Sub(a, b)
}

func (c *AppCircuit) Define(api *sdk.CircuitAPI, in sdk.DataInput) error {
	u248 := api.Uint248

	storageSlots := sdk.NewDataStream(api, in.StorageSlots)

	sqrtPriceX96s := sdk.Map(storageSlots, func(storageSlot sdk.StorageSlot) sdk.Uint248 {
		// 248 - 160 = 96
		storageVal := api.ToUint248(storageSlot.Value)

		binary := api.Uint248.ToBinary(storageVal, 248)
		
		// bit-mask and get the first 160 bits (little-endian system)
		sqrtPricePart := binary[0:159]

		resultingSqrtPrice := api.Uint248.FromBinary(sqrtPricePart...)

		bytess := api.Bytes32.FromBinary(sqrtPricePart...)

		fmt.Println(resultingSqrtPrice, bytess)

		return resultingSqrtPrice
	})

	prices := sqrtPriceX96s

	fmt.Println("prices")
	prices.Show()

	count := len(in.StorageSlots.Toggles)

	shiftedList := make([]sdk.Uint248, 0)

	lastRemovedPrice := sdk.RangeUnderlying(prices, 0, count-1)

	fmt.Println("lastRemovedPrice")
	lastRemovedPrice.Show()

	headRemovedPrice := sdk.RangeUnderlying(prices, 1, count)

	fmt.Println("headRemovedPrice")
	headRemovedPrice.Show()

	// using just to append to the list
	sdk.Map(headRemovedPrice, func(price sdk.Uint248) sdk.Uint248 {
		shiftedList = append(shiftedList, price)
		return price
	})

	fmt.Println("shiftedList")
	fmt.Println(shiftedList)

	fmt.Println("============================ start")
	returnsSquared := sdk.ZipMap2(lastRemovedPrice, shiftedList, func(a, b sdk.Uint248) sdk.Uint248 {

		tenTo10 := sdk.ConstUint248("10000000000")
		tenTo20 := sdk.ConstUint248("100000000000000000000")
		tenTo40 := sdk.ConstUint248("10000000000000000000000000000000000000000")

		fixed_ratio, _ := u248.Div(u248.Mul(tenTo10, a), b)
		
		fixed_ratioSquared := u248.Mul(fixed_ratio, fixed_ratio)
		fixed_ratioQuad := u248.Mul(fixed_ratioSquared, fixed_ratioSquared)

		aVal := fixed_ratioQuad

		bVal := u248.Mul(u248.Mul(sdk.ConstUint248(2), tenTo20), fixed_ratioSquared)

		cVal := tenTo40

		result := u248.Sub(u248.Add(aVal, cVal), bVal)

		return result

	})
	fmt.Println("============================ end")

	fmt.Println("returnsSquared:")
	returnsSquared.Show()

	varia, _ := u248.Div((sdk.Sum(returnsSquared)), sdk.ConstUint248(count))

	outputToDo := u248.Sqrt(u248.Mul(varia, sdk.ConstUint248(2613400)))

	fmt.Println("outputVol:")
	fmt.Println(outputToDo)

	api.OutputUint(248, outputToDo)

	return nil
}
