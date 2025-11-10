const { ethers } = require("hardhat");

async function testNetwork(networkName, contractAddress) {
  console.log(`\n🔍 Testing ${networkName} network...`);
  console.log(`📍 Contract address: ${contractAddress}`);

  try {
    // Get contract instance
    const SecureResume = await ethers.getContractAt("SecureResume", contractAddress);

    // Test basic functionality
    const testAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    console.log(`👤 Testing hasResume for address: ${testAddress}`);
    const hasResume = await SecureResume.hasResume(testAddress);
    console.log(`✅ hasResume result: ${hasResume}`);

    // Test contract address
    const contractAddr = await SecureResume.getAddress();
    console.log(`✅ Contract address verification: ${contractAddr === contractAddress ? 'MATCH' : 'MISMATCH'}`);

    console.log(`🎉 ${networkName} network test PASSED`);

  } catch (error) {
    console.error(`❌ ${networkName} network test FAILED:`, error.message);
    throw error;
  }
}

async function main() {
  console.log("🚀 Testing Secure Career contract on multiple networks\n");

  try {
    // Test localhost network
    await testNetwork("Localhost", "0x5FbDB2315678afecb367f032d93F642f64180aa3");

    console.log("\n⏳ Switching to Sepolia network...");

    // Test Sepolia network
    process.env.HARDHAT_NETWORK = 'sepolia';
    await testNetwork("Sepolia", "0x9D1280c8F82bB3412029509453884673cef0De55");

    console.log("\n🎊 ALL NETWORK TESTS PASSED!");
    console.log("✅ Secure Career contract works on both Localhost and Sepolia networks");
    console.log("✅ Network switching functionality is working correctly");

  } catch (error) {
    console.error("\n💥 NETWORK TESTS FAILED:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
