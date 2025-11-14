// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Secure Resume Storage Contract
/// @notice Stores encrypted resume data with FHE-protected skill evaluation
/// @dev Uses FHEVM to enable encrypted skill matching without decryption
contract SecureResume is SepoliaConfig {
    struct Resume {
        string name;                    // Can be desensitized (plaintext)
        string education;               // Education experience (plaintext)
        string workExperience;          // Work experience (plaintext)
        euint32 skillLevel1;            // Encrypted skill proficiency levels (max 5 skills for MVP)
        euint32 skillLevel2;
        euint32 skillLevel3;
        euint32 skillLevel4;
        euint32 skillLevel5;
        string skillName1;              // Skill names (plaintext)
        string skillName2;
        string skillName3;
        string skillName4;
        string skillName5;
        uint8 skillCount;               // Number of skills stored
        uint64 createdAt;
        uint64 updatedAt;
        bool exists;
    }

    // user => resume data
    mapping(address => Resume) private _resumes;

    // HR addresses with evaluation permissions
    mapping(address => bool) public hrAddresses;

    // Total number of resumes submitted
    uint256 private _totalResumes;

    // Events
    event ResumeSubmitted(address indexed user, uint64 timestamp, uint8 skillCount);
    event ResumeUpdated(address indexed user, uint64 timestamp);
    event SkillEvaluated(address indexed candidate, address indexed hr, uint256 skillIndex);
    event SkillScoreCalculated(address indexed candidate, address indexed hr, uint256[] skillIndices);
    event HRAuthorized(address indexed hr, address indexed authorizedBy);
    event HRRevoked(address indexed hr, address indexed revokedBy);

    modifier onlyHR() {
        require(hrAddresses[msg.sender], "Not authorized HR");
        _;
    }

    /// @notice Submit a new resume with encrypted skill data
    /// @param name User's name (can be desensitized)
    /// @param education Education experience
    /// @param workExperience Work experience
    /// @param skillNames Array of skill names (max 5)
    /// @param skillLevelsExt Array of encrypted skill proficiency levels (max 5)
    /// @param inputProof Zama input proof for encrypted skill levels
    function submitResume(
        string calldata name,
        string calldata education,
        string calldata workExperience,
        string[] calldata skillNames,
        externalEuint32[] calldata skillLevelsExt,
        bytes calldata inputProof
    ) external {
        require(skillNames.length == skillLevelsExt.length, "Skill arrays length mismatch");
        require(skillNames.length > 0 && skillNames.length <= 5, "Must have 1-5 skills");
        require(bytes(name).length > 0, "Name cannot be empty");

        Resume storage resume = _resumes[msg.sender];
        resume.name = name;
        resume.education = education;
        resume.workExperience = workExperience;
        resume.skillCount = uint8(skillNames.length);
        resume.createdAt = uint64(block.timestamp);
        resume.updatedAt = uint64(block.timestamp);
        resume.exists = true;

        // Increment total resumes counter for new submissions
        _totalResumes++;

        // Store skills in fixed slots
        for (uint256 i = 0; i < skillNames.length; i++) {
            euint32 skillLevel = FHE.fromExternal(skillLevelsExt[i], inputProof);

            if (i == 0) {
                resume.skillLevel1 = skillLevel;
                resume.skillName1 = skillNames[i];
                FHE.allowThis(resume.skillLevel1);
                FHE.allow(resume.skillLevel1, msg.sender);
            } else if (i == 1) {
                resume.skillLevel2 = skillLevel;
                resume.skillName2 = skillNames[i];
                FHE.allowThis(resume.skillLevel2);
                FHE.allow(resume.skillLevel2, msg.sender);
            } else if (i == 2) {
                resume.skillLevel3 = skillLevel;
                resume.skillName3 = skillNames[i];
                FHE.allowThis(resume.skillLevel3);
                FHE.allow(resume.skillLevel3, msg.sender);
            } else if (i == 3) {
                resume.skillLevel4 = skillLevel;
                resume.skillName4 = skillNames[i];
                FHE.allowThis(resume.skillLevel4);
                FHE.allow(resume.skillLevel4, msg.sender);
            } else if (i == 4) {
                resume.skillLevel5 = skillLevel;
                resume.skillName5 = skillNames[i];
                FHE.allowThis(resume.skillLevel5);
                FHE.allow(resume.skillLevel5, msg.sender);
            }
        }

        emit ResumeSubmitted(msg.sender, resume.createdAt, resume.skillCount);
    }

    /// @notice Update existing resume
    /// @param name Updated name
    /// @param education Updated education
    /// @param workExperience Updated work experience
    /// @param skillNames Updated skill names (max 5)
    /// @param skillLevelsExt Updated encrypted skill levels (max 5)
    /// @param inputProof Zama input proof
    function updateResume(
        string calldata name,
        string calldata education,
        string calldata workExperience,
        string[] calldata skillNames,
        externalEuint32[] calldata skillLevelsExt,
        bytes calldata inputProof
    ) external {
        require(_resumes[msg.sender].exists, "Resume does not exist");
        require(skillNames.length == skillLevelsExt.length, "Skill arrays length mismatch");
        require(skillNames.length > 0 && skillNames.length <= 5, "Must have 1-5 skills");
        require(bytes(name).length > 0, "Name cannot be empty");

        Resume storage resume = _resumes[msg.sender];
        resume.name = name;
        resume.education = education;
        resume.workExperience = workExperience;
        resume.skillCount = uint8(skillNames.length);
        resume.updatedAt = uint64(block.timestamp);

        // Clear existing skills first (gas optimization: batch clearing)
        resume.skillName1 = "";
        resume.skillName2 = "";
        resume.skillName3 = "";
        resume.skillName4 = "";
        resume.skillName5 = "";
        resume.skillLevel1 = FHE.asEuint32(0); // Reset to zero
        resume.skillLevel2 = FHE.asEuint32(0);
        resume.skillLevel3 = FHE.asEuint32(0);
        resume.skillLevel4 = FHE.asEuint32(0);
        resume.skillLevel5 = FHE.asEuint32(0);

        // Store updated skills in fixed slots
        for (uint256 i = 0; i < skillNames.length; i++) {
            euint32 skillLevel = FHE.fromExternal(skillLevelsExt[i], inputProof);

            if (i == 0) {
                resume.skillLevel1 = skillLevel;
                resume.skillName1 = skillNames[i];
                FHE.allowThis(resume.skillLevel1);
                FHE.allow(resume.skillLevel1, msg.sender);
            } else if (i == 1) {
                resume.skillLevel2 = skillLevel;
                resume.skillName2 = skillNames[i];
                FHE.allowThis(resume.skillLevel2);
                FHE.allow(resume.skillLevel2, msg.sender);
            } else if (i == 2) {
                resume.skillLevel3 = skillLevel;
                resume.skillName3 = skillNames[i];
                FHE.allowThis(resume.skillLevel3);
                FHE.allow(resume.skillLevel3, msg.sender);
            } else if (i == 3) {
                resume.skillLevel4 = skillLevel;
                resume.skillName4 = skillNames[i];
                FHE.allowThis(resume.skillLevel4);
                FHE.allow(resume.skillLevel4, msg.sender);
            } else if (i == 4) {
                resume.skillLevel5 = skillLevel;
                resume.skillName5 = skillNames[i];
                FHE.allowThis(resume.skillLevel5);
                FHE.allow(resume.skillLevel5, msg.sender);
            }
        }

        emit ResumeUpdated(msg.sender, resume.updatedAt);
    }

    /// @notice Get resume basic info (plaintext data)
    /// @param user Address of the resume owner
    function getResumeInfo(address user)
        external
        view
        returns (
            string memory name,
            string memory education,
            string memory workExperience,
            string[] memory skillNames,
            uint64 createdAt,
            uint64 updatedAt
        )
    {
        require(_resumes[user].exists, "Resume does not exist");
        Resume storage resume = _resumes[user];

        // Build skill names array from fixed slots
        string[] memory skillNamesArray = new string[](resume.skillCount);
        if (resume.skillCount >= 1) skillNamesArray[0] = resume.skillName1;
        if (resume.skillCount >= 2) skillNamesArray[1] = resume.skillName2;
        if (resume.skillCount >= 3) skillNamesArray[2] = resume.skillName3;
        if (resume.skillCount >= 4) skillNamesArray[3] = resume.skillName4;
        if (resume.skillCount >= 5) skillNamesArray[4] = resume.skillName5;

        return (
            resume.name,
            resume.education,
            resume.workExperience,
            skillNamesArray,
            resume.createdAt,
            resume.updatedAt
        );
    }

    /// @notice Get encrypted skill levels for a user
    /// @param user Address of the resume owner
    function getSkillLevels(address user) external view returns (euint32[] memory) {
        require(_resumes[user].exists, "Resume does not exist");
        Resume storage resume = _resumes[user];

        // Build skill levels array from fixed slots
        euint32[] memory skillLevelsArray = new euint32[](resume.skillCount);
        if (resume.skillCount >= 1) skillLevelsArray[0] = resume.skillLevel1;
        if (resume.skillCount >= 2) skillLevelsArray[1] = resume.skillLevel2;
        if (resume.skillCount >= 3) skillLevelsArray[2] = resume.skillLevel3;
        if (resume.skillCount >= 4) skillLevelsArray[3] = resume.skillLevel4;
        if (resume.skillCount >= 5) skillLevelsArray[4] = resume.skillLevel5;

        return skillLevelsArray;
    }

    /// @notice HR function: Evaluate skill match for a specific skill
    /// @dev Returns encrypted skill level for HR to decrypt and evaluate
    /// @param candidate Candidate address
    /// @param skillIndex Index of the skill to evaluate (0-4)
    /// @return skillLevel Encrypted skill proficiency level
    function evaluateSkillMatch(
        address candidate,
        uint256 skillIndex
    ) external onlyHR returns (euint32) {
        require(_resumes[candidate].exists, "Resume does not exist");
        require(skillIndex < _resumes[candidate].skillCount, "Invalid skill index");

        Resume storage resume = _resumes[candidate];
        euint32 skillLevel;

        if (skillIndex == 0) skillLevel = resume.skillLevel1;
        else if (skillIndex == 1) skillLevel = resume.skillLevel2;
        else if (skillIndex == 2) skillLevel = resume.skillLevel3;
        else if (skillIndex == 3) skillLevel = resume.skillLevel4;
        else if (skillIndex == 4) skillLevel = resume.skillLevel5;
        else revert("Invalid skill index");

        // Allow HR to access the result
        FHE.allowThis(skillLevel);
        FHE.allow(skillLevel, msg.sender);

        return skillLevel;
    }

    /// @notice HR function: Calculate total skill score across multiple skills
    /// @dev Performs encrypted addition without decrypting individual levels
    /// @param candidate Candidate address
    /// @param skillIndices Array of skill indices to include in score (0-4)
    /// @return totalScore Encrypted total proficiency score
    function calculateSkillScore(
        address candidate,
        uint256[] calldata skillIndices
    ) external onlyHR returns (euint32) {
        require(_resumes[candidate].exists, "Resume does not exist");

        Resume storage resume = _resumes[candidate];
        euint32 totalScore = FHE.asEuint32(0);

        for (uint256 i = 0; i < skillIndices.length; i++) {
            require(skillIndices[i] < resume.skillCount, "Invalid skill index");

            euint32 skillLevel;
            if (skillIndices[i] == 0) skillLevel = resume.skillLevel1;
            else if (skillIndices[i] == 1) skillLevel = resume.skillLevel2;
            else if (skillIndices[i] == 2) skillLevel = resume.skillLevel3;
            else if (skillIndices[i] == 3) skillLevel = resume.skillLevel4;
            else if (skillIndices[i] == 4) skillLevel = resume.skillLevel5;
            else continue; // Skip invalid indices

            totalScore = FHE.add(totalScore, skillLevel);
        }

        // Allow HR to access the result
        FHE.allowThis(totalScore);
        FHE.allow(totalScore, msg.sender);

        return totalScore;
    }

    /// @notice Check if user has submitted a resume
    function hasResume(address user) external view returns (bool) {
        return _resumes[user].exists;
    }

    /// @notice Authorize an HR address
    /// @param hr HR address to authorize
    function authorizeHR(address hr) external {
        require(hr != address(0), "Invalid HR address");
        require(!hrAddresses[hr], "HR already authorized");

        // For MVP, allow any user to authorize HR (in production, this should be restricted)
        hrAddresses[hr] = true;
        emit HRAuthorized(hr, msg.sender);
    }

    /// @notice Revoke HR authorization
    /// @param hr HR address to revoke
    function revokeHR(address hr) external {
        require(hrAddresses[hr], "HR not authorized");
        hrAddresses[hr] = false;
        emit HRRevoked(hr, msg.sender);
    }

    /// @notice Get contract statistics
    function getStats() external view returns (uint256 totalResumes) {
        return _totalResumes;
    }
}
