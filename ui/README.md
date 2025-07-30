# 8inch Cross-Chain Swap UI

A modern, responsive user interface for cross-chain swaps between EVM chains and Aptos blockchain built with Next.js, Tailwind CSS, and shadcn/ui.

## Features

- 🔗 **Multi-Chain Support**: Ethereum, BSC, Arbitrum, Optimism, Polygon, and Aptos
- 👛 **Multi-Wallet Integration**: MetaMask, WalletConnect, Petra, Martian, Pontem
- ⚡ **Modern UI**: Built with shadcn/ui components and Tailwind CSS
- 🔄 **Real-time Updates**: Live transaction status and cross-chain monitoring
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile
- 🎨 **Dark Mode**: Beautiful dark/light theme support

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **EVM Wallets**: RainbowKit + Wagmi
- **Aptos Wallets**: Aptos Wallet Adapter
- **Web3 Libraries**: 
  - Ethers.js v6 (EVM chains)
  - Aptos SDK (Aptos blockchain)
  - 1inch Cross-Chain SDK
- **Icons**: Lucide React
- **Notifications**: React Hot Toast

## Quick Start

1. **Install Dependencies**
   ```bash
   cd ui
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Open in Browser**
   ```
   http://localhost:3000
   ```

## Environment Variables

Create a `.env.local` file in the `ui` directory:

```bash
# Required API Keys
NEXT_PUBLIC_1INCH_API_KEY=your_1inch_dev_portal_key
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# Optional: Custom RPC endpoints
NEXT_PUBLIC_ETHEREUM_RPC=https://eth.merkle.io
NEXT_PUBLIC_BSC_RPC=https://bsc-dataseed.binance.org
NEXT_PUBLIC_APTOS_RPC=https://fullnode.mainnet.aptoslabs.com/v1

# Backend API endpoint
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

## Project Structure

```
ui/
├── src/
│   ├── app/                 # Next.js app router
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Home page
│   │   └── globals.css      # Global styles
│   ├── components/          # React components
│   │   ├── ui/              # shadcn/ui components
│   │   ├── layout/          # Layout components
│   │   └── swap/            # Swap interface components
│   ├── lib/                 # Utility functions
│   │   ├── utils.ts         # General utilities
│   │   └── wagmi.ts         # Wagmi configuration
│   ├── store/               # Zustand stores
│   │   └── swap.ts          # Swap state management
│   └── types/               # TypeScript definitions
├── public/                  # Static assets
├── tailwind.config.js       # Tailwind configuration
├── next.config.js           # Next.js configuration
└── package.json             # Dependencies
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript checks

## Component Overview

### Core Components

- **SwapInterface**: Main swap form with token/chain selection
- **TokenSelector**: Dropdown for token selection with search
- **ChainSelector**: Network selection dropdown
- **SwapButton**: Smart swap button with validation
- **Header**: Navigation with wallet connection buttons

### Wallet Integration

- **EVM Wallets**: MetaMask, WalletConnect, Coinbase Wallet
- **Aptos Wallets**: Petra, Martian, Pontem
- **Multi-chain state**: Automatic wallet switching

## Development Notes

1. **Adding New Chains**: Update `defaultChains` in `src/store/swap.ts`
2. **Adding New Tokens**: Update `mockTokens` in `src/components/swap/token-selector.tsx`
3. **Custom Styling**: Modify `tailwind.config.js` and CSS variables in `globals.css`
4. **API Integration**: Update endpoints in `src/lib/api.ts`

## Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy to Vercel (recommended)**
   ```bash
   npx vercel --prod
   ```

3. **Or deploy to any static hosting**
   ```bash
   npm run build && npm run export
   ```

## Integration with Backend

The UI connects to the backend API running on port 3000. Make sure to:

1. Start the backend server: `npm run dev` (from root directory)
2. Ensure CORS is configured for frontend domain
3. Update API endpoints in environment variables

## Contributing

1. Follow the existing code style
2. Use TypeScript for all new components
3. Add proper prop types and interfaces
4. Test on multiple wallets and chains
5. Ensure responsive design

## Troubleshooting

**Wallet Connection Issues**:
- Ensure WalletConnect Project ID is set
- Check that wallet extensions are installed
- Verify network configurations

**Build Errors**:
- Clear `.next` cache: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check TypeScript errors: `npm run type-check`

**Styling Issues**:
- Ensure Tailwind CSS is properly configured
- Check for CSS conflicts
- Verify shadcn/ui component installations

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [RainbowKit](https://rainbowkit.com/)
- [Aptos Wallet Adapter](https://aptos.dev/integration/wallet-adapter-concept)
- [1inch Cross-Chain SDK](https://github.com/1inch/cross-chain-sdk)
