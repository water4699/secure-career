"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, useChainId } from 'wagmi';
import { ethers } from 'ethers';
import { SecureResumeABI } from '@/abi/SecureResumeABI';
import { SecureResumeAddresses } from '@/abi/SecureResumeAddresses';
import { useFhevm } from '@/fhevm/useFhevm';
import { FhevmDecryptionSignature } from '@/fhevm/FhevmDecryptionSignature';
import { useInMemoryStorage } from '@/hooks/useInMemoryStorage';

interface CandidateSkill {
  name: string;
  meetsRequirement: boolean | null; // null = not evaluated, true/false = evaluation result
}

interface Candidate {
  address: string;
  name: string;
  skills: CandidateSkill[];
  totalScore: number | null;
}

export const HREvaluator = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { storage } = useInMemoryStorage();
  const [candidateAddress, setCandidateAddress] = useState("");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [requiredSkill, setRequiredSkill] = useState("");
  const [requiredLevel, setRequiredLevel] = useState(5);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isCalculatingScore, setIsCalculatingScore] = useState(false);
  const [message, setMessage] = useState("");
  const [isHR, setIsHR] = useState<boolean | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Get FHEVM instance
  const provider = typeof window !== 'undefined' ? window.ethereum : undefined;
  const { instance: fhevmInstance, status: fhevmStatus, error: fhevmError } = useFhevm({
    provider,
    chainId,
    enabled: isConnected && !!address,
  });

  // Check if current address is authorized as HR
  const checkHRStatus = useCallback(async () => {
    if (!address || !isConnected) {
      setIsHR(null);
      return;
    }

    try {
      if (!window.ethereum) {
        throw new Error("No Ethereum wallet found");
      }

      const contractAddress = SecureResumeAddresses[chainId.toString() as keyof typeof SecureResumeAddresses]?.address;
      if (!contractAddress) {
        setIsHR(null);
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, SecureResumeABI.abi, provider);
      const hrStatus = await contract.hrAddresses(address);
      setIsHR(hrStatus);
    } catch (error) {
      console.error("Error checking HR status:", error);
      setIsHR(null);
    }
  }, [address, chainId, isConnected]);

  // Authorize current address as HR
  const authorizeAsHR = async () => {
    if (!address || !isConnected) {
      setMessage("Please connect your wallet first");
      return;
    }

    setIsAuthorizing(true);
    setMessage("");

    try {
      if (!window.ethereum) {
        throw new Error("No Ethereum wallet found");
      }

      const contractAddress = SecureResumeAddresses[chainId.toString() as keyof typeof SecureResumeAddresses]?.address;
      if (!contractAddress) {
        throw new Error(`Contract not deployed on network ${chainId}`);
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, SecureResumeABI.abi, signer);

      setMessage("🔐 Authorizing as HR...");
      const tx = await contract.authorizeHR(address);
      setMessage(`⏳ Transaction submitted: ${tx.hash}. Waiting for confirmation...`);

      await tx.wait();
      setMessage("✅ Successfully authorized as HR!");
      setIsHR(true);
    } catch (error) {
      console.error("Authorization error:", error);
      setMessage(`Failed to authorize as HR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAuthorizing(false);
    }
  };

  // Check HR status when address or chainId changes
  useEffect(() => {
    checkHRStatus();
  }, [checkHRStatus]);

  const loadCandidate = async () => {
    if (!candidateAddress.trim()) {
      setMessage("Please enter a candidate address");
      return;
    }

    setIsEvaluating(true);
    setMessage("");

    try {
      if (!window.ethereum) {
        throw new Error("No Ethereum wallet found");
      }

      // Get contract address for current network
      const contractAddress = SecureResumeAddresses[chainId.toString() as keyof typeof SecureResumeAddresses]?.address;

      if (!contractAddress) {
        throw new Error(`Contract not deployed on network ${chainId}`);
      }

      console.log('Loading candidate from contract:', contractAddress);

      // Create contract instance
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, SecureResumeABI.abi, provider);

      // Check if candidate has resume
      const hasResume = await contract.hasResume(candidateAddress);
      if (!hasResume) {
        throw new Error("Candidate has not submitted a resume");
      }

      // Get resume info
      const resumeInfo = await contract.getResumeInfo(candidateAddress);
      console.log('Candidate resume info loaded:', resumeInfo);

      // Create skill objects with null evaluation status
      const skills = resumeInfo[3].map((skillName: string) => ({
        name: skillName,
        meetsRequirement: null
      }));

      setCandidate({
        address: candidateAddress,
        name: resumeInfo[0],
        skills: skills,
        totalScore: null,
      });

      setMessage("Candidate resume loaded successfully.");

    } catch (error) {
      console.error("Loading error:", error);
      setMessage(`Failed to load candidate resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setCandidate(null);
    } finally {
      setIsEvaluating(false);
    }
  };

  const evaluateSkill = async (skillName: string) => {
    if (!candidate || !fhevmInstance || fhevmStatus !== "ready") {
      setMessage(`FHEVM is not ready. Status: ${fhevmStatus}${fhevmError ? `, Error: ${fhevmError.message}` : ''}`);
      return;
    }

    setIsEvaluating(true);
    setIsDecrypting(true);
    setMessage("");

    try {
      if (!window.ethereum || !address) {
        throw new Error("No Ethereum wallet found or not connected");
      }

      // Get contract address for current network
      const contractAddress = SecureResumeAddresses[chainId.toString() as keyof typeof SecureResumeAddresses]?.address;

      if (!contractAddress) {
        throw new Error(`Contract not deployed on network ${chainId}`);
      }

      // Create contract instance with signer (HR needs to sign the transaction)
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, SecureResumeABI.abi, signer);

      // Find skill index
      const skillIndex = candidate.skills.findIndex(skill => skill.name === skillName);
      if (skillIndex === -1) {
        throw new Error(`Skill "${skillName}" not found`);
      }

      console.log(`Evaluating skill "${skillName}" at index ${skillIndex} for candidate ${candidate.address}`);

      setMessage("📤 Requesting encrypted skill level from contract...");

      // Call evaluateSkillMatch as a transaction to get permission and encrypted skill level handle
      // This function returns euint32 (handle) which needs to be decrypted client-side
      // Note: We need to send a transaction to get FHE permissions, then we can decrypt
      const tx = await contract.evaluateSkillMatch(candidate.address, skillIndex);

      console.log('Skill evaluation transaction submitted:', tx.hash);
      setMessage(`⏳ Transaction submitted: ${tx.hash}. Waiting for confirmation...`);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);

      // Get the encrypted skill level handle from the transaction return value
      // evaluateSkillMatch returns euint32, which in ethers.js is represented as bytes32 (handle)
      setMessage("🔐 Getting encrypted skill level handle...");

      // After the transaction, we can use staticCall to get the handle
      // The transaction already granted permissions via FHE.allow
      const skillHandle = await contract.evaluateSkillMatch.staticCall(
        candidate.address,
        skillIndex
      );

      if (!skillHandle || skillHandle === ethers.ZeroHash || skillHandle === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        throw new Error("No encrypted skill level found or handle is zero");
      }

      console.log('Encrypted skill handle:', skillHandle);

      // Real FHE decryption using FHEVM
      const sig = await FhevmDecryptionSignature.loadOrSign(
        fhevmInstance,
        [contractAddress],
        signer,
        storage
      );

      if (!sig) {
        throw new Error("Failed to create decryption signature");
      }

      setMessage("🔓 Decrypting with FHEVM...");

      // Decrypt the skill level
      const decryptedResults = await fhevmInstance.userDecrypt(
        [{ handle: skillHandle, contractAddress }],
        sig.privateKey,
        sig.publicKey,
        sig.signature,
        sig.contractAddresses,
        sig.userAddress,
        sig.startTimestamp,
        sig.durationDays
      );

      const decryptedLevel = Number(decryptedResults[skillHandle]);
      console.log(`Decrypted skill level for "${skillName}":`, decryptedLevel);

      setIsDecrypting(false);

      // Compare with required level
      const meetsRequirement = decryptedLevel >= requiredLevel;

      setCandidate(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          skills: prev.skills.map(skill =>
            skill.name === skillName
              ? { ...skill, meetsRequirement }
              : skill
          ),
        };
      });

      setMessage(`✅ Skill "${skillName}" evaluation complete. Decrypted level: ${decryptedLevel}, Required: ${requiredLevel}. Result: ${meetsRequirement ? '✅ Meets requirement' : '❌ Below requirement'}`);

    } catch (error) {
      console.error("Evaluation error:", error);
      setIsDecrypting(false);
      setMessage(`❌ Failed to evaluate skill: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  const calculateTotalScore = async () => {
    if (!candidate) return;

    setIsCalculatingScore(true);
    setMessage("");

    try {
      if (!window.ethereum) {
        throw new Error("No Ethereum wallet found");
      }

      // Get contract address for current network
      const contractAddress = SecureResumeAddresses[chainId.toString() as keyof typeof SecureResumeAddresses]?.address;

      if (!contractAddress) {
        throw new Error(`Contract not deployed on network ${chainId}`);
      }

      // Create contract instance with signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, SecureResumeABI.abi, signer);

      // Create skill indices array
      const skillIndices = candidate.skills.map((_, index) => index);

      console.log(`Calculating total score for candidate ${candidate.address} with skill indices:`, skillIndices);

      setMessage("📤 Calculating total skill score...");

      // Call calculateSkillScore function
      const tx = await contract.calculateSkillScore(candidate.address, skillIndices);

      console.log('Score calculation transaction submitted:', tx.hash);
      setMessage(`⏳ Transaction submitted: ${tx.hash}. Waiting for confirmation...`);

      // Wait for confirmation
      await tx.wait();

      // Get the encrypted total score handle from the transaction return value
      // calculateSkillScore returns euint32, which in ethers.js is represented as bytes32 (handle)
      setMessage("🔐 Getting encrypted total score handle...");

      // Use staticCall to get the handle
      const scoreHandle = await contract.calculateSkillScore.staticCall(
        candidate.address,
        skillIndices
      );

      if (!scoreHandle || scoreHandle === ethers.ZeroHash || scoreHandle === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        throw new Error("No encrypted total score found or handle is zero");
      }

      console.log('Encrypted total score handle:', scoreHandle);

      if (!fhevmInstance) {
        throw new Error("FHEVM instance not available");
      }

      // Real FHE decryption using FHEVM
      const sig = await FhevmDecryptionSignature.loadOrSign(
        fhevmInstance,
        [contractAddress],
        signer,
        storage
      );

      if (!sig) {
        throw new Error("Failed to create decryption signature");
      }

      setMessage("🔓 Decrypting total score with FHEVM...");

      // Decrypt the total score
      const decryptedResults = await fhevmInstance.userDecrypt(
        [{ handle: scoreHandle, contractAddress }],
        sig.privateKey,
        sig.publicKey,
        sig.signature,
        sig.contractAddresses,
        sig.userAddress,
        sig.startTimestamp,
        sig.durationDays
      );

      const totalScore = Number(decryptedResults[scoreHandle]);
      console.log(`Decrypted total score for candidate ${candidate.address}:`, totalScore);

      setCandidate(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          totalScore,
        };
      });

      setMessage(`✅ Total skill score calculated: ${totalScore}/${candidate.skills.length * 10}`);

    } catch (error) {
      console.error("Calculation error:", error);
      setMessage(`❌ Failed to calculate total score: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCalculatingScore(false);
    }
  };

  const buttonClass =
    "inline-flex items-center justify-center rounded-2xl px-6 py-3 font-semibold text-white shadow-lg " +
    "transition-all duration-300 hover:scale-105 active:scale-95 " +
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300 focus-visible:ring-offset-2 " +
    "disabled:opacity-50 disabled:pointer-events-none bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600";

  const skillButtonClass = (status: boolean | null) => {
    const baseClass = "px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 shadow-md";
    if (status === true) return baseClass + " bg-gradient-to-r from-green-400 to-emerald-500 text-white";
    if (status === false) return baseClass + " bg-gradient-to-r from-red-400 to-pink-500 text-white";
    return baseClass + " bg-white/60 backdrop-blur-sm text-gray-700 hover:bg-white/80";
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center space-x-3 mb-8">
        <span className="text-4xl">🎯</span>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          HR Skill Evaluation
        </h2>
      </div>

      {/* HR Authorization Check */}
      {isConnected && address && isHR === false && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-200 rounded-2xl p-6 mb-6 shadow-md">
          <div className="flex items-start space-x-3 mb-4">
            <span className="text-3xl">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-orange-900 mb-1">HR Authorization Required</p>
              <p className="text-sm text-orange-800 leading-relaxed mb-4">
                You need to be authorized as HR to evaluate candidate skills. Click the button below to authorize your address.
              </p>
              <button
                onClick={authorizeAsHR}
                disabled={isAuthorizing}
                className={buttonClass + " w-full"}
              >
                {isAuthorizing ? "⏳ Authorizing..." : "🔐 Authorize as HR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isConnected && address && isHR === true && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-4 mb-6 shadow-md">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">✅</span>
            <p className="text-sm font-medium text-green-800">You are authorized as HR</p>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 mb-6 shadow-md">
        <div className="flex items-start space-x-3">
          <span className="text-3xl">🛡️</span>
          <div>
            <p className="text-sm font-bold text-yellow-900 mb-1">Privacy-First Evaluation</p>
            <p className="text-sm text-yellow-800 leading-relaxed">
              Evaluate candidate skills using encrypted data. No sensitive information is decrypted during the evaluation process.
            </p>
          </div>
        </div>
      </div>

      {/* Load Candidate */}
      <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-6 mb-6 shadow-md border-2 border-gray-100">
        <div className="flex items-center space-x-2 mb-5">
          <span className="text-2xl">👤</span>
          <h3 className="text-xl font-bold text-gray-800">Load Candidate Resume</h3>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            value={candidateAddress}
            onChange={(e) => setCandidateAddress(e.target.value)}
            placeholder="🔍 Enter candidate wallet address"
            className="flex-1 px-4 py-3 border-2 border-purple-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-300 focus:border-purple-400 transition-all"
          />
          <button
            onClick={loadCandidate}
            disabled={isEvaluating}
            className={buttonClass}
          >
            {isEvaluating ? "Loading..." : "Load Resume"}
          </button>
        </div>
      </div>

      {message && (
        <div className={`text-center p-5 rounded-2xl mb-6 shadow-md border-2 ${
          message.includes("successfully") || message.includes("complete")
            ? "bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border-green-200"
            : "bg-gradient-to-r from-red-50 to-pink-50 text-red-800 border-red-200"
        }`}>
          <div className="flex items-center justify-center space-x-2">
            <span className="text-2xl">{message.includes("successfully") || message.includes("complete") ? "✅" : "❌"}</span>
            <p className="font-medium">{message}</p>
          </div>
        </div>
      )}

      {/* Candidate Evaluation */}
      {candidate && (
        <div className="space-y-6">
          {/* Candidate Info */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-6 shadow-md border-2 border-purple-100">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-2xl">👔</span>
              <h3 className="text-xl font-bold text-gray-800">Candidate: {candidate.name}</h3>
            </div>
            <p className="text-sm text-gray-600 font-mono bg-white/60 backdrop-blur-sm rounded-xl px-4 py-2">{candidate.address}</p>
          </div>

          {/* Individual Skill Evaluation */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 shadow-md border-2 border-blue-100">
            <div className="flex items-center space-x-2 mb-5">
              <span className="text-2xl">🎯</span>
              <h3 className="text-xl font-bold text-blue-800">Evaluate Individual Skills</h3>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Required Skill
                  </label>
                  <select
                    value={requiredSkill}
                    onChange={(e) => setRequiredSkill(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-blue-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-300 focus:border-blue-400 transition-all bg-white"
                  >
                    <option value="">Select a skill...</option>
                    {candidate.skills.map((skill, index) => (
                      <option key={index} value={skill.name}>{skill.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Required Level (1-10)
                  </label>
                  <select
                    value={requiredLevel}
                    onChange={(e) => setRequiredLevel(parseInt(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-blue-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-300 focus:border-blue-400 transition-all bg-white"
                  >
                    {[1,2,3,4,5,6,7,8,9,10].map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() => requiredSkill && evaluateSkill(requiredSkill)}
                disabled={isEvaluating || isDecrypting || !requiredSkill || isHR === false}
                className={buttonClass + " w-full"}
              >
                {isDecrypting ? "🔓 Decrypting..." : isEvaluating ? "Evaluating..." : `Evaluate ${requiredSkill} Skill Match`}
              </button>
            </div>
          </div>

          {/* Skill Status */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-md border-2 border-gray-100">
            <div className="flex items-center space-x-2 mb-5">
              <span className="text-2xl">📊</span>
              <h3 className="text-xl font-bold text-gray-800">Skill Evaluation Results</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {candidate.skills.map((skill, index) => (
                <div key={index} className="text-center">
                  <div className={skillButtonClass(skill.meetsRequirement)}>
                    {skill.name}
                  </div>
                  {skill.meetsRequirement !== null && (
                    <div className="text-xs mt-1">
                      {skill.meetsRequirement ? "✅ Meets requirement" : "❌ Below requirement"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Total Score Calculation */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 shadow-md border-2 border-green-100">
            <div className="flex items-center space-x-2 mb-5">
              <span className="text-2xl">🏆</span>
              <h3 className="text-xl font-bold text-green-800">Overall Skill Assessment</h3>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-green-700">
                  Calculate total proficiency score across all skills
                </p>
                {candidate.totalScore !== null && (
                  <p className="text-lg font-bold text-green-800 mt-2">
                    Total Score: {candidate.totalScore}/40
                  </p>
                )}
              </div>

              <button
                onClick={calculateTotalScore}
                disabled={isCalculatingScore || isHR === false}
                className={buttonClass}
              >
                {isCalculatingScore ? "Calculating..." : "Calculate Score"}
              </button>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-700 leading-relaxed flex items-start space-x-2">
                <span className="text-lg">🔐</span>
                <span>This calculation is performed on encrypted data, ensuring candidate privacy while providing
                you with valuable assessment insights.</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
