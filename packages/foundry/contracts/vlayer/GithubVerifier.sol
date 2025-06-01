// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.21;

import { Proof } from "vlayer-0.1.0/Proof.sol";
import { Verifier } from "vlayer-0.1.0/Verifier.sol";
import { GithubProver } from "./GithubProver.sol";
import { SimpleProver } from "./SimpleProver.sol";

contract GithubVerifier is Verifier {
    mapping(string => uint256) public scores;
    address public prover;

    constructor(address _prover) {
        prover = _prover;
    }

    function createProfile(Proof calldata, string calldata _username, uint256 score)
        public
        onlyVerified(prover, GithubProver.main.selector)
    {
        require(scores[_username] == 0, "Already created");
        scores[_username] = score;
    }

    function updateScore(Proof calldata, string calldata _username, uint256 score)
        public
        onlyVerified(prover, GithubProver.main.selector)
    {
        require(scores[_username] != 0, "Not created");
        scores[_username] = score;
    }

    function getScore(string calldata _username) public view returns (uint256) {
        return scores[_username];
    }

    //function getTopScores(uint256 _count) public view returns (string[] memory, uint256[] memory) {}
}
