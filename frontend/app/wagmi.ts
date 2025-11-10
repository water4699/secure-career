import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { hardhat, sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Secure Career',
  projectId: 'ef3325a718834a2b1b4134d3f520933d',
  chains: [
    hardhat,
    {
      ...sepolia,
      rpcUrls: {
        default: {
          http: ['https://sepolia.infura.io/v3/b18fb7e6ca7045ac83c41157ab93f990'],
        },
        public: {
          http: ['https://sepolia.infura.io/v3/b18fb7e6ca7045ac83c41157ab93f990'],
        },
      },
    },
  ],
  ssr: false,
});
