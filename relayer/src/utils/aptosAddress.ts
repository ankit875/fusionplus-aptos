import { Address } from '@1inch/cross-chain-sdk';

export class AptosAddress {
    readonly address: string;

    constructor(address: string) {
        this.address = this.normalizeAndValidate(address);
    }

    private normalizeAndValidate(address: string): string {
        // Normalize: ensure 0x prefix
        const cleanAddress = address.startsWith('0x') ? address : `0x${address}`;
        
        // Validate: must be exactly 66 characters (0x + 64 hex chars)
        if (!/^0x[0-9a-fA-F]{64}$/.test(cleanAddress)) {
            throw new Error(`Invalid Aptos address: ${address}. Expected 66 characters (0x + 64 hex chars)`);
        }
        
        return cleanAddress.toLowerCase(); // Normalize to lowercase
    }

    toString(): string {
        return this.address;
    }

    toEvmAddress(): Address {
        const ethCompatible = '0x' + this.address.slice(-40);
        return new Address(ethCompatible);
    }

    equals(other: string | AptosAddress): boolean {
        const otherAddress = other instanceof AptosAddress ? other.address : other;
        return this.address.toLowerCase() === otherAddress.toLowerCase();
    }


    static fromString(address: string): AptosAddress {
        return new AptosAddress(address);
    }
}

export function isAptosAddress(address: string): boolean {
    return address.startsWith('0x') && address.length === 66 && /^0x[0-9a-fA-F]{64}$/.test(address);
}

export function aptosToEthereumAddress(aptosAddress: string): Address {
    const aptos = new AptosAddress(aptosAddress);
    return aptos.toEvmAddress();
}

const addressMappings = new Map<string, string>();

export function storeAddressMapping(ethAddress: string, aptosAddress: string): void {
    const normalizedEth = ethAddress.toLowerCase();
    const normalizedAptos = new AptosAddress(aptosAddress).toString();
    
    addressMappings.set(normalizedEth, normalizedAptos);
    console.log(`📋 Stored address mapping: ${normalizedEth} -> ${normalizedAptos}`);
}

export function getOriginalAptosAddress(ethAddress: string): string | undefined {
    const originalAddress = addressMappings.get(ethAddress.toLowerCase());
    if (originalAddress) {
        console.log(`📋 Found original Aptos address: ${originalAddress} for ${ethAddress}`);
    }
    return originalAddress;
}

export function getAptosReceiverAddress(orderInstance: any): string {
    const ethReceiverAddress = orderInstance.receiver?.toString();
    if (!ethReceiverAddress) {
        throw new Error('No receiver address found in order');
    }
    
    const originalAptosAddress = getOriginalAptosAddress(ethReceiverAddress);
    if (originalAptosAddress) {
        console.log(`📋 Using original Aptos address: ${originalAptosAddress}`);
        return originalAptosAddress;
    }
    
    console.log(`📋 Using address as-is: ${ethReceiverAddress}`);
    return ethReceiverAddress;
}

export function createReceiverAddress(receiverAddress: string): Address {
    if (isAptosAddress(receiverAddress)) {
        console.log('📋 Converting Aptos address for SDK compatibility');
        const aptosAddr = new AptosAddress(receiverAddress);
        const ethAddr = aptosAddr.toEvmAddress();
        
        // Store mapping for later retrieval
        storeAddressMapping(ethAddr.toString(), receiverAddress);
        
        return ethAddr;
    } else {
        console.log('📋 Using Ethereum address as-is');
        return new Address(receiverAddress);
    }
}

export function getAddressInfo(address: string): {
    type: 'aptos' | 'ethereum';
    original: string;
    normalized: string;
    ethCompatible: string;
} {
    if (isAptosAddress(address)) {
        const aptosAddr = new AptosAddress(address);
        return {
            type: 'aptos',
            original: address,
            normalized: aptosAddr.toString(),
            ethCompatible: aptosAddr.toEvmAddress().toString()
        };
    } else {
        const ethAddr = new Address(address);
        return {
            type: 'ethereum',
            original: address,
            normalized: ethAddr.toString(),
            ethCompatible: ethAddr.toString()
        };
    }
}
