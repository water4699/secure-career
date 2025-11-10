"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId } from 'wagmi';
import { ethers } from 'ethers';
import { SecureResumeABI } from '@/abi/SecureResumeABI';
import { SecureResumeAddresses } from '@/abi/SecureResumeAddresses';

interface ResumeData {
  name: string;
  education: string;
  workExperience: string;
  skillNames: string[];
  createdAt: Date;
  updatedAt: Date;
}

export const ResumeViewer = () => {
  const { address } = useAccount();
  const chainId = useChainId();
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadResume = async () => {
    if (!address) return;

    setIsLoading(true);
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

      console.log('Loading resume from contract:', contractAddress);

      // Create contract instance
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, SecureResumeABI.abi, provider);

      // Check if user has resume
      const hasResume = await contract.hasResume(address);
      if (!hasResume) {
        throw new Error("No resume found for this address");
      }

      // Get resume info
      const resumeInfo = await contract.getResumeInfo(address);
      console.log('Resume info loaded:', resumeInfo);

      setResume({
        name: resumeInfo[0],
        education: resumeInfo[1],
        workExperience: resumeInfo[2],
        skillNames: resumeInfo[3],
        createdAt: new Date(Number(resumeInfo[4]) * 1000),
        updatedAt: new Date(Number(resumeInfo[5]) * 1000),
      });

    } catch (error) {
      console.error("Loading error:", error);
      if (error instanceof Error && error.message.includes("No resume found")) {
        setMessage("No resume found. Please submit your resume first.");
      } else {
        setMessage(`Failed to load resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (address) {
      loadResume();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, chainId]);

  const buttonClass =
    "inline-flex items-center justify-center rounded-2xl px-6 py-3 font-semibold text-white shadow-lg " +
    "transition-all duration-300 hover:scale-105 active:scale-95 " +
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300 focus-visible:ring-offset-2 " +
    "disabled:opacity-50 disabled:pointer-events-none bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600";

  if (!address) {
    return (
      <div className="text-center glass-card rounded-2xl p-8">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-gray-700 text-lg">Please connect your wallet to view your resume.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center space-x-3 mb-8">
        <span className="text-4xl">👁️</span>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          Your Resume
        </h2>
      </div>

      <div className="flex justify-center mb-6">
        <button
          onClick={loadResume}
          disabled={isLoading}
          className={buttonClass}
        >
          {isLoading ? "Loading..." : "Refresh Resume"}
        </button>
      </div>

      {message && (
        <div className="text-center p-5 rounded-2xl bg-gradient-to-r from-red-50 to-pink-50 text-red-800 mb-6 border-2 border-red-200 shadow-md">
          <div className="flex items-center justify-center space-x-2">
            <span className="text-2xl">⚠️</span>
            <p className="font-medium">{message}</p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center p-12 glass-card rounded-2xl">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600 mx-auto"></div>
          <p className="mt-6 text-gray-700 text-lg font-medium">Loading your resume...</p>
          <p className="mt-2 text-gray-500 text-sm">🔍 Fetching encrypted data from blockchain</p>
        </div>
      )}

      {resume && !isLoading && (
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-6 shadow-md border-2 border-purple-100">
            <div className="flex items-center space-x-2 mb-5">
              <span className="text-2xl">👤</span>
              <h3 className="text-xl font-bold text-gray-800">Basic Information</h3>
            </div>

            <div className="space-y-3">
              <div>
                <span className="font-medium text-gray-700">Name:</span>
                <p className="text-gray-900 mt-1">{resume.name}</p>
              </div>

              <div>
                <span className="font-medium text-gray-700">Education:</span>
                <p className="text-gray-900 mt-1 whitespace-pre-line">{resume.education}</p>
              </div>

              <div>
                <span className="font-medium text-gray-700">Work Experience:</span>
                <p className="text-gray-900 mt-1 whitespace-pre-line">{resume.workExperience}</p>
              </div>
            </div>
          </div>

          {/* Skills */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 shadow-md border-2 border-blue-100">
            <div className="flex items-center space-x-2 mb-5">
              <span className="text-2xl">🔐</span>
              <h3 className="text-xl font-bold text-blue-800">Skills</h3>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 mb-5 shadow-sm">
              <div className="flex flex-wrap gap-3">
                {resume.skillNames.map((skill, index) => (
                  <span
                    key={index}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-sm font-semibold shadow-md flex items-center space-x-1"
                  >
                    <span>💻</span>
                    <span>{skill}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-2xl p-5">
              <div className="flex items-start space-x-3">
                <span className="text-3xl">🔒</span>
                <div>
                  <p className="text-sm font-bold text-yellow-900 mb-1">Privacy Protected</p>
                  <p className="text-sm text-yellow-800 leading-relaxed">
                    Your skill proficiency levels are encrypted on-chain. HR can evaluate your qualifications 
                    for job matches without seeing your actual skill levels. Your privacy is our priority.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-6 shadow-md border-2 border-gray-100">
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-2xl">📅</span>
              <h3 className="text-xl font-bold text-gray-800">Resume History</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Created:</span>
                <p className="text-gray-900">{resume.createdAt.toLocaleDateString()}</p>
              </div>

              <div>
                <span className="font-medium text-gray-700">Last Updated:</span>
                <p className="text-gray-900">{resume.updatedAt.toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!resume && !isLoading && !message && (
        <div className="text-center p-12 glass-card rounded-2xl">
          <div className="text-5xl mb-4">📄</div>
          <p className="text-gray-700 text-lg font-medium">No resume found.</p>
          <p className="text-gray-600 mt-2">Submit your resume first to view it here.</p>
        </div>
      )}
    </div>
  );
};
