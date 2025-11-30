const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const solc = require('solc');

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const RPC_URL = process.env.RPC_URL || 'https://timothy.megaeth.com/rpc';

if (!PRIVATE_KEY) {
  console.error('❌ Error: PRIVATE_KEY environment variable is not set');
  console.log('Please create a .env file with: PRIVATE_KEY=your_private_key_here');
  process.exit(1);
}

async function main() {
  console.log('🚀 Starting TokenFactory deployment on MegaETH Timothy Testnet...\n');

  // Connect to provider
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log('📡 Connected to:', RPC_URL);
  console.log('💳 Deployer address:', wallet.address);

  // Get balance
  const balance = await provider.getBalance(wallet.address);
  console.log('💰 Balance:', ethers.utils.formatEther(balance), 'ETH\n');

  if (balance.lt(ethers.utils.parseEther('0.1'))) {
    console.log('⚠️  Balance too low! Please get test ETH from: https://docs.megaeth.com/faucet');
    process.exit(1);
  }

  // Compile contract
  console.log('📝 Compiling TokenFactory contract...');
  const contractPath = path.join(__dirname, '../contracts/TokenFactory.sol');
  const contractSource = fs.readFileSync(contractPath, 'utf8');

  const input = {
    language: 'Solidity',
    sources: {
      'TokenFactory.sol': {
        content: contractSource,
      },
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode'],
        },
      },
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    let hasError = false;
    output.errors.forEach((err) => {
      if (err.severity === 'error') {
        console.error('❌ Compilation error:', err.formattedMessage);
        hasError = true;
      }
    });
    if (hasError) process.exit(1);
  }

  const factoryContract = output.contracts['TokenFactory.sol']['TokenFactory'];
  const bytecode = '0x' + factoryContract.evm.bytecode.object;
  const abi = factoryContract.abi;

  console.log('✅ Contract compiled successfully!');
  console.log('📏 Bytecode length:', bytecode.length, 'characters\n');

  // Deploy contract
  console.log('🔨 Deploying TokenFactory contract...');

  try {
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);

    // Deploy with very high gas settings for Timothy testnet v2
    // Based on builder messages - v2 requires 60-80M gas for complex contracts
    const deployTx = await factory.deploy({
      gasLimit: 80000000, // 80M gas limit as per builder reports
      gasPrice: ethers.utils.parseUnits('0.5', 'gwei'), // Very low gas price to keep cost down
    });

    console.log('📤 Transaction hash:', deployTx.deployTransaction.hash);
    console.log('⏳ Waiting for confirmation (this may take a while)...');

    // Wait for confirmation
    const receipt = await deployTx.deployTransaction.wait(2);

    console.log('\n✅ TokenFactory contract deployed successfully!');
    console.log('📍 Factory address:', deployTx.address);
    console.log('🔗 Explorer:', `https://megaeth-testnet-v2.blockscout.com/address/${deployTx.address}`);
    console.log('⛽ Gas used:', receipt.gasUsed.toString());

    // Save deployment info
    const deploymentInfo = {
      network: 'MegaETH Timothy Testnet',
      chainId: 6343,
      factoryAddress: deployTx.address,
      deployerAddress: wallet.address,
      transactionHash: deployTx.deployTransaction.hash,
      abi: abi,
      tokenAbi: output.contracts['TokenFactory.sol']['BMADToken'].abi,
      gasUsed: receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber,
      deployedAt: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(__dirname, '../factory-deployment.json'),
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log('\n💾 Deployment info saved to factory-deployment.json');

    // Update config
    const configPath = path.join(__dirname, '../lib/factory-config.ts');
    const configContent = `// MegaETH Timothy Testnet Configuration
export const CHAIN_CONFIG = {
  chainId: 6343,
  chainName: 'MegaETH Timothy Testnet',
  rpcUrls: ['https://timothy.megaeth.com/rpc'],
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorerUrls: ['https://megaeth-testnet-v2.blockscout.com/'],
};

// Token Factory Contract
export const FACTORY_ADDRESS = '${deployTx.address}';

// Factory ABI
export const FACTORY_ABI = ${JSON.stringify(abi, null, 2)};

// Token ABI
export const TOKEN_ABI = ${JSON.stringify(output.contracts['TokenFactory.sol']['BMADToken'].abi, null, 2)};
`;

    fs.writeFileSync(configPath, configContent);
    console.log('📝 Created factory-config.ts with contract details');

    console.log('\n🎉 Deployment complete! Factory is ready to create tokens.');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);

    if (error.message.includes('transaction failed')) {
      console.log('💡 Transaction failed - common on Timothy testnet');
      console.log('💡 Try running the script again');
    }

    console.log('\nFull error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});