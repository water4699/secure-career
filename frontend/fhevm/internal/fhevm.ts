import { isAddress, Eip1193Provider, JsonRpcProvider } from "ethers";
import type {
  FhevmInitSDKOptions,
  FhevmInitSDKType,
  FhevmLoadSDKType,
  FhevmWindowType,
} from "./fhevmTypes";
import { isFhevmWindowType, RelayerSDKLoader } from "./RelayerSDKLoader";
import { publicKeyStorageGet, publicKeyStorageSet } from "./PublicKeyStorage";
import { FhevmInstance, FhevmInstanceConfig } from "../fhevmTypes";

export class FhevmReactError extends Error {
  code: string;
  constructor(code: string, message?: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.name = "FhevmReactError";
  }
}

function throwFhevmError(
  code: string,
  message?: string,
  cause?: unknown
): never {
  throw new FhevmReactError(code, message, cause ? { cause } : undefined);
}

const isFhevmInitialized = (): boolean => {
  if (!isFhevmWindowType(window, console.log)) {
    return false;
  }
  return window.relayerSDK.__initialized__ === true;
};

const fhevmLoadSDK: FhevmLoadSDKType = () => {
  const loader = new RelayerSDKLoader({ trace: console.log });
  return loader.load();
};

const fhevmInitSDK: FhevmInitSDKType = async (
  options?: FhevmInitSDKOptions
) => {
  if (!isFhevmWindowType(window, console.log)) {
    throw new Error("window.relayerSDK is not available");
  }
  const result = await window.relayerSDK.initSDK(options);
  window.relayerSDK.__initialized__ = result;
  if (!result) {
    throw new Error("window.relayerSDK.initSDK failed.");
  }
  return true;
};

function checkIsAddress(a: unknown): a is `0x${string}` {
  if (typeof a !== "string") {
    return false;
  }
  if (!isAddress(a)) {
    return false;
  }
  return true;
}

export class FhevmAbortError extends Error {
  constructor(message = "FHEVM operation was cancelled") {
    super(message);
    this.name = "FhevmAbortError";
  }
}

type FhevmRelayerStatusType =
  | "sdk-loading"
  | "sdk-loaded"
  | "sdk-initializing"
  | "sdk-initialized"
  | "creating";

async function getChainId(
  providerOrUrl: Eip1193Provider | string
): Promise<number> {
  if (typeof providerOrUrl === "string") {
    const provider = new JsonRpcProvider(providerOrUrl);
    return Number((await provider.getNetwork()).chainId);
  }
  const chainId = await providerOrUrl.request({ method: "eth_chainId" });
  return Number.parseInt(chainId as string, 16);
}

async function getWeb3Client(rpcUrl: string) {
  const rpc = new JsonRpcProvider(rpcUrl);
  try {
    const version = await rpc.send("web3_clientVersion", []);
    return version;
  } catch (e) {
    throwFhevmError(
      "WEB3_CLIENTVERSION_ERROR",
      `The URL ${rpcUrl} is not a Web3 node or is not reachable. Please check the endpoint.`,
      e
    );
  } finally {
    rpc.destroy();
  }
}

async function tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl: string): Promise<
  | {
      ACLAddress: `0x${string}`;
      InputVerifierAddress: `0x${string}`;
      KMSVerifierAddress: `0x${string}`;
    }
  | undefined
> {
  const version = await getWeb3Client(rpcUrl);
  if (
    typeof version !== "string" ||
    !version.toLowerCase().includes("hardhat")
  ) {
    // Not a Hardhat Node
    return undefined;
  }
  try {
    const metadata = await getFHEVMRelayerMetadata(rpcUrl);
    if (!metadata || typeof metadata !== "object") {
      return undefined;
    }
    if (
      !(
        "ACLAddress" in metadata &&
        typeof metadata.ACLAddress === "string" &&
        metadata.ACLAddress.startsWith("0x")
      )
    ) {
      return undefined;
    }
    if (
      !(
        "InputVerifierAddress" in metadata &&
        typeof metadata.InputVerifierAddress === "string" &&
        metadata.InputVerifierAddress.startsWith("0x")
      )
    ) {
      return undefined;
    }
    if (
      !(
        "KMSVerifierAddress" in metadata &&
        typeof metadata.KMSVerifierAddress === "string" &&
        metadata.KMSVerifierAddress.startsWith("0x")
      )
    ) {
      return undefined;
    }
    return metadata;
  } catch {
    // Not a FHEVM Hardhat Node
    return undefined;
  }
}

async function getFHEVMRelayerMetadata(rpcUrl: string) {
  const rpc = new JsonRpcProvider(rpcUrl);
  try {
    const version = await rpc.send("fhevm_relayer_metadata", []);
    return version;
  } catch (e) {
    throwFhevmError(
      "FHEVM_RELAYER_METADATA_ERROR",
      `The URL ${rpcUrl} is not a FHEVM Hardhat node or is not reachable. Please check the endpoint.`,
      e
    );
  } finally {
    rpc.destroy();
  }
}

type MockResolveResult = { isMock: true; chainId: number; rpcUrl: string };
type GenericResolveResult = { isMock: false; chainId: number; rpcUrl?: string };
type ResolveResult = MockResolveResult | GenericResolveResult;

async function resolve(
  providerOrUrl: Eip1193Provider | string,
  mockChains?: Record<number, string>
): Promise<ResolveResult> {
  try {
    const chainId = await getChainId(providerOrUrl);
    let rpcUrl = typeof providerOrUrl === "string" ? providerOrUrl : undefined;

    const _mockChains: Record<number, string> = {
      31337: "http://localhost:8545",
      ...(mockChains ?? {}),
    };

    // For localhost (31337) or explicitly listed mock chains, check if it's a FHEVM Hardhat node
    if (Object.hasOwn(_mockChains, chainId)) {
      if (!rpcUrl) {
        rpcUrl = _mockChains[chainId];
      }
      // Return as mock - we'll check for FHEVM metadata later
      return { isMock: true, chainId, rpcUrl };
    }

    return { isMock: false, chainId, rpcUrl };
  } catch (error: any) {
    // Handle connection errors gracefully
    if (typeof providerOrUrl === "string") {
      const _mockChains: Record<number, string> = {
        31337: "http://localhost:8545",
        ...(mockChains ?? {}),
      };
      
      // Check if URL matches any mock chain
      for (const [chainId, url] of Object.entries(_mockChains)) {
        if (providerOrUrl === url || providerOrUrl.includes(url.replace("http://", "").replace("https://", ""))) {
          console.debug(`[FHEVM] Using mock chain ${chainId} for ${providerOrUrl} (chainId fetch failed but URL matches)`);
          return { isMock: true, chainId: Number(chainId), rpcUrl: providerOrUrl };
        }
      }
      
      // If it's localhost, assume it's mock chain 31337
      if (providerOrUrl.includes("localhost") || providerOrUrl.includes("127.0.0.1")) {
        console.debug(`[FHEVM] Assuming localhost URL ${providerOrUrl} is mock chain 31337`);
        return { isMock: true, chainId: 31337, rpcUrl: providerOrUrl };
      }
    }
    
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes("Failed to fetch") || errorMessage.includes("fetch")) {
      if (typeof providerOrUrl === "string") {
        const _mockChains: Record<number, string> = {
          31337: "http://localhost:8545",
          ...(mockChains ?? {}),
        };
        
        for (const [chainId, url] of Object.entries(_mockChains)) {
          if (providerOrUrl === url || providerOrUrl.includes(url.replace("http://", "").replace("https://", ""))) {
            return { isMock: true, chainId: Number(chainId), rpcUrl: providerOrUrl };
          }
        }
        
        if (providerOrUrl.includes("localhost") || providerOrUrl.includes("127.0.0.1")) {
          return { isMock: true, chainId: 31337, rpcUrl: providerOrUrl };
        }
      }
    }
    throw error;
  }
}

export const createFhevmInstance = async (parameters: {
  provider: Eip1193Provider | string;
  mockChains?: Record<number, string>;
  signal: AbortSignal;
  onStatusChange?: (status: FhevmRelayerStatusType) => void;
}): Promise<FhevmInstance> => {
  const throwIfAborted = () => {
    if (signal.aborted) throw new FhevmAbortError();
  };

  const notify = (status: FhevmRelayerStatusType) => {
    if (onStatusChange) onStatusChange(status);
  };

  const {
    signal,
    onStatusChange,
    provider: providerOrUrl,
    mockChains,
  } = parameters;

  // Resolve chainId
  let isMock: boolean;
  let rpcUrl: string | undefined;
  let chainId: number;
  
  try {
    const resolved = await resolve(providerOrUrl, mockChains);
    isMock = resolved.isMock;
    rpcUrl = resolved.rpcUrl;
    chainId = resolved.chainId;
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes("Failed to fetch") || errorMessage.includes("fetch")) {
      // Connection failed, but for localhost we should still try to use mock
      isMock = false;
      rpcUrl = typeof providerOrUrl === "string" ? providerOrUrl : undefined;
      chainId = 0;
    } else {
      throw error;
    }
  }

  // For localhost (31337) or explicitly listed mock chains, check if it's a FHEVM Hardhat node
  if (isMock && rpcUrl) {
    console.log("[FHEVM] Detected mock chain, attempting to fetch Hardhat node metadata...", {
      chainId,
      rpcUrl,
    });
    
    // Try to fetch FHEVM metadata from Hardhat node
    // This will return undefined if not a FHEVM Hardhat node
    const fhevmRelayerMetadata =
      await tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl);

    if (fhevmRelayerMetadata) {
      // fhevmRelayerMetadata is defined, which means rpcUrl refers to a FHEVM Hardhat Node
      // Use MockFhevmInstance which connects to the real FHEVM Hardhat node
      console.log("[FHEVM] Hardhat node FHEVM metadata found, using mock instance with real FHEVM:", fhevmRelayerMetadata);
      notify("creating");

      //////////////////////////////////////////////////////////////////////////
      // 
      // WARNING!!
      // ALWAYS USE DYNAMIC IMPORT TO AVOID INCLUDING THE ENTIRE FHEVM MOCK LIB 
      // IN THE FINAL PRODUCTION BUNDLE!!
      // 
      //////////////////////////////////////////////////////////////////////////
      const fhevmMock = await import("./mock/fhevmMock");
      const mockInstance = await fhevmMock.fhevmMockCreateInstance({
        rpcUrl,
        chainId,
        metadata: fhevmRelayerMetadata,
      });

      throwIfAborted();
      console.log("[FHEVM] Mock FHEVM instance created successfully (connected to real FHEVM Hardhat node)");
      return mockInstance;
    } else {
      console.warn("[FHEVM] Hardhat node FHEVM metadata not found. This may cause issues if Hardhat node is not running with FHEVM support.");
    }
  }

  throwIfAborted();

  if (!isFhevmWindowType(window, console.log)) {
    notify("sdk-loading");

    // throws an error if failed
    await fhevmLoadSDK();
    throwIfAborted();

    notify("sdk-loaded");
  }

  // notify that state === "sdk-loaded"

  if (!isFhevmInitialized()) {
    notify("sdk-initializing");

    // throws an error if failed
    await fhevmInitSDK();
    throwIfAborted();

    notify("sdk-initialized");
  }

  const relayerSDK = (window as unknown as FhevmWindowType).relayerSDK;

  const aclAddress = relayerSDK.SepoliaConfig.aclContractAddress;
  if (!checkIsAddress(aclAddress)) {
    throw new Error(`Invalid address: ${aclAddress}`);
  }

  const pub = await publicKeyStorageGet(aclAddress);
  throwIfAborted();

  const config: FhevmInstanceConfig = {
    ...relayerSDK.SepoliaConfig,
    network: providerOrUrl,
    publicKey: pub.publicKey,
    publicParams: pub.publicParams,
  };

  // notify that state === "creating"
  notify("creating");

  const instance = await relayerSDK.createInstance(config);

  // Save the key even if aborted
  await publicKeyStorageSet(
    aclAddress,
    instance.getPublicKey(),
    instance.getPublicParams(2048)
  );

  throwIfAborted();

  return instance;
};
