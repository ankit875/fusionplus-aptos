export interface QuoterResponse {
    srcChainId: string;
    dstChainId: string;
    srcTokenAddress: string;
    dstTokenAddress: string;
    srcAmount: string;
    dstAmount: string;
    exchangeRate: number;
    estimatedGas: string;
    gasPrice: string;
    fees: {
        protocolFee: string;
        gasFee: string;
    };
    route: {
        from: string;
        to: string;
        exchange: string;
    }[];
    timestamp: string;
    validUntil: string;
}

export interface SerializedOrder {
    limitOrder: {
        maker: string;
        makerAsset: string;
        takerAsset: string;
        makerTraits: string;
        salt: string;
        makingAmount: string;
        takingAmount: string;
        receiver: string;
    };
    orderHash: string;
    extension: string;
}