export interface PlasmaContractConfig {
  adjudicationContract: string
  commitment: string
  payoutContracts: {
    OwnershipPayout: string
    DepositContract: string
  }
}
