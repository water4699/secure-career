import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const CONTRACT_NAME = "SecureResume";

// <root>/packages/secure-career
const rel = "../";

// <root>/frontend/abi
const outdir = path.resolve("./abi");

if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir);
}

const dir = path.resolve(rel);
const dirname = path.basename(dir);

const line =
  "\n===================================================================\n";

if (!fs.existsSync(dir)) {
  console.error(
    `${line}Unable to locate ${rel}. Expecting <root>/packages/${dirname}${line}`
  );
  process.exit(1);
}

if (!fs.existsSync(outdir)) {
  console.error(`${line}Unable to locate ${outdir}.${line}`);
  process.exit(1);
}

const deploymentsDir = path.join(dir, "deployments");
// if (!fs.existsSync(deploymentsDir)) {
//   console.error(
//     `${line}Unable to locate 'deployments' directory.\n\n1. Goto '${dirname}' directory\n2. Run 'npx hardhat deploy --network ${chainName}'.${line}`
//   );
//   process.exit(1);
// }

function deployOnHardhatNode() {
  if (process.platform === "win32") {
    // Not supported on Windows
    return;
  }

  // Skip deployment in Vercel environment
  if (process.env.VERCEL || process.env.CI || process.env.NETLIFY) {
    console.log("Skipping auto-deployment in CI/CD environment");
    return;
  }

  try {
    execSync(`./deploy-hardhat-node.sh`, {
      cwd: path.resolve("./scripts"),
      stdio: "inherit",
    });
  } catch (e) {
    console.error(`${line}Script execution failed: ${e}${line}`);
    process.exit(1);
  }
}

function readDeployment(chainName, chainId, contractName, optional) {
  const chainDeploymentDir = path.join(deploymentsDir, chainName);

  if (!fs.existsSync(chainDeploymentDir) && chainId === 31337) {
    // Try to auto-deploy the contract on hardhat node!
    deployOnHardhatNode();
  }

  if (!fs.existsSync(chainDeploymentDir)) {
    // In CI/CD environments, provide fallback deployment info
    if (process.env.VERCEL || process.env.CI || process.env.NETLIFY) {
      console.log(`Using fallback deployment for ${chainName} in CI/CD environment`);

      // Return a minimal deployment object for CI/CD
      return {
        address: "0x0000000000000000000000000000000000000000",
        abi: [], // Empty ABI for now, will be populated from source
        chainId: chainId
      };
    }

    console.error(
      `${line}Unable to locate '${chainDeploymentDir}' directory.\n\n1. Goto '${dirname}' directory\n2. Run 'npx hardhat deploy --network ${chainName}'.${line}`
    );
    if (!optional) {
      process.exit(1);
    }
    return undefined;
  }

  const jsonString = fs.readFileSync(
    path.join(chainDeploymentDir, `${contractName}.json`),
    "utf-8"
  );

  const obj = JSON.parse(jsonString);
  obj.chainId = chainId;

  return obj;
}

// Auto deployed on Linux/Mac (will fail on windows)
let deployLocalhost = readDeployment("localhost", 31337, CONTRACT_NAME, false /* optional */);

// In CI/CD environments, use existing ABI if deployment files don't exist
if (!deployLocalhost && (process.env.VERCEL || process.env.CI || process.env.NETLIFY)) {
  console.log("Using existing ABI files in CI/CD environment");
  // Try to read from existing ABI file
  const existingAbiPath = path.join(outdir, `${CONTRACT_NAME}ABI.ts`);
  if (fs.existsSync(existingAbiPath)) {
    const existingContent = fs.readFileSync(existingAbiPath, 'utf-8');
    // Extract ABI from existing file
    const abiMatch = existingContent.match(/export const SecureResumeABI = ({[\s\S]*}) as const;/);
    if (abiMatch) {
      deployLocalhost = JSON.parse(abiMatch[1]);
      deployLocalhost.address = "0x0000000000000000000000000000000000000000"; // Default address
      deployLocalhost.chainId = 31337;
    }
  }
}

if (!deployLocalhost) {
  console.error(`${line}Unable to get localhost deployment. Please run deployment locally first.${line}`);
  process.exit(1);
}

// Sepolia is optional
let deploySepolia = readDeployment("sepolia", 11155111, CONTRACT_NAME, true /* optional */);
if (!deploySepolia) {
  deploySepolia = { abi: deployLocalhost.abi, address: "0x0000000000000000000000000000000000000000" };
}

if (deployLocalhost && deploySepolia) {
  if (
    JSON.stringify(deployLocalhost.abi) !== JSON.stringify(deploySepolia.abi)
  ) {
    console.error(
      `${line}Deployments on localhost and Sepolia differ. Cant use the same abi on both networks. Consider re-deploying the contracts on both networks.${line}`
    );
    process.exit(1);
  }
}


const tsCode = `
/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const ${CONTRACT_NAME}ABI = ${JSON.stringify({ abi: deployLocalhost.abi }, null, 2)} as const;
\n`;
const tsAddresses = `
/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const ${CONTRACT_NAME}Addresses = { 
  "11155111": { address: "${deploySepolia.address}", chainId: 11155111, chainName: "sepolia" },
  "31337": { address: "${deployLocalhost.address}", chainId: 31337, chainName: "hardhat" },
};
`;

console.log(`Generated ${path.join(outdir, `${CONTRACT_NAME}ABI.ts`)}`);
console.log(`Generated ${path.join(outdir, `${CONTRACT_NAME}Addresses.ts`)}`);
console.log(tsAddresses);

fs.writeFileSync(path.join(outdir, `${CONTRACT_NAME}ABI.ts`), tsCode, "utf-8");
fs.writeFileSync(
  path.join(outdir, `${CONTRACT_NAME}Addresses.ts`),
  tsAddresses,
  "utf-8"
);
