import { task } from "hardhat/config";

task("SecureResume:getResume", "Get resume info for an address")
  .addParam("address", "The address to query")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const secureResume = await ethers.getContractAt("SecureResume", (await hre.deployments.get("SecureResume")).address);

    const resumeInfo = await secureResume.getResumeInfo(taskArgs.address);
    console.log("Resume Info:");
    console.log(`Name: ${resumeInfo[0]}`);
    console.log(`Education: ${resumeInfo[1]}`);
    console.log(`Work Experience: ${resumeInfo[2]}`);
    console.log(`Skills: ${resumeInfo[3].join(", ")}`);
    console.log(`Created At: ${new Date(Number(resumeInfo[4]) * 1000).toISOString()}`);
    console.log(`Updated At: ${new Date(Number(resumeInfo[5]) * 1000).toISOString()}`);
  });

task("SecureResume:hasResume", "Check if address has submitted a resume")
  .addParam("address", "The address to check")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const secureResume = await ethers.getContractAt("SecureResume", (await hre.deployments.get("SecureResume")).address);

    const hasResume = await secureResume.hasResume(taskArgs.address);
    console.log(`Address ${taskArgs.address} ${hasResume ? "has" : "does not have"} a resume`);
  });

task("SecureResume:authorizeHR", "Authorize an HR address")
  .addParam("hr", "The HR address to authorize")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const secureResume = await ethers.getContractAt("SecureResume", (await hre.deployments.get("SecureResume")).address);

    const tx = await secureResume.authorizeHR(taskArgs.hr);
    await tx.wait();
    console.log(`Authorized HR: ${taskArgs.hr}`);
  });

task("SecureResume:isHR", "Check if address is authorized HR")
  .addParam("address", "The address to check")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const secureResume = await ethers.getContractAt("SecureResume", (await hre.deployments.get("SecureResume")).address);

    const isHR = await secureResume.hrAddresses(taskArgs.address);
    console.log(`Address ${taskArgs.address} is ${isHR ? "" : "not "}authorized as HR`);
  });
