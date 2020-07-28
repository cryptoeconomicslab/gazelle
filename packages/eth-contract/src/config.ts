export interface EthContractConfig {
  adjudicationContract: string
  commitment: string
  PlasmaETH: string
  payoutContracts: {
    OwnershipPayout: string
    DepositContract: string
  }
}
