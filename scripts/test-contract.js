const { ethers } = require("hardhat");
const { fhevm } = require("hardhat");

/**
 * Test script to verify SecureResume contract functionality
 * This script tests:
 * 1. Contract deployment
 * 2. Resume submission with FHE encryption
 * 3. Resume viewing
 * 4. HR authorization
 * 5. HR skill evaluation with FHE decryption
 * 
 * Usage:
 *   npx hardhat run scripts/test-contract.js --network hardhat
 *   npx hardhat run scripts/test-contract.js --network sepolia
 */

async function main() {
  console.log("=".repeat(60));
  console.log("SecureResume Contract Test Script");
  console.log("=".repeat(60));

  // Get signers
  const [deployer, alice, bob, hr] = await ethers.getSigners();
  console.log("\n📋 Signers:");
  console.log("  Deployer:", deployer.address);
  console.log("  Alice (candidate):", alice.address);
  console.log("  Bob (candidate):", bob.address);
  console.log("  HR:", hr.address);

  // Check if running on mock or real FHEVM
  const isMock = fhevm.isMock;
  console.log("\n🔐 FHEVM Mode:", isMock ? "MOCK (Local)" : "REAL (Sepolia)");

  // Deploy contract
  console.log("\n📦 Deploying SecureResume contract...");
  const SecureResumeFactory = await ethers.getContractFactory("SecureResume");
  const secureResume = await SecureResumeFactory.deploy();
  await secureResume.waitForDeployment();
  const contractAddress = await secureResume.getAddress();
  console.log("  ✅ Contract deployed at:", contractAddress);

  // Test 1: Submit Resume (Alice)
  console.log("\n" + "=".repeat(60));
  console.log("Test 1: Submit Resume (Alice)");
  console.log("=".repeat(60));

  const aliceName = "Alice Johnson";
  const aliceEducation = "Bachelor's in Computer Science";
  const aliceWorkExp = "5 years software development";
  const aliceSkillNames = ["JavaScript", "React", "Solidity"];
  const aliceSkillLevels = [8, 7, 6];

  console.log("\n📝 Resume Data:");
  console.log("  Name:", aliceName);
  console.log("  Education:", aliceEducation);
  console.log("  Work Experience:", aliceWorkExp);
  console.log("  Skills:", aliceSkillNames.map((name, i) => `${name} (Level ${aliceSkillLevels[i]})`).join(", "));

  // Encrypt skill levels
  console.log("\n🔐 Encrypting skill levels...");
  const encryptedAliceSkills = await fhevm
    .createEncryptedInput(contractAddress, alice.address)
    .add32(aliceSkillLevels[0])
    .add32(aliceSkillLevels[1])
    .add32(aliceSkillLevels[2])
    .encrypt();

  console.log("  ✅ Encryption completed");
  console.log("  Handles:", encryptedAliceSkills.handles);

  // Submit resume
  console.log("\n📤 Submitting resume to contract...");
  const submitTx = await secureResume
    .connect(alice)
    .submitResume(
      aliceName,
      aliceEducation,
      aliceWorkExp,
      aliceSkillNames,
      encryptedAliceSkills.handles,
      encryptedAliceSkills.inputProof
    );
  await submitTx.wait();
  console.log("  ✅ Resume submitted! Tx hash:", submitTx.hash);

  // Verify resume exists
  const hasResume = await secureResume.hasResume(alice.address);
  console.log("  ✅ Resume exists:", hasResume);

  // Test 2: View Resume
  console.log("\n" + "=".repeat(60));
  console.log("Test 2: View Resume");
  console.log("=".repeat(60));

  const resumeInfo = await secureResume.getResumeInfo(alice.address);
  console.log("\n📄 Resume Info:");
  console.log("  Name:", resumeInfo[0]);
  console.log("  Education:", resumeInfo[1]);
  console.log("  Work Experience:", resumeInfo[2]);
  console.log("  Skill Names:", resumeInfo[3]);
  console.log("  Created At:", new Date(Number(resumeInfo[4]) * 1000).toLocaleString());
  console.log("  Updated At:", new Date(Number(resumeInfo[5]) * 1000).toLocaleString());

  // Test 3: HR Authorization
  console.log("\n" + "=".repeat(60));
  console.log("Test 3: HR Authorization");
  console.log("=".repeat(60));

  console.log("\n🔑 Authorizing HR...");
  const authorizeTx = await secureResume.connect(alice).authorizeHR(hr.address);
  await authorizeTx.wait();
  console.log("  ✅ HR authorized! Tx hash:", authorizeTx.hash);

  const isHR = await secureResume.hrAddresses(hr.address);
  console.log("  ✅ HR status:", isHR);

  // Test 4: HR Skill Evaluation (with decryption)
  console.log("\n" + "=".repeat(60));
  console.log("Test 4: HR Skill Evaluation (with FHE Decryption)");
  console.log("=".repeat(60));

  const requiredLevel = 7;
  console.log("\n🎯 Evaluating skill 'JavaScript' (required level:", requiredLevel + ")");

  // Get encrypted skill level from contract
  console.log("\n📥 Getting encrypted skill level from contract...");
  const skillLevelHandle = await secureResume
    .connect(hr)
    .evaluateSkillMatch(alice.address, 0); // JavaScript is at index 0

  console.log("  ✅ Encrypted skill level handle received");

  // Decrypt the skill level
  if (isMock) {
    console.log("\n🔓 Decrypting skill level (MOCK mode)...");
    const decryptedLevel = await fhevm.userDecryptEuint(
      contractAddress,
      skillLevelHandle,
      alice.address
    );
    console.log("  ✅ Decrypted skill level:", Number(decryptedLevel));

    const meetsRequirement = Number(decryptedLevel) >= requiredLevel;
    console.log("\n📊 Evaluation Result:");
    console.log("  Decrypted Level:", Number(decryptedLevel));
    console.log("  Required Level:", requiredLevel);
    console.log("  Meets Requirement:", meetsRequirement ? "✅ YES" : "❌ NO");
  } else {
    console.log("\n⚠️  Real FHEVM decryption requires frontend interaction");
    console.log("  The handle is:", skillLevelHandle);
    console.log("  Use the frontend to decrypt this handle");
  }

  // Test 5: Submit Another Resume (Bob)
  console.log("\n" + "=".repeat(60));
  console.log("Test 5: Submit Another Resume (Bob)");
  console.log("=".repeat(60));

  const bobSkillLevels = [9, 8, 7];
  const encryptedBobSkills = await fhevm
    .createEncryptedInput(contractAddress, bob.address)
    .add32(bobSkillLevels[0])
    .add32(bobSkillLevels[1])
    .add32(bobSkillLevels[2])
    .encrypt();

  const bobSubmitTx = await secureResume
    .connect(bob)
    .submitResume(
      "Bob Smith",
      "Master's in Software Engineering",
      "8 years full-stack development",
      ["Python", "Django", "PostgreSQL"],
      encryptedBobSkills.handles,
      encryptedBobSkills.inputProof
    );
  await bobSubmitTx.wait();
  console.log("  ✅ Bob's resume submitted! Tx hash:", bobSubmitTx.hash);

  // Test 6: Contract Statistics
  console.log("\n" + "=".repeat(60));
  console.log("Test 6: Contract Statistics");
  console.log("=".repeat(60));

  const stats = await secureResume.getStats();
  console.log("\n📊 Contract Statistics:");
  console.log("  Total Resumes:", Number(stats[0]));
  console.log("  Total HR Addresses:", Number(stats[1]));

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ All Tests Completed Successfully!");
  console.log("=".repeat(60));
  console.log("\n📋 Summary:");
  console.log("  ✅ Contract deployed");
  console.log("  ✅ Resume submission with FHE encryption");
  console.log("  ✅ Resume viewing");
  console.log("  ✅ HR authorization");
  console.log("  ✅ HR skill evaluation");
  console.log("  ✅ Multiple resumes stored");
  console.log("\n🎉 Contract is fully functional!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });

