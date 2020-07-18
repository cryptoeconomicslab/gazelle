export interface EthContractConfig {
  adjudicationContract: string
  commitmentContract: string
  PlasmaETH: string
  payoutContracts: {
    OwnershipPayout: string
    DepositContract: string
  }
  checkpointDisputeContract: string
}
