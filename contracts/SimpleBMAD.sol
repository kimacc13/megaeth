// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract SimpleBMAD {
    address public owner;
    uint256 public totalSupply;
    mapping(address => uint256) public balances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Mint(address indexed to, uint256 amount);

    constructor() {
        owner = msg.sender;
        totalSupply = 0;
    }

    function mint(uint256 amount) public {
        totalSupply += amount;
        balances[msg.sender] += amount;
        emit Mint(msg.sender, amount);
        emit Transfer(address(0), msg.sender, amount);
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        balances[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function balanceOf(address account) public view returns (uint256) {
        return balances[account];
    }
}