'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CHAIN_CONFIG, FACTORY_ADDRESS, FACTORY_ABI, TOKEN_ABI } from '../lib/factory-config';

interface TokenInfo {
  tokenAddress: string;
  name: string;
  symbol: string;
  totalSupply: string;
  owner: string;
  createdAt: string;
}

export default function TokenFactory() {
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [account, setAccount] = useState<string>('');
  const [factoryContract, setFactoryContract] = useState<ethers.Contract | null>(null);

  // Form states
  const [tokenName, setTokenName] = useState<string>('');
  const [tokenSymbol, setTokenSymbol] = useState<string>('');
  const [totalSupply, setTotalSupply] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  // Token list states
  const [myTokens, setMyTokens] = useState<TokenInfo[]>([]);
  const [allTokens, setAllTokens] = useState<TokenInfo[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>('');

  useEffect(() => {
    initializeWeb3();
  }, []);

  useEffect(() => {
    if (factoryContract && account) {
      loadTokens();
    }
  }, [factoryContract, account]);

  const initializeWeb3 = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const web3Provider = new ethers.providers.Web3Provider((window as any).ethereum);
        setProvider(web3Provider);

        // Initialize factory contract
        const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, web3Provider);
        setFactoryContract(factory);

        // Check if already connected
        const accounts = await web3Provider.listAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        }
      } catch (error) {
        console.error('Error initializing Web3:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (!provider) {
      alert('Please install MetaMask!');
      return;
    }

    try {
      await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);

      // Switch to MegaETH Timothy network
      try {
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${CHAIN_CONFIG.chainId.toString(16)}` }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await (window as any).ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${CHAIN_CONFIG.chainId.toString(16)}`,
              chainName: CHAIN_CONFIG.chainName,
              rpcUrls: CHAIN_CONFIG.rpcUrls,
              nativeCurrency: CHAIN_CONFIG.nativeCurrency,
              blockExplorerUrls: CHAIN_CONFIG.blockExplorerUrls,
            }],
          });
        }
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  const createToken = async () => {
    if (!factoryContract || !account) {
      alert('Please connect wallet first!');
      return;
    }

    if (!tokenName || !tokenSymbol || !totalSupply) {
      alert('Please fill all fields!');
      return;
    }

    setIsCreating(true);
    try {
      const signer = provider!.getSigner();
      const factoryWithSigner = factoryContract.connect(signer);

      // Create new token (owner will be the connected wallet)
      const tx = await factoryWithSigner.createToken(
        tokenName,
        tokenSymbol,
        totalSupply,
        {
          gasLimit: 5000000,
        }
      );

      console.log('Creating token, tx:', tx.hash);
      const receipt = await tx.wait();

      // Get token address from event
      const event = receipt.events?.find((e: any) => e.event === 'TokenCreated');
      const newTokenAddress = event?.args?.tokenAddress;

      alert(`Token created successfully!\nAddress: ${newTokenAddress}\nYou are the owner and have received all ${totalSupply} tokens!`);

      // Clear form
      setTokenName('');
      setTokenSymbol('');
      setTotalSupply('');

      // Reload tokens
      await loadTokens();
    } catch (error: any) {
      console.error('Error creating token:', error);
      alert(`Error: ${error.message}`);
    }
    setIsCreating(false);
  };

  const loadTokens = async () => {
    if (!factoryContract || !account) return;

    try {
      // Load user's tokens
      const userTokens = await factoryContract.getTokensByOwner(account);
      const formattedUserTokens = userTokens.map((token: any) => ({
        tokenAddress: token.tokenAddress,
        name: token.name,
        symbol: token.symbol,
        totalSupply: ethers.utils.formatEther(token.totalSupply),
        owner: token.owner,
        createdAt: new Date(token.createdAt.toNumber() * 1000).toLocaleString(),
      }));
      setMyTokens(formattedUserTokens);

      // Load all tokens
      const allTokensList = await factoryContract.getAllTokens();
      const formattedAllTokens = allTokensList.map((token: any) => ({
        tokenAddress: token.tokenAddress,
        name: token.name,
        symbol: token.symbol,
        totalSupply: ethers.utils.formatEther(token.totalSupply),
        owner: token.owner,
        createdAt: new Date(token.createdAt.toNumber() * 1000).toLocaleString(),
      }));
      setAllTokens(formattedAllTokens);
    } catch (error) {
      console.error('Error loading tokens:', error);
    }
  };

  const addTokenToMetaMask = async (token: TokenInfo) => {
    try {
      await (window as any).ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: token.tokenAddress,
            symbol: token.symbol,
            decimals: 18,
          },
        },
      });
    } catch (error) {
      console.error('Error adding token to MetaMask:', error);
    }
  };

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold glow-text">BMAD Token Factory v.6</h1>
            <p className="text-mega-accent mt-2">Create Your Own Token on MegaETH</p>
          </div>

          <div className="text-right">
            {!account ? (
              <button onClick={connectWallet} className="btn-mega">
                Connect Wallet
              </button>
            ) : (
              <div>
                <p className="text-sm text-gray-400">Connected Account</p>
                <p className="font-mono text-mega-accent">
                  {account.substring(0, 6)}...{account.substring(38)}
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto">
        {/* Create Token Section */}
        <div className="card-mega mb-8">
          <h2 className="text-2xl font-bold mb-6">Create New Token</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Token Name</label>
              <input
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="e.g., My Token"
                className="w-full px-4 py-2 rounded-lg bg-mega-black border border-mega-accent/30 focus:border-mega-accent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Token Symbol</label>
              <input
                type="text"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                placeholder="e.g., MTK"
                maxLength={10}
                className="w-full px-4 py-2 rounded-lg bg-mega-black border border-mega-accent/30 focus:border-mega-accent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Total Supply</label>
              <input
                type="number"
                value={totalSupply}
                onChange={(e) => setTotalSupply(e.target.value)}
                placeholder="e.g., 1000000"
                className="w-full px-4 py-2 rounded-lg bg-mega-black border border-mega-accent/30 focus:border-mega-accent outline-none"
              />
            </div>
          </div>

          <div className="bg-mega-black/50 p-4 rounded-lg mb-6">
            <p className="text-sm text-gray-400">
              ⚠️ Important: You (connected wallet) will be the owner and receive all tokens upon creation
            </p>
          </div>

          <button
            onClick={createToken}
            className="btn-mega w-full md:w-auto"
            disabled={isCreating || !account}
          >
            {isCreating ? 'Creating Token...' : 'Create Token'}
          </button>
        </div>

        {/* My Tokens */}
        {myTokens.length > 0 && (
          <div className="card-mega mb-8">
            <h2 className="text-2xl font-bold mb-4">My Tokens</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-mega-accent/20">
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Symbol</th>
                    <th className="text-left py-2">Supply</th>
                    <th className="text-left py-2">Address</th>
                    <th className="text-left py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {myTokens.map((token, index) => (
                    <tr key={index} className="border-b border-mega-accent/10">
                      <td className="py-2">{token.name}</td>
                      <td className="py-2">{token.symbol}</td>
                      <td className="py-2">{token.totalSupply}</td>
                      <td className="py-2">
                        <a
                          href={`${CHAIN_CONFIG.blockExplorerUrls[0]}address/${token.tokenAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-mega-accent hover:underline font-mono text-xs"
                        >
                          {token.tokenAddress.substring(0, 8)}...
                        </a>
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => addTokenToMetaMask(token)}
                          className="text-mega-accent hover:underline text-sm"
                        >
                          Add to MetaMask
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* All Tokens */}
        <div className="card-mega">
          <h2 className="text-2xl font-bold mb-4">All Created Tokens ({allTokens.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-mega-accent/20">
                  <th className="text-left py-2">Name</th>
                  <th className="text-left py-2">Symbol</th>
                  <th className="text-left py-2">Supply</th>
                  <th className="text-left py-2">Owner</th>
                  <th className="text-left py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {allTokens.map((token, index) => (
                  <tr key={index} className="border-b border-mega-accent/10">
                    <td className="py-2">{token.name}</td>
                    <td className="py-2">{token.symbol}</td>
                    <td className="py-2">{token.totalSupply}</td>
                    <td className="py-2 font-mono text-xs">
                      {token.owner.substring(0, 8)}...
                    </td>
                    <td className="py-2 text-xs">{token.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Network Info */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>Factory Contract: {FACTORY_ADDRESS}</p>
          <p>Network: MegaETH Timothy Testnet (Chain ID: 6343)</p>
        </div>
      </main>
    </div>
  );
}