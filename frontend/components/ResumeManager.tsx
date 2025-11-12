"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId } from 'wagmi';
import { ResumeSubmission } from "./ResumeSubmission";
import { ResumeViewer } from "./ResumeViewer";
import { HREvaluator } from "./HREvaluator";
import { ErrorNotDeployed } from "./ErrorNotDeployed";

type TabType = "submit" | "view" | "evaluate";

export const ResumeManager = () => {
  const wagmiAccount = useAccount();
  const wagmiChainId = useChainId();

  // Add mounted state to prevent hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Simplified connection check - use wagmi connection status directly, but only after mounted
  const isConnected = mounted ? wagmiAccount.isConnected : false;
  const chainId = wagmiChainId;
  const isLocalNetwork = chainId === 31337;

  const [activeTab, setActiveTab] = useState<TabType>("submit");

  // Network status check
  const getNetworkStatus = () => {
    if (chainId === 31337) return { status: "local", color: "blue", icon: "🔧" };
    if (chainId === 11155111) return { status: "sepolia", color: "green", icon: "🌐" };
    return { status: "unknown", color: "gray", icon: "❓" };
  };

  const networkInfo = getNetworkStatus();

  const buttonClass =
    "inline-flex items-center justify-center rounded-2xl px-6 py-4 font-semibold text-white shadow-lg " +
    "transition-all duration-300 hover:scale-105 active:scale-95 " +
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300 focus-visible:ring-offset-2 " +
    "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed";

  const activeButtonClass = buttonClass + " bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600";
  const inactiveButtonClass = buttonClass + " bg-white/20 backdrop-blur-md text-gray-700 hover:bg-white/30";

  // Debug logging like athlete project
  console.log('wagmi hooks in ResumeManager:', {
    chainId: wagmiChainId,
    isConnected: wagmiAccount.isConnected,
    address: wagmiAccount.address,
    isLocalNetwork
  });

  if (!isConnected) {
    return (
      <div className="mx-auto text-center max-w-2xl">
        <div className="glass-card rounded-3xl p-12 shadow-2xl">
          <div className="text-6xl mb-6">👋</div>
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Welcome to Secure Career
          </h2>
          <p className="text-gray-700 text-lg mb-6 leading-relaxed">
            Connect your wallet to securely store and manage your resume with privacy-preserving encryption. 
            <span className="block mt-2">🔐 Your data, your privacy, your control.</span>
          </p>
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-6 mb-6">
            <p className="text-sm text-gray-700 leading-relaxed">
              <span className="text-2xl mr-2">✨</span>
              Your skills and qualifications will be stored encrypted, allowing HR to evaluate matches 
              without seeing sensitive details. Privacy-first, always.
            </p>
          </div>
          {isLocalNetwork && (
            <div className="inline-flex items-center space-x-2 bg-blue-100/80 backdrop-blur-sm rounded-full px-4 py-2 text-blue-800 text-sm font-medium">
              <span>🔧</span>
              <span>Connected to local Hardhat network (Chain ID: {chainId})</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // TODO: Add contract deployment check logic
  // For now, assume it's deployed for development
  const contractDeployed = true;

  if (!contractDeployed) {
    return <ErrorNotDeployed chainId={31337} />;
  }

  const tabs = [
    { id: "submit" as TabType, label: "📝 Submit Resume", description: "Store your resume with encrypted skills", emoji: "📝" },
    { id: "view" as TabType, label: "👁️ View Resume", description: "View your stored resume information", emoji: "👁️" },
    { id: "evaluate" as TabType, label: "🎯 HR Evaluation", description: "Evaluate candidate skills (HR only)", emoji: "🎯" },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="mb-10 text-center">
        <div className="glass-card rounded-3xl p-8 shadow-2xl mb-6">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <span className="text-5xl">💼</span>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Secure Career
            </h1>
          </div>
          <p className="text-gray-700 text-lg mb-4">
            Privacy-preserving resume storage with fully homomorphic encryption
          </p>
          <div className="flex justify-center items-center space-x-3 flex-wrap gap-2">
            <span className={`px-4 py-2 rounded-full text-sm font-medium shadow-md backdrop-blur-sm bg-${networkInfo.color}-100/80 text-${networkInfo.color}-800`}>
              {networkInfo.icon} {networkInfo.status === "local" ? "Local Hardhat Network" :
                                 networkInfo.status === "sepolia" ? "Sepolia Testnet" : "Unknown Network"}
            </span>
            <span className="px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full text-sm text-gray-700 font-medium shadow-md">
              Chain ID: {chainId}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? activeButtonClass : inactiveButtonClass}
            onClick={() => setActiveTab(tab.id)}
          >
            <div className="text-center">
              <div className="text-2xl mb-2">{tab.emoji}</div>
              <div className="font-semibold text-base">{tab.label}</div>
              <div className="text-xs opacity-90 mt-1">{tab.description}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="glass-card rounded-3xl shadow-2xl p-8">
        {activeTab === "submit" && <ResumeSubmission />}
        {activeTab === "view" && <ResumeViewer />}
        {activeTab === "evaluate" && <HREvaluator />}
      </div>

      {/* Info Section */}
      <div className="mt-8 glass-card rounded-3xl p-8 shadow-2xl">
        <div className="flex items-center space-x-3 mb-6">
          <span className="text-3xl">💡</span>
          <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            How It Works
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">📤</div>
            <div className="font-bold text-purple-800 mb-2">1. Submit Resume</div>
            <p className="text-sm text-purple-700 leading-relaxed">
              Store your career information with encrypted skill levels. Your data is protected from day one.
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">🔐</div>
            <div className="font-bold text-blue-800 mb-2">2. Privacy Protection</div>
            <p className="text-sm text-blue-700 leading-relaxed">
              Your sensitive data remains encrypted on-chain. No one can see your actual skill levels without your permission.
            </p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">🎯</div>
            <div className="font-bold text-green-800 mb-2">3. HR Evaluation</div>
            <p className="text-sm text-green-700 leading-relaxed">
              HR can evaluate skill matches without decrypting your data. Privacy-first recruitment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
