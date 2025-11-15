"use client";

import { useState } from "react";
import { useAccount, useChainId } from 'wagmi';
import { ethers } from 'ethers';
import { SecureResumeABI } from '@/abi/SecureResumeABI';
import { SecureResumeAddresses } from '@/abi/SecureResumeAddresses';
import { useFhevm } from '@/fhevm/useFhevm';

// Common skill suggestions
const SKILL_SUGGESTIONS = [
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Go", "Rust",
  "React", "Vue.js", "Angular", "Node.js", "Express", "Django", "Spring Boot",
  "SQL", "MongoDB", "PostgreSQL", "Redis", "Docker", "Kubernetes",
  "AWS", "Azure", "GCP", "Git", "CI/CD", "Agile", "Scrum"
];

interface SkillInput {
  name: string;
  level: number;
}

export const ResumeSubmission = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [name, setName] = useState("");
  const [education, setEducation] = useState("");
  const [workExperience, setWorkExperience] = useState("");
  const [skills, setSkills] = useState<SkillInput[]>([{ name: "", level: 1 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [message, setMessage] = useState("");

  // Get FHEVM instance
  const provider = typeof window !== 'undefined' ? window.ethereum : undefined;
  const { instance: fhevmInstance, status: fhevmStatus, error: fhevmError } = useFhevm({
    provider,
    chainId,
    enabled: isConnected && !!address,
  });

  const addSkill = () => {
    setSkills([...skills, { name: "", level: 1 }]);
  };

  const removeSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const updateSkill = (index: number, field: keyof SkillInput, value: string | number) => {
    const updatedSkills = [...skills];
    updatedSkills[index] = { ...updatedSkills[index], [field]: value };
    setSkills(updatedSkills);
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          const form = e.currentTarget.closest('form');
          if (form && !isSubmitting) {
            const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
            submitButton?.click();
          }
          break;
        case '+':
        case '=':
          e.preventDefault();
          addSkill();
          break;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address || !isConnected) {
      setMessage("Please connect your wallet first");
      return;
    }

    if (!name.trim()) {
      setMessage("Name is required");
      return;
    }

    if (skills.some(skill => !skill.name.trim())) {
      setMessage("All skill names are required");
      return;
    }

    // Check for duplicate skill names
    const skillNames = skills.map(skill => skill.name.trim().toLowerCase());
    const uniqueSkillNames = new Set(skillNames);
    if (uniqueSkillNames.size !== skillNames.length) {
      setMessage("Skill names must be unique");
      return;
    }

    // Validate skill levels are reasonable
    if (skills.some(skill => skill.level < 1 || skill.level > 10)) {
      setMessage("Skill levels must be between 1 and 10");
      return;
    }

    if (!fhevmInstance || fhevmStatus !== "ready") {
      setMessage(`FHEVM is not ready. Status: ${fhevmStatus}${fhevmError ? `, Error: ${fhevmError.message}` : ''}`);
      return;
    }

    setIsSubmitting(true);
    setIsValidating(true);
    setMessage("🔍 Validating form data...");

    // Simulate validation delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500));

    setIsValidating(false);
    setIsEncrypting(true);
    setMessage("🔐 Encrypting skill levels with FHEVM...");

    try {
      if (!window.ethereum) {
        throw new Error("No Ethereum wallet found");
      }

      // Get contract address for current network
      const contractAddress = SecureResumeAddresses[chainId.toString() as keyof typeof SecureResumeAddresses]?.address;

      if (!contractAddress) {
        throw new Error(`Contract not deployed on network ${chainId}`);
      }

      console.log('Using contract address:', contractAddress);

      // Prepare skill data
      const skillNames = skills.map(skill => skill.name);
      const skillLevels = skills.map(skill => skill.level);

      // Real FHE encryption using FHEVM
      setMessage("🔐 Encrypting skill levels with FHEVM...");
      console.log('Encrypting skill levels:', skillLevels);

      const encryptedInput = fhevmInstance.createEncryptedInput(
        contractAddress as `0x${string}`,
        address as `0x${string}`
      );

      // Add all skill levels to encrypted input
      for (const level of skillLevels) {
        encryptedInput.add32(level);
      }

      // Perform encryption (this is CPU-intensive)
      const encrypted = await encryptedInput.encrypt();
      const { handles, inputProof } = encrypted;

      console.log('Encryption completed. Handles:', handles);
      setIsEncrypting(false);

      // Create contract instance with signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, SecureResumeABI.abi, signer);

      setMessage("📤 Submitting encrypted resume to blockchain...");

      // Call contract function with encrypted data
      const tx = await contract.submitResume(
        name,
        education,
        workExperience,
        skillNames,
        handles, // Encrypted skill level handles
        inputProof // Input proof for verification
      );

      console.log('Transaction submitted:', tx.hash);
      setMessage(`⏳ Transaction submitted! Hash: ${tx.hash}. Waiting for confirmation...`);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);

      setMessage("✅ Resume submitted successfully! Your skills are now stored with privacy-preserving encryption.");

      // Clear form
      setName("");
      setEducation("");
      setWorkExperience("");
      setSkills([{ name: "", level: 1 }]);

    } catch (error) {
      console.error("Submission error:", error);
      setIsEncrypting(false);

      let errorMessage = "Unknown error occurred";

      if (error instanceof Error) {
        if (error.message.includes("User rejected")) {
          errorMessage = "Transaction was cancelled by user";
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for transaction fees";
        } else if (error.message.includes("network")) {
          errorMessage = "Network error - please check your connection";
        } else if (error.message.includes("FHE")) {
          errorMessage = "FHE encryption error - please try again";
        } else {
          errorMessage = error.message;
        }
      }

      setMessage(`❌ Failed to submit resume: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const buttonClass =
    "inline-flex items-center justify-center rounded-2xl px-6 py-3 font-semibold text-white shadow-lg " +
    "transition-all duration-300 hover:scale-105 active:scale-95 " +
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300 focus-visible:ring-offset-2 " +
    "disabled:opacity-50 disabled:pointer-events-none bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center space-x-3 mb-8">
        <span className="text-4xl">📝</span>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          Submit Your Resume
        </h2>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-6" role="form" aria-label="Resume submission form">
        {/* Basic Information */}
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-6 shadow-md">
          <div className="flex items-center space-x-2 mb-5">
            <span className="text-2xl">👤</span>
            <h3 className="text-xl font-bold text-gray-800">Basic Information</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-purple-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-300 focus:border-purple-400 transition-all"
                placeholder="Your full name"
                required
              />
              <p className="text-xs text-purple-600 mt-2 flex items-center space-x-1">
                <span>🔒</span>
                <span>Can be partially anonymized for privacy</span>
              </p>
            </div>

            <div>
              <label htmlFor="education" className="block text-sm font-medium text-gray-700 mb-1">
                Education
              </label>
              <textarea
                id="education"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border-2 border-purple-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-300 focus:border-purple-400 transition-all resize-none"
                placeholder="🎓 Your educational background"
              />
            </div>

            <div>
              <label htmlFor="experience" className="block text-sm font-medium text-gray-700 mb-1">
                Work Experience
              </label>
              <textarea
                id="experience"
                value={workExperience}
                onChange={(e) => setWorkExperience(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border-2 border-purple-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-300 focus:border-purple-400 transition-all resize-none"
                placeholder="💼 Your professional experience"
              />
            </div>
          </div>
        </div>

        {/* Skills Section */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 shadow-md">
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-2xl">🔐</span>
            <h3 className="text-xl font-bold text-blue-800">Skills (Encrypted)</h3>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 mb-5">
            <p className="text-sm text-blue-700 leading-relaxed flex items-start space-x-2">
              <span className="text-lg">✨</span>
              <span>Your skill proficiency levels will be encrypted on-chain. HR can evaluate matches without seeing your actual skill levels.</span>
            </p>
          </div>

          <div className="space-y-3">
            {skills.map((skill, index) => (
              <div key={index} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Skill Name *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={skill.name}
                      onChange={(e) => updateSkill(index, "name", e.target.value)}
                      className="w-full px-4 py-3 border-2 border-blue-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-300 focus:border-blue-400 transition-all"
                      placeholder="💻 e.g., JavaScript, React, Python"
                      required
                    />
                    {skill.name.length === 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-32 overflow-y-auto">
                        <div className="p-2 text-xs text-gray-500 font-medium">Popular skills:</div>
                        <div className="flex flex-wrap gap-1 p-2">
                          {SKILL_SUGGESTIONS.slice(0, 8).map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => updateSkill(index, "name", suggestion)}
                              className="px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md transition-colors"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Level (1-10) *
                  </label>
                  <select
                    value={skill.level}
                    onChange={(e) => updateSkill(index, "level", parseInt(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-blue-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-300 focus:border-blue-400 transition-all bg-white"
                  >
                    {[1,2,3,4,5,6,7,8,9,10].map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>

                {skills.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSkill(index)}
                    className="px-3 py-2 text-red-600 hover:text-red-800 font-medium"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addSkill}
            className="mt-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-2xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-300 shadow-md hover:shadow-lg font-semibold flex items-center space-x-2"
          >
            <span>➕</span>
            <span>Add Skill</span>
          </button>
        </div>

        {/* FHEVM Status */}
        {fhevmStatus !== "ready" && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-sm font-bold text-yellow-900">FHEVM Status: {fhevmStatus}</p>
                {fhevmError && (
                  <p className="text-xs text-yellow-700 mt-1">Error: {fhevmError.message}</p>
                )}
                {fhevmStatus === "loading" && (
                  <p className="text-xs text-yellow-700 mt-1">Initializing FHEVM encryption service...</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-center">
          <button
            type="submit"
            disabled={isSubmitting || !fhevmInstance || fhevmStatus !== "ready"}
            className={buttonClass}
          >
            {isValidating ? "🔍 Validating..." : isEncrypting ? "🔐 Encrypting..." : isSubmitting ? "📤 Submitting..." : "Submit Resume"}
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`text-center p-5 rounded-2xl shadow-md ${
            message.includes("successfully")
              ? "bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border-2 border-green-200"
              : "bg-gradient-to-r from-red-50 to-pink-50 text-red-800 border-2 border-red-200"
          }`}>
            <div className="flex items-center justify-center space-x-2">
              <span className="text-2xl">{message.includes("successfully") ? "✅" : "❌"}</span>
              <p className="font-medium">{message}</p>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
