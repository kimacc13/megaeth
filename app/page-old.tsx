'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CHAIN_CONFIG, CONTRACT_ABI, CONTRACT_ADDRESS } from '../lib/config-simple';

export default function Home() {
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [account, setAccount] = useState<string>('');
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [totalSupply, setTotalSupply] = useState<string>('0');
  const [mintAmount, setMintAmount] = useState<string>('100');
  const [transferTo, setTransferTo] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Initialize Web3
  useEffect(() => {
    initializeWeb3();
  }, []);

  const initializeWeb3 = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const web3Provider = new ethers.providers.Web3Provider((window as any).ethereum);
        setProvider(web3Provider);

        // Initialize contract
        const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, web3Provider);
        setContract(contractInstance);

        // Check if already connected
        const accounts = await web3Provider.listAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          await loadContractData(contractInstance, accounts[0]);
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
      // Request account access
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
        // This error code indicates that the chain has not been added to MetaMask
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

  const loadContractData = async (contractInstance: ethers.Contract, userAccount?: string) => {
    try {
      const supply = await contractInstance.totalSupply();
      setTotalSupply(ethers.utils.formatEther(supply));

      const accountToCheck = userAccount || account;
      if (accountToCheck) {
        const bal = await contractInstance.balanceOf(accountToCheck);
        setBalance(ethers.utils.formatEther(bal));
      }
    } catch (error) {
      console.error('Error loading contract data:', error);
    }
  };

  const mint = async () => {
    if (!contract || !account) {
      alert('Please connect wallet first!');
      return;
    }

    setIsLoading(true);
    try {
      const signer = provider!.getSigner();
      const contractWithSigner = contract.connect(signer);

      const amount = ethers.utils.parseEther(mintAmount);

      // SimpleBMAD has free minting
      const tx = await contractWithSigner.mint(amount, {
        gasLimit: 500000,
      });

      await tx.wait();
      await loadContractData(contract);
      alert('Mint successful!');
    } catch (error: any) {
      console.error('Mint error:', error);
      alert(`Error: ${error.message}`);
    }
    setIsLoading(false);
  };

  const transfer = async () => {
    if (!contract || !account || !transferTo || !transferAmount) {
      alert('Please fill all fields!');
      return;
    }

    setIsLoading(true);
    try {
      const signer = provider!.getSigner();
      const contractWithSigner = contract.connect(signer);

      const amount = ethers.utils.parseEther(transferAmount);
      const tx = await contractWithSigner.transfer(transferTo, amount, {
        gasLimit: 200000,
      });

      await tx.wait();
      await loadContractData(contract);
      alert('Transfer successful!');
    } catch (error: any) {
      console.error('Transfer error:', error);
      alert(`Error: ${error.message}`);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold glow-text">BMAD v.6</h1>
            <p className="text-mega-accent mt-2">Powered by MegaETH Timothy Testnet</p>
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
        {/* Contract Info */}
        {CONTRACT_ADDRESS && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="card-mega">
              <h3 className="text-lg font-semibold mb-2">Contract Address</h3>
              <p className="font-mono text-sm text-mega-accent break-all">{CONTRACT_ADDRESS}</p>
            </div>

            <div className="card-mega">
              <h3 className="text-lg font-semibold mb-2">Contract Stats</h3>
              <p>Total Supply: <span className="text-mega-accent">{totalSupply} BMAD</span></p>
              <p>Your Balance: <span className="text-mega-accent">{balance} BMAD</span></p>
            </div>
          </div>
        )}

        {/* Actions */}
        {CONTRACT_ADDRESS && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mint Section */}
            <div className="card-mega">
              <h3 className="text-xl font-bold mb-4">Mint BMAD Tokens</h3>
              <input
                type="number"
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                placeholder="Amount to mint"
                className="w-full px-4 py-2 rounded-lg bg-mega-black border border-mega-accent/30 focus:border-mega-accent outline-none mb-4"
              />
              <button
                onClick={mint}
                className="btn-mega w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Mint Tokens'}
              </button>
            </div>

            {/* Transfer Section */}
            <div className="card-mega">
              <h3 className="text-xl font-bold mb-4">Transfer Tokens</h3>
              <input
                type="text"
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                placeholder="Recipient address"
                className="w-full px-4 py-2 rounded-lg bg-mega-black border border-mega-accent/30 focus:border-mega-accent outline-none mb-2"
              />
              <input
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="Amount to transfer"
                className="w-full px-4 py-2 rounded-lg bg-mega-black border border-mega-accent/30 focus:border-mega-accent outline-none mb-4"
              />
              <button
                onClick={transfer}
                className="btn-outline w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Transfer'}
              </button>
            </div>
          </div>
        )}

        {/* Network Info */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>Network: MegaETH Timothy Testnet (Chain ID: 6343)</p>
          <p>RPC: https://timothy.megaeth.com/rpc</p>
          <a
            href="https://docs.megaeth.com/faucet"
            target="_blank"
            rel="noopener noreferrer"
            className="text-mega-accent hover:underline"
          >
            Get Test ETH from Faucet
          </a>
        </div>
      </main>
    </div>
  );
}