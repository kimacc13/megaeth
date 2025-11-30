// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract BMADToken {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;
    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Burn(address indexed from, uint256 value);

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply,
        address _owner
    ) {
        name = _name;
        symbol = _symbol;
        totalSupply = _totalSupply * 10**uint256(decimals);
        owner = _owner;
        balanceOf[_owner] = totalSupply;
        emit Transfer(address(0), _owner, totalSupply);
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");

        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;

        emit Transfer(from, to, amount);
        return true;
    }

    function burn(uint256 amount) public {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit Burn(msg.sender, amount);
        emit Transfer(msg.sender, address(0), amount);
    }
}

contract TokenFactory {
    struct TokenInfo {
        address tokenAddress;
        string name;
        string symbol;
        uint256 totalSupply;
        address owner;
        uint256 createdAt;
    }

    TokenInfo[] public allTokens;
    mapping(address => TokenInfo[]) public tokensByOwner;
    mapping(address => TokenInfo) public tokenInfo;

    event TokenCreated(
        address indexed tokenAddress,
        address indexed owner,
        string name,
        string symbol,
        uint256 totalSupply
    );

    function createToken(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply
    ) public returns (address) {
        // สร้าง token ใหม่โดย owner คือผู้ที่เรียก function นี้
        BMADToken newToken = new BMADToken(
            _name,
            _symbol,
            _totalSupply,
            msg.sender  // ผู้สร้างจะเป็น owner และได้รับ tokens ทั้งหมด
        );

        address tokenAddress = address(newToken);

        // บันทึกข้อมูล token
        TokenInfo memory info = TokenInfo({
            tokenAddress: tokenAddress,
            name: _name,
            symbol: _symbol,
            totalSupply: _totalSupply * 10**18,
            owner: msg.sender,
            createdAt: block.timestamp
        });

        allTokens.push(info);
        tokensByOwner[msg.sender].push(info);
        tokenInfo[tokenAddress] = info;

        emit TokenCreated(tokenAddress, msg.sender, _name, _symbol, _totalSupply);

        return tokenAddress;
    }

    function getTokensByOwner(address _owner) public view returns (TokenInfo[] memory) {
        return tokensByOwner[_owner];
    }

    function getAllTokens() public view returns (TokenInfo[] memory) {
        return allTokens;
    }

    function getTokenCount() public view returns (uint256) {
        return allTokens.length;
    }
}