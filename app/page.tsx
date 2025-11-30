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

  // Listen for network changes
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const handleChainChanged = async (chainId: string) => {
        const chainIdNum = parseInt(chainId, 16);
        if (chainIdNum !== CHAIN_CONFIG.chainId && account) {
          // Auto-switch back to MegaETH
          try {
            await (window as any).ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${CHAIN_CONFIG.chainId.toString(16)}` }],
            });
          } catch (error) {
            window.location.reload();
          }
        }
      };

      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setAccount('');
        } else {
          setAccount(accounts[0]);
        }
      };

      (window as any).ethereum.on('chainChanged', handleChainChanged);
      (window as any).ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        (window as any).ethereum.removeListener('chainChanged', handleChainChanged);
        (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, [account]);

  const ensureCorrectNetwork = async () => {
    try {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${CHAIN_CONFIG.chainId.toString(16)}` }],
      });
      return true;
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
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
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  };

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

          // Check and switch network if needed
          const network = await web3Provider.getNetwork();
          if (network.chainId !== CHAIN_CONFIG.chainId) {
            await ensureCorrectNetwork();
          }
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
      // First ensure we're on the correct network
      const networkSwitched = await ensureCorrectNetwork();
      if (!networkSwitched) {
        alert('Please add MegaETH Testnet to MetaMask');
        return;
      }

      // Wait for network to fully switch
      await new Promise(resolve => setTimeout(resolve, 500));

      // Then request account access
      await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  const createToken = async () => {
    console.log('Create token clicked');

    if (!factoryContract || !account) {
      alert('Please connect wallet first!');
      return;
    }

    if (!tokenName || !tokenSymbol || !totalSupply) {
      alert('Please fill all fields!');
      return;
    }

    // Auto-switch to correct network if needed
    try {
      const network = await provider!.getNetwork();
      if (network.chainId !== CHAIN_CONFIG.chainId) {
        console.log('Wrong network detected, switching...');
        const switched = await ensureCorrectNetwork();
        if (!switched) {
          alert('Failed to switch to MegaETH Testnet');
          return;
        }
        // Wait for network to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Network check failed:', error);
      alert('Failed to check network. Please try again.');
      return;
    }

    setIsCreating(true);
    try {
      const signer = provider!.getSigner();
      const factoryWithSigner = factoryContract.connect(signer);

      // The contract expects a plain number, not Wei
      // It will multiply by 10^18 internally
      console.log('Creating token with params:', {
        name: tokenName,
        symbol: tokenSymbol,
        supply: totalSupply
      });

      // First, verify the contract exists
      const contractCode = await provider!.getCode(FACTORY_ADDRESS);
      console.log('Factory contract code length:', contractCode.length);

      if (contractCode === '0x') {
        alert('Factory contract not found at this address. The contract may need to be redeployed.');
        setIsCreating(false);
        return;
      }

      console.log('✅ Contract verified at:', FACTORY_ADDRESS);
      console.log('Creating token - skipping gas estimation due to MegaETH v2 testnet limitations');

      // MegaETH v2 testnet has issues with gas estimation
      // Skip estimation and use fixed high gas limit based on builder reports
      // This is the recommended approach per builder-messages
      const tx = await factoryWithSigner.createToken(
        tokenName,
        tokenSymbol,
        totalSupply,  // Send as plain number, contract handles decimals
        {
          gasLimit: 80000000,  // 80M fixed gas limit (same as deployment)
          gasPrice: ethers.utils.parseUnits('0.5', 'gwei'),  // Low gas price for testnet
        }
      );

      console.log('Transaction sent, hash:', tx.hash);
      console.log('Waiting for confirmation...');
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);

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

      // More detailed error messages
      if (error.code === 'ACTION_REJECTED') {
        alert('Transaction was rejected by user');
      } else if (error.data?.message) {
        alert(`Error: ${error.data.message}`);
      } else if (error.message) {
        alert(`Error: ${error.message}`);
      } else {
        alert('Failed to create token. Please check the console for details.');
      }
    }
    setIsCreating(false);
  };

  const loadTokens = async () => {
    if (!factoryContract || !account) return;

    try {
      // Ensure we're on the correct network before loading
      const network = await provider!.getNetwork();
      if (network.chainId !== CHAIN_CONFIG.chainId) {
        console.log('Wrong network, skipping token load');
        return;
      }

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
            <h1 className="text-4xl font-bold glow-text">MegaMint</h1>
            <p className="text-mega-accent mt-2">Create Your Own Token on MegaETH Testnet</p>
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
          <p>Network: MegaETH Timothy Testnet (Chain ID: 6343)</p>
          <p className="mt-2">
            Need test ETH? Get it from{' '}
            <a
              href="https://docs.megaeth.com/faucet"
              target="_blank"
              rel="noopener noreferrer"
              className="text-mega-accent hover:underline"
            >
              MegaETH Faucet
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}