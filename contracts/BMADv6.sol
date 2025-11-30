// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract BMADv6 {
    // State variables
    address public owner;
    uint256 public totalSupply;
    uint256 public maxSupply;
    uint256 public mintPrice;
    uint256 public burnRate;

    mapping(address => uint256) public balances;
    mapping(address => mapping(address => uint256)) public allowances;
    mapping(address => bool) public isMinter;
    mapping(address => uint256) public lastMintTime;

    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);
    event MinterAdded(address indexed account);
    event MinterRemoved(address indexed account);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyMinter() {
        require(isMinter[msg.sender] || msg.sender == owner, "Not minter");
        _;
    }

    constructor() {
        owner = msg.sender;
        maxSupply = 1000000 * 10**18; // 1 million tokens
        mintPrice = 0.001 ether;
        burnRate = 100; // 1% burn rate (100/10000)
        isMinter[msg.sender] = true;
    }

    // Core functions
    function mint(address to, uint256 amount) public onlyMinter {
        require(totalSupply + amount <= maxSupply, "Max supply exceeded");
        require(block.timestamp >= lastMintTime[msg.sender] + 60, "Mint cooldown");

        totalSupply += amount;
        balances[to] += amount;
        lastMintTime[msg.sender] = block.timestamp;

        emit Mint(to, amount);
        emit Transfer(address(0), to, amount);
    }

    function burn(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");

        balances[msg.sender] -= amount;
        totalSupply -= amount;

        emit Burn(msg.sender, amount);
        emit Transfer(msg.sender, address(0), amount);
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        require(balances[msg.sender] >= amount, "Insufficient balance");

        uint256 burnAmount = (amount * burnRate) / 10000;
        uint256 transferAmount = amount - burnAmount;

        balances[msg.sender] -= amount;
        balances[to] += transferAmount;
        totalSupply -= burnAmount;

        emit Transfer(msg.sender, to, transferAmount);
        if (burnAmount > 0) {
            emit Burn(msg.sender, burnAmount);
            emit Transfer(msg.sender, address(0), burnAmount);
        }

        return true;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(balances[from] >= amount, "Insufficient balance");
        require(allowances[from][msg.sender] >= amount, "Insufficient allowance");

        uint256 burnAmount = (amount * burnRate) / 10000;
        uint256 transferAmount = amount - burnAmount;

        balances[from] -= amount;
        balances[to] += transferAmount;
        allowances[from][msg.sender] -= amount;
        totalSupply -= burnAmount;

        emit Transfer(from, to, transferAmount);
        if (burnAmount > 0) {
            emit Burn(from, burnAmount);
            emit Transfer(from, address(0), burnAmount);
        }

        return true;
    }

    // Admin functions
    function addMinter(address account) public onlyOwner {
        isMinter[account] = true;
        emit MinterAdded(account);
    }

    function removeMinter(address account) public onlyOwner {
        isMinter[account] = false;
        emit MinterRemoved(account);
    }

    function setMintPrice(uint256 _price) public onlyOwner {
        mintPrice = _price;
    }

    function setBurnRate(uint256 _rate) public onlyOwner {
        require(_rate <= 1000, "Burn rate too high"); // Max 10%
        burnRate = _rate;
    }

    function withdraw() public onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    // Public mint function
    function publicMint(uint256 amount) public payable {
        require(msg.value >= mintPrice * amount / 10**18, "Insufficient payment");
        require(totalSupply + amount <= maxSupply, "Max supply exceeded");

        totalSupply += amount;
        balances[msg.sender] += amount;

        emit Mint(msg.sender, amount);
        emit Transfer(address(0), msg.sender, amount);
    }

    // View functions
    function balanceOf(address account) public view returns (uint256) {
        return balances[account];
    }

    function allowance(address _owner, address spender) public view returns (uint256) {
        return allowances[_owner][spender];
    }

    receive() external payable {}
}