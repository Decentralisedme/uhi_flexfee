package main

import (
	"flag"
	"fmt"
	"os"
	age "pancake-prover/circuits"

	"github.com/brevis-network/brevis-sdk/sdk/prover"
)

var (
	port = flag.Uint("port", 33247, "the port to start the service at")
	host = flag.String("host", "localhost", "the host to start the service on")
)

// example usage: prover -service="totalfee" -port=33248 -host="localhost"
func main() {
	flag.Parse()

	proverService, err := prover.NewService(&age.AppCircuit{}, prover.ServiceConfig{
		SetupDir: "$HOME/circuitOut",
		SrsDir:   "$HOME/kzgsrs",
	})
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}

	proverService.Serve(*host, *port)
	// if err != nil {
	//   fmt.Println(err)
	//   os.Exit(1)
	// }
}
