# 🕵️‍♂️ CredSweeper

## Personal OSINT & Credential Exposure Scanner

CredSweeper is a comprehensive security research tool that demonstrates how much sensitive information can be collected about an individual using only public sources. Starting from a LinkedIn profile, it systematically discovers and analyzes potential credential exposures across multiple platforms.

## 🎯 Features

- **LinkedIn Intelligence Extraction**: Automated profile analysis and identity parsing
- **Username Generation**: Smart permutation algorithms for discovering aliases
- **GitHub Reconnaissance**: Repository scanning and secret detection
- **Public Exposure Discovery**: Pastebin, breach data, and code search integration
- **Advanced Secret Detection**: ML-ready credential classification with confidence scoring
- **Professional Reporting**: Beautiful HTML reports with risk visualization

## 🚀 Quick Start

### Installation

```bash
npm install
```

### CLI Usage

```bash
# Full scan with validation
npm run cli scan --linkedin "https://linkedin.com/in/username" --validate --deep

# Demo mode (no LinkedIn required)
npm run demo

# Offline mode
npm run cli scan --offline --company "TechCorp"
```

### Web Interface

```bash
npm run web
```

Then visit `http://localhost:3000` for the interactive web interface.

## 📋 Command Options

- `--linkedin <url>`: LinkedIn profile URL to analyze
- `--company <name>`: Override company name for email generation
- `--output <file>`: Output file path (default: report.html)
- `--validate`: Validate found credentials against live services
- `--deep`: Perform comprehensive deep scanning
- `--offline`: Use offline mode with mock data

## 🛡️ Security & Ethics

**IMPORTANT**: This tool is for educational and authorized security research only. Always ensure you have proper authorization before scanning any individual or organization.

- Only use on profiles you own or have explicit permission to analyze
- Respect rate limits and terms of service of all platforms
- Use responsibly for security awareness and education

## 🏗️ Architecture

```
src/
├── core/
│   ├── CredSweeper.js          # Main orchestration engine
│   ├── extractors/             # LinkedIn and profile extractors
│   ├── generators/             # Username and alias generators
│   ├── recon/                  # GitHub reconnaissance
│   ├── scanners/               # Public exposure scanners
│   ├── detectors/              # Secret detection engine
│   ├── reports/                # Report generation
│   └── utils/                  # Logging and utilities
├── cli/                        # Command-line interface
├── web/                        # Web interface
└── index.js                    # Main entry point
```

## 🔍 Detection Capabilities

- AWS Access Keys and Secret Keys
- JWT Tokens and API Keys
- Database Passwords
- Private Keys (RSA, SSH)
- Email/Password Combinations
- GitHub and Slack Tokens
- Generic Secrets and Tokens

## 📊 Report Features

- Risk level assessment (Critical, High, Medium, Low)
- Confidence scoring for each finding
- Source attribution and context
- Interactive HTML reports
- JSON export for automation
- Markdown format for documentation

## 🤝 Contributing

This is a security research and educational tool. Contributions should focus on:

- Improving detection accuracy
- Adding new data sources
- Enhancing report quality
- Security and privacy improvements

## 📄 License

MIT License - See LICENSE file for details.

## ⚠️ Disclaimer

This tool is provided for educational and authorized security research purposes only. Users are responsible for ensuring they have proper authorization before scanning any individual or organization. The authors are not responsible for any misuse of this tool.