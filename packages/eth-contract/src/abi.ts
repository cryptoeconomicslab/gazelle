export default {
  RANGE: 'tuple(uint256, uint256)',
  STATE_UPDATE:
    'tuple(address, tuple(uint256, uint256), uint256, tuple(address, bytes[]), bytes32)',
  INCLUSION_PROOF:
    'tuple(tuple(address, uint256, tuple(bytes32, address)[]), tuple(uint256, uint256, tuple(bytes32, uint256)[]))',
  PROPERTY: 'tuple(address, bytes[])'
}
