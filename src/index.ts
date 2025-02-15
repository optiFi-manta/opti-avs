import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { ReclaimClient } from "@reclaimprotocol/zk-fetch";
import { Reclaim } from "@reclaimprotocol/js-sdk";

const fs = require('fs');
const path = require('path');
dotenv.config();

// Check if the process.env object is empty
if (!Object.keys(process.env).length) {
    throw new Error("process.env object is empty");
}

// Setup env variables
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
/// TODO: Hack
let chainId = 3441006;

const avsDeploymentData = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../contracts/deployments/optifi/${chainId}.json`), 'utf8'));
// Load core deployment data
const coreDeploymentData = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../contracts/deployments/core/${chainId}.json`), 'utf8'));


const delegationManagerAddress = coreDeploymentData.addresses.delegation; // todo: reminder to fix the naming of this contract in the deployment file, change to delegationManager
const avsDirectoryAddress = coreDeploymentData.addresses.avsDirectory;
const optiFiServiceManagerAddress = avsDeploymentData.addresses.optiFiServiceManager;
const ecdsaStakeRegistryAddress = avsDeploymentData.addresses.stakeRegistry;


// Load ABIs
const delegationManagerABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/IDelegationManager.json'), 'utf8'));
const ecdsaRegistryABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/ECDSAStakeRegistry.json'), 'utf8'));
const optiFiServiceManagerABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/OptiFiServiceManager.json'), 'utf8'));
const avsDirectoryABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/IAVSDirectory.json'), 'utf8'));


// Initialize contract objects from ABIs
const delegationManager = new ethers.Contract(delegationManagerAddress, delegationManagerABI, wallet);
const optiFiServiceManager = new ethers.Contract(optiFiServiceManagerAddress, optiFiServiceManagerABI, wallet);
const ecdsaRegistryContract = new ethers.Contract(ecdsaStakeRegistryAddress, ecdsaRegistryABI, wallet);
const avsDirectory = new ethers.Contract(avsDirectoryAddress, avsDirectoryABI, wallet);

const reclaimClient = new ReclaimClient(
    process.env.APP_ID!,
    process.env.APP_SECRET!
  );


const getZkFetchProof = async (idProtocol: string) => {
    try {
        const proof =  await reclaimClient.zkFetch(
          `https://opti-backend.vercel.app/staking/${idProtocol}`,
          {
            method: "GET",
          },
          {
            responseMatches: [
              {
                type: "regex",
                value:
                  '"addressStaking":\\s*"(?<stakingAddress>0x[a-fA-F0-9]{40})"',
              },
            ],
          }
        );
        // Handle proof generation failure
        if (!proof) {
          console.error("Failed to generate proof.");
          throw new Error("Failed to generate proof.");
        }
        // Verify proof
        const isValid = await Reclaim.verifySignedProof(proof);
        if (!isValid) {
          console.error("Proof is invalid.");
          throw new Error("Proof is invalid.");
        }

        // Transform proof for on-chain purposes
        const proofData = await Reclaim.transformForOnchain(proof);
        console.log(proofData);
    
        return {proofData: proofData, stakingAddress: idProtocol};

    } catch (error) {
        console.error('Error generating access token:', error);
        throw error;
    }
};const signAndRespondToTask = async (taskIndex: number, taskCreatedBlock: number, stakingAddress: any, taskaccountAddress: any, taskApprovedProof: object) => {
    const message = `Hello, this is a signed message from the OptiFi Service Manager.`;
    const messageHash = ethers.solidityPackedKeccak256(["string"], [message]);
    const messageBytes = ethers.getBytes(messageHash);
    const signature = await wallet.signMessage(messageBytes);

    console.log(`Signing and responding to task ${taskIndex}`);

    const operators = [await wallet.getAddress()];
    const signatures = [signature];
    const signedTask = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address[]", "bytes[]", "uint32"],
        [operators, signatures, ethers.toBigInt(await provider.getBlockNumber()-1)]
    );

    console.log("Task parameters:", {
        accountAddress: taskaccountAddress,
        stakingAddress: stakingAddress,
        taskCreatedBlock: taskCreatedBlock
    });
    
    const tx = await optiFiServiceManager.respondToApproveTask(
        { accountAddress: taskaccountAddress, stakingAddress: stakingAddress, taskCreatedBlock: taskCreatedBlock }, //task
        taskIndex,
        signedTask,
        taskApprovedProof
    );
    await tx.wait();
    console.log(`Successfuly Approved proof`);
    console.log(`Transaction Hash : `, tx.hash!);
};

const registerOperator = async () => {
    console.log("registering operator")
    // Registers as an Operator in EigenLayer.
    try {
        const tx1 = await delegationManager.registerAsOperator({
            __deprecated_earningsReceiver: await wallet.address,
            delegationApprover: "0x0000000000000000000000000000000000000000",
            stakerOptOutWindowBlocks: 0
        }, "");
        await tx1.wait();
        console.log("Operator registered to Core EigenLayer contracts");
    } catch (error) {
        console.error("Error in registering as operator:", error);
    }
    
    const salt = ethers.hexlify(ethers.randomBytes(32));
    const expiry = Math.floor(Date.now() / 1000) + 3600; // Example expiry, 1 hour from now

    // Define the output structure
    let operatorSignatureWithSaltAndExpiry = {
        signature: "",
        salt: salt,
        expiry: expiry
    };

    // Calculate the digest hash, which is a unique value representing the operator, avs, unique value (salt) and expiration date.
    const operatorDigestHash = await avsDirectory.calculateOperatorAVSRegistrationDigestHash(
        wallet.address, 
        await optiFiServiceManager.getAddress(), 
        salt, 
        expiry
    );
    console.log(operatorDigestHash);
    
    // Sign the digest hash with the operator's private key
    console.log("Signing digest hash with operator's private key");
    const operatorSigningKey = new ethers.SigningKey(process.env.PRIVATE_KEY!);
    const operatorSignedDigestHash = operatorSigningKey.sign(operatorDigestHash);

    // Encode the signature in the required format
    operatorSignatureWithSaltAndExpiry.signature = ethers.Signature.from(operatorSignedDigestHash).serialized;

    console.log("Registering Operator to AVS Registry contract");

    
    // Register Operator to AVS
    const tx2 = await ecdsaRegistryContract.registerOperatorWithSignature(
        operatorSignatureWithSaltAndExpiry,
        wallet.address
    );
    await tx2.wait();
    console.log("Operator registered on AVS successfully");
};

const monitorNewTasks = async () => {

    optiFiServiceManager.on("NewOptiTaskCreated", async (taskIndex: number, task: any) => {
        try {
            console.log(`New task detected!`);

            // zkFetch
            const proof = await getZkFetchProof(task.stakingAddress);
            const { proofData, stakingAddress } = proof;
            console.log(stakingAddress);
            
            await signAndRespondToTask(taskIndex, task.taskCreatedBlock, stakingAddress, task.accountAddress, proofData);
        }catch (error) {
            console.error(`Error processing task ${taskIndex}:`, error);
    }
    });

    console.log("Monitoring for new tasks...");
};
const main = async () => {
    console.log("Starting the main function");
    await registerOperator();
    monitorNewTasks().catch((error) => {
        console.error("Error monitoring tasks:", error);
    });
};

main().catch((error) => {
    console.error("Error in main function:", error);
});