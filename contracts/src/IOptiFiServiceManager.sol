// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {Reclaim} from "./Reclaim/Reclaim.sol";

interface IOptiFiServiceManager {
    event NewOptiTaskCreated(uint32 indexed taskIndex, OptiTask task);

    event OptiTaskResponded(uint32 indexed taskIndex, OptiTask task, address operator, bytes signature);

    event Debug(bytes32 storedHash, bytes32 suppliedHash);

    struct OptiTask{
        address accountAddress;
        string stakingAddress;
        uint32 taskCreatedBlock;
    }

    function latestTaskNum() external view returns (uint32);

    function allTaskHashes(
        uint32 taskIndex
    ) external view returns (bytes32);

    function allTaskResponses(
        address operator,
        uint32 taskIndex
    ) external view returns (bytes memory);

    function taskAgent(
        string memory taskName
    ) external returns (OptiTask memory);

    function respondToApproveTask(
        OptiTask calldata task,
        uint32 referenceTaskIndex,
        bytes calldata signature,
        Reclaim.Proof memory proof
    ) external;
}
