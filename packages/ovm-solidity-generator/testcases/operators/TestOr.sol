pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import { DataTypes as types } from "ovm-contracts/DataTypes.sol";
import "ovm-contracts/UniversalAdjudicationContract.sol";
import "ovm-contracts/Utils.sol";
import "ovm-contracts/AtomicPredicate.sol";
import "ovm-contracts/CompiledPredicate.sol";


/**
 * OrTest(a,b)
 */
contract OrTest {
    bytes public OrTestO = bytes("OrTestO");

    UniversalAdjudicationContract adjudicationContract;
    Utils utils;
    address IsLessThan;
    address Equal;
    address IsValidSignature;
    address IsContained;
    address HasIntersection;
    address VerifyInclusion;
    address IsSameAmount;
    address IsConcatenatedWith;
    address IsValidHash;
    address IsStored;
    address notAddress;
    address andAddress;
    address forAllSuchThatAddress;
    address public payoutContractAddress;
    bool isInitialized = false;

    constructor(
        address _adjudicationContractAddress,
        address _utilsAddress,
        address _notAddress,
        address _andAddress,
        address _forAllSuchThatAddress
    ) public {
        adjudicationContract = UniversalAdjudicationContract(_adjudicationContractAddress);
        utils = Utils(_utilsAddress);
        notAddress = _notAddress;
        andAddress = _andAddress;
        forAllSuchThatAddress = _forAllSuchThatAddress;
    }

    function setPredicateAddresses(
        address _isLessThan,
        address _equal,
        address _isValidSignature,
        address _isContained,
        address _hasIntersection,
        address _verifyInclusion,
        address _isSameAmount,
        address _isConcatenatedWith,
        address _isValidHash,
        address _isStored,
        address _payoutContractAddress
    ) public {
        require(!isInitialized, "isInitialized must be false");
        IsLessThan = _isLessThan;
        Equal = _equal;
        IsValidSignature = _isValidSignature;
        IsContained = _isContained;
        HasIntersection = _hasIntersection;
        VerifyInclusion = _verifyInclusion;
        IsSameAmount = _isSameAmount;
        IsConcatenatedWith = _isConcatenatedWith;
        IsValidHash = _isValidHash;
        IsStored = _isStored;
        payoutContractAddress = _payoutContractAddress;
        isInitialized = true;
    }
    
    /**
     * @dev Validates a child node of the property in game tree.
     */
    function isValidChallenge(
        bytes[] memory _inputs,
        bytes[] memory _challengeInput,
        types.Property memory _challenge
    ) public view returns (bool) {
        require(
            keccak256(abi.encode(getChild(_inputs, _challengeInput))) == keccak256(abi.encode(_challenge)),
            "_challenge must be valud child of game tree"
        );
        return true;
    }
    
    function getChild(
        bytes[] memory inputs,
        bytes[] memory challengeInput
    ) private view returns (types.Property memory) {
        if(!utils.isLabel(inputs[0])) {
            return getChildOrTestO(inputs, challengeInput);
        }
        bytes32 input0 = keccak256(utils.getInputValue(inputs[0]));
        bytes[] memory subInputs = utils.subArray(inputs, 1, inputs.length);
        if(input0 == keccak256(OrTestO)) {
            return getChildOrTestO(subInputs, challengeInput);
        }
    }


    /**
     * @dev check the property is true
     */
    function decide(bytes[] memory _inputs, bytes[] memory _witness) public view returns(bool) {
        if(!utils.isLabel(_inputs[0])) {
            return decideOrTestO(_inputs, _witness);
        }
        bytes32 input0 = keccak256(utils.getInputValue(_inputs[0]));
        bytes[] memory subInputs = utils.subArray(_inputs, 1, _inputs.length);
        if(input0 == keccak256(OrTestO)) {
            return decideOrTestO(subInputs, _witness);
        }
        return false;
    }


    function decideWithWitness(
        bytes[] memory _inputs,
        bytes[] memory _witness
    ) public view returns (bool) {
      return decide(_inputs, _witness);
    }

    function decideTrue(bytes[] memory _inputs, bytes[] memory _witness) public {
        require(decide(_inputs, _witness), "must be true");
        types.Property memory property = types.Property({
            predicateAddress: address(this),
            inputs: _inputs
        });
        adjudicationContract.setPredicateDecision(utils.getPropertyId(property), true);
    }


    /**
     * Gets child of OrTestO(OrTestO,a,b).
     */
    function getChildOrTestO(bytes[] memory _inputs, bytes[] memory challengeInputs) private view returns (types.Property memory) {

        bytes[] memory andInputs = new bytes[](2);
        bytes[] memory notInputs0 = new bytes[](1);
        bytes[] memory childInputsOf0 = new bytes[](1);
        childInputsOf0[0] = _inputs[0];

        notInputs0[0] = abi.encode(types.Property({
            predicateAddress: Foo,
            inputs: childInputsOf0
        }));

        andInputs[0] = abi.encode(types.Property({
            predicateAddress: notAddress,
            inputs: notInputs0
        }));
        bytes[] memory notInputs1 = new bytes[](1);
        bytes[] memory childInputsOf1 = new bytes[](1);
        childInputsOf1[0] = _inputs[1];

        notInputs1[0] = abi.encode(types.Property({
            predicateAddress: Bar,
            inputs: childInputsOf1
        }));

        andInputs[1] = abi.encode(types.Property({
            predicateAddress: notAddress,
            inputs: notInputs1
        }));
        return types.Property({
            predicateAddress: andAddress,
            inputs: andInputs
        });
    }
    /**
     * Decides OrTestO(OrTestO,a,b).
     */
    function decideOrTestO(bytes[] memory _inputs, bytes[] memory _witness) public view returns (bool) {
        // check Or
        uint256 orIndex = abi.decode(_witness[0], (uint256));
        if(orIndex == 0) {

            bytes[] memory childInputs0 = new bytes[](1);
            childInputs0[0] = _inputs[0];
            require(
                AtomicPredicate(Foo).decide(childInputs0),
                "Foo must be true"
            );

        }
        if(orIndex == 1) {

            bytes[] memory childInputs1 = new bytes[](1);
            childInputs1[0] = _inputs[1];
            require(
                AtomicPredicate(Bar).decide(childInputs1),
                "Bar must be true"
            );

        }
        return true;
    }

    function packTypes() public pure returns (bytes memory) {
        return abi.encodePacked("bytes a");
    }

    function packValues(bytes[] memory _inputs) public pure returns (bytes memory) {
        bytes memory a = _inputs[0];
        return abi.encodePacked(a);
    }
}

