// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ContributionScoring {
    struct RepoMetrics {
        uint256 stars;
        uint256 forks;
        uint256 contributors;
        uint256 commitsByUser;
        uint256 totalAdditions;
        uint256 productionCommits;
    }

    // Integer log2 approximation (returns floor(log2(x)))
    function log2(uint256 x) public pure returns (uint256 y) {
        y = 0;
        while (x > 1) {
            x >>= 1;
            y++;
        }
    }

    // Calculate RIS (Repository Importance Score)
    function calculateRIS(
        uint256 stars,
        uint256 forks,
        uint256 contributors
    ) public pure returns (uint256) {
        // RIS = log2(stars + 1) * 2 + log2(forks + 1) * 1.5 + contributors * 0.5
        // All multipliers are scaled by 100 for fixed-point math
        uint256 ris = (log2(stars + 1) * 200) + // *2.0, scaled by 100
            (log2(forks + 1) * 150) + // *1.5, scaled by 100
            (contributors * 50); // *0.5, scaled by 100
        return ris; // scaled by 100
    }

    // Calculate CQS (Contribution Quality Score)
    function calculateCQS(
        uint256 commitsByUser,
        uint256 totalAdditions
    ) public pure returns (uint256) {
        // CQS = commitsByUser * 2 + totalAdditions / 100
        return commitsByUser * 2 + (totalAdditions / 100);
    }

    // Calculate PPB (Production Participation Bonus)
    function calculatePPB(
        uint256 productionCommits
    ) public pure returns (uint256) {
        // PPB = productionCommits * 5
        return productionCommits * 5;
    }

    // Calculate the final score for a single repo
    function calculateRepoScore(
        RepoMetrics memory m
    ) public pure returns (uint256) {
        uint256 ris = calculateRIS(m.stars, m.forks, m.contributors); // scaled by 100
        uint256 cqs = calculateCQS(m.commitsByUser, m.totalAdditions);
        uint256 ppb = calculatePPB(m.productionCommits);
        uint256 sum = cqs + ppb;
        uint256 score = (ris * sum) / 100; // divide by 100 to account for scaling
        return score;
    }

    // Calculate the total score for a contributor across all repos
    function calculateTotalScore(
        RepoMetrics[] memory metrics
    ) public pure returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < metrics.length; i++) {
            total += calculateRepoScore(metrics[i]);
        }
        return total;
    }
}
