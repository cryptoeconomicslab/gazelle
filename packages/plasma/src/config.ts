export interface PlasmaContractConfig {
  adjudicationContract: string
  disputeManager: string
  checkpointDispute: string
  exitDispute: string
  commitment: string
  payoutContracts: {
    OwnershipPayout: string
    DepositContract: string
  }
}
