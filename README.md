# 1inch Fusion+ Cross-Chain Swap Extension
## Ethereum ↔ Aptos Bridge

A novel extension for 1inch Cross-chain Swap (Fusion+) that enables seamless token swaps between Ethereum and Aptos blockchains using atomic swap protocols with hashlock and timelock mechanisms with WebSocket relayer for seamless order matching.

## 🌟 Features

- **Bidirectional Swaps**: Swap tokens from Ethereum to Aptos and vice versa
- **Atomic Swap Protocol**: Secure cross-chain transfers using hashlock and timelock
- **Non-EVM Compatibility**: Full implementation for Aptos (Move language) alongside Ethereum (Solidity)
- **Testnet Ready**: Deployed and tested on Ethereum Sepolia and Aptos Testnet
- **User-Friendly UI**: Intuitive interface for initiating and monitoring cross-chain swaps
- **1inch Integration**: Built as an extension to leverage 1inch's existing infrastructure

## 🏗️ Architecture

### Atomic Swap Flow

```
Ethereum User (Alice)                    Aptos User (Bob)
        |                                        |
        | 1. Initiate swap with hashlock         |
        |    and timelock                        |
        |----------------------------------------|
        |                                        |
        |                              2. Verify and lock tokens
        |                                 with same hash
        |                                        |
        | 3. Reveal secret to claim              |
        |    Bob's tokens                        |
        |<---------------------------------------|
        |                                        |
        |                              4. Use revealed secret
        |                                 to claim Alice's tokens
```

## 🔐 Security Mechanisms

### Key Security Features
- No trusted intermediaries required
- Funds are never at risk of being stolen
- Automatic refund mechanism for failed swaps
- Cryptographically secure secret generation

## 🚀 Quick Start

### Prerequisites

- Node.js >= 16.0.0
- Yarn or npm
- MetaMask wallet (for Ethereum)
- Petra wallet (for Aptos)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/ankit875/fusionplus-aptos.git
cd fusionplus-aptos

# Install dependencies
yarn install

# Copy environment variables
cp .env.example .env

# Configure your environment variables
nano .env
```

### Environment Configuration

```bash
# Ethereum Configuration
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
ETHEREUM_PRIVATE_KEY=your_private_key_here
ETHEREUM_CONTRACT_ADDRESS=0x...

# Aptos Configuration
APTOS_RPC_URL=https://fullnode.testnet.aptoslabs.com/v1
APTOS_PRIVATE_KEY=your_private_key_here
APTOS_CONTRACT_ADDRESS=0x...

# 1inch API
ONEINCH_API_KEY=your_api_key_here
```

### Deployment

```bash
# Start the frontend
cd ui
bun install
bun start
```

## 📱 Usage

### Initiating a Swap (Ethereum → Aptos)

1. **Connect Wallets**
   - Connect MetaMask for Ethereum
   - Connect Petra for Aptos

2. **Configure Swap**
   - Select source token (Ethereum)
   - Select destination token (Aptos)
   - Enter swap amount

3. **Initiate Transaction**
   - Generate secret hash
   - Lock tokens on Ethereum with hashlock and timelock
   - Share hash with counterparty

4. **Complete Swap**
   - Counterparty locks tokens on Aptos
   - Reveal secret to claim Aptos tokens
   - Counterparty uses secret to claim Ethereum tokens

### Monitoring Swaps

- **Real-time Status**: Track swap progress in the UI
- **Transaction History**: View all past swaps
- **Refund Options**: Automatic refund after timelock expiration

## 🧪 Testing & Demo

### Testnet Information

- **Ethereum**: Sepolia Testnet
- **Aptos**: Aptos Testnet
- **Faucets**: 
  - [Sepolia ETH Faucet](https://sepoliafaucet.com/)
  - [Aptos Faucet](https://aptoslabs.com/testnet-faucet)

### Demo Scenarios

1. **ETH → APT Swap**
   - Swap 0.1 ETH for 10 APT tokens
   - Demonstrate hashlock/timelock functionality
   - Show successful atomic swap completion

2. **APT → ETH Swap**
   - Reverse swap: 10 APT for 0.1 ETH
   - Showcase bidirectional capability
   - Verify non-EVM implementation

3. **Failed Swap Recovery**
   - Initiate swap but don't complete
   - Demonstrate automatic refund after timelock

### Running Tests

```bash
# Run Ethereum contract tests
yarn test:ethereum

# Run Aptos contract tests
yarn test:aptos

# Run integration tests
yarn test:integration

# Run end-to-end tests
yarn test:e2e
```

## 🔧 API Documentation

### WebSocket Events

- `swap_initiated` - New swap created
- `swap_completed` - Swap successfully finished
- `swap_refunded` - Swap refunded due to timeout
- `block_update` - New block information

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/ankit875/fusionplus-aptos/issues)
- **Discord**: [Community Chat](https://discord.gg/ankitagrwal)
- **Email**: support@yourproject.com

## 🙏 Acknowledgments

- [1inch Network](https://1inch.io/) for the Fusion+ infrastructure
- [Aptos Labs](https://aptoslabs.com/) for Move language support
- [Ethereum Foundation](https://ethereum.org/) for EVM compatibility

## 🗺️ Roadmap

- [ ] Mainnet deployment
- [ ] Additional token support
- [ ] Mobile app development
- [ ] Advanced routing algorithms
- [ ] Integration with more DEXs
- [ ] Layer 2 support (Polygon, Arbitrum)

---

**⚠️ Disclaimer**: This is experimental software. Use at your own risk. Always test thoroughly on testnets before mainnet deployment.