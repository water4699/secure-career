import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { SecureResume } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
  hr: HardhatEthersSigner;
};

describe("SecureResumeSepolia", function () {
  let signers: Signers;
  let secureResumeContract: SecureResume;
  let secureResumeContractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const SecureResumeDeployment = await deployments.get("SecureResume");
      secureResumeContractAddress = SecureResumeDeployment.address;
      secureResumeContract = await ethers.getContractAt("SecureResume", SecureResumeDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0], hr: ethSigners[1] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("submit and evaluate resume on Sepolia", async function () {
    steps = 12;
    this.timeout(4 * 60000); // 4 minutes timeout

    progress("Checking if user already has resume...");
    const hasResume = await secureResumeContract.hasResume(signers.alice.address);
    if (hasResume) {
      console.log("User already has resume, skipping submission");
      return;
    }

    progress("Encrypting skill levels...");
    const skillLevels = [8, 7, 6];
    const encryptedSkills = await fhevm
      .createEncryptedInput(secureResumeContractAddress, signers.alice.address)
      .add32(skillLevels[0])
      .add32(skillLevels[1])
      .add32(skillLevels[2])
      .encrypt();

    progress(
      `Submitting resume for ${signers.alice.address} with ${encryptedSkills.handles.length} skills...`
    );
    let tx = await secureResumeContract
      .connect(signers.alice)
      .submitResume(
        "John Doe (Sepolia Test)",
        "Bachelor's in Computer Science - Sepolia Test",
        "5 years software development - Sepolia Test",
        ["JavaScript", "React", "Solidity"],
        encryptedSkills.handles,
        encryptedSkills.inputProof
      );
    await tx.wait();

    progress("Verifying resume submission...");
    const resumeExists = await secureResumeContract.hasResume(signers.alice.address);
    expect(resumeExists).to.be.true;

    progress("Retrieving resume info...");
    const [name, education, workExp, skillNames] = await secureResumeContract.getResumeInfo(signers.alice.address);
    expect(name).to.equal("John Doe (Sepolia Test)");
    expect(skillNames).to.deep.equal(["JavaScript", "React", "Solidity"]);

    progress("Authorizing HR...");
    tx = await secureResumeContract.connect(signers.alice).authorizeHR(signers.hr.address);
    await tx.wait();

    progress("HR encrypting required skill level...");
    const requiredLevel = 7;
    const encryptedRequiredLevel = await fhevm
      .createEncryptedInput(secureResumeContractAddress, signers.hr.address)
      .add32(requiredLevel)
      .encrypt();

    progress("HR evaluating skill match...");
    const matchResult = await secureResumeContract
      .connect(signers.hr)
      .evaluateSkillMatch(
        signers.alice.address,
        0, // JavaScript skill index
        encryptedRequiredLevel.handles[0],
        encryptedRequiredLevel.inputProof
      );

    progress("Decrypting match result...");
    const clearMatchResult = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      matchResult,
      secureResumeContractAddress,
      signers.hr,
    );
    progress(`Skill match result: ${clearMatchResult} (expected: 1 for 8 >= 7)`);
    expect(clearMatchResult).to.equal(1);

    progress("HR calculating total skill score...");
    const totalScore = await secureResumeContract
      .connect(signers.hr)
      .calculateSkillScore(signers.alice.address, [0, 1, 2]);

    progress("Decrypting total score...");
    const clearTotalScore = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      totalScore,
      secureResumeContractAddress,
      signers.hr,
    );
    progress(`Total skill score: ${clearTotalScore} (expected: 21 for 8+7+6)`);
    expect(clearTotalScore).to.equal(21);
  });
});
