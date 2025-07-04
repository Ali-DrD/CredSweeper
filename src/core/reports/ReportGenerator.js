import fs from 'fs-extra';
import path from 'path';
import { Logger } from '../utils/Logger.js';

export class ReportGenerator {
  constructor() {
    this.logger = new Logger();
  }

  async generate(results, outputPath) {
    const extension = path.extname(outputPath).toLowerCase();
    
    switch (extension) {
      case '.html':
        await this.generateHTMLReport(results, outputPath);
        break;
      case '.json':
        await this.generateJSONReport(results, outputPath);
        break;
      case '.md':
        await this.generateMarkdownReport(results, outputPath);
        break;
      default:
        await this.generateHTMLReport(results, outputPath + '.html');
    }
  }

  async generateHTMLReport(results, outputPath) {
    const html = this.createHTMLReport(results);
    await fs.writeFile(outputPath, html, 'utf8');
  }

  async generateJSONReport(results, outputPath) {
    const json = JSON.stringify(results, null, 2);
    await fs.writeFile(outputPath, json, 'utf8');
  }

  async generateMarkdownReport(results, outputPath) {
    const markdown = this.createMarkdownReport(results);
    await fs.writeFile(outputPath, markdown, 'utf8');
  }

  createHTMLReport(results) {
    const { target, aliases, credentials, exposures, repositories, metadata } = results;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CredSweeper Report - ${target.name}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6; 
            color: #333; 
            background: #f5f5f5;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            padding: 40px 0; 
            text-align: center;
            margin-bottom: 30px;
            border-radius: 10px;
        }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header p { font-size: 1.2em; opacity: 0.9; }
        .risk-badge {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 0.9em;
            margin: 10px 5px;
        }
        .risk-critical { background: #ff4757; color: white; }
        .risk-high { background: #ff6b6b; color: white; }
        .risk-medium { background: #ffa502; color: white; }
        .risk-low { background: #26de81; color: white; }
        .section { 
            background: white; 
            margin: 20px 0; 
            padding: 30px; 
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .section h2 { 
            color: #2c3e50; 
            margin-bottom: 20px; 
            padding-bottom: 10px;
            border-bottom: 2px solid #ecf0f1;
        }
        .stats { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 20px; 
            margin: 20px 0;
        }
        .stat-card { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
            text-align: center;
            border-left: 4px solid #667eea;
        }
        .stat-number { font-size: 2em; font-weight: bold; color: #667eea; }
        .stat-label { color: #666; margin-top: 5px; }
        .credential-item {
            background: #fff5f5;
            border: 1px solid #fed7d7;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
        }
        .credential-high { border-color: #fc8181; background: #fff5f5; }
        .credential-medium { border-color: #f6ad55; background: #fffaf0; }
        .credential-low { border-color: #68d391; background: #f0fff4; }
        .code-block {
            background: #2d3748;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            overflow-x: auto;
            margin: 10px 0;
        }
        .alias-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 10px;
            margin: 15px 0;
        }
        .alias-item {
            background: #f7fafc;
            padding: 10px;
            border-radius: 5px;
            border-left: 3px solid #4299e1;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🕵️‍♂️ CredSweeper Report</h1>
            <p>Personal OSINT & Credential Exposure Analysis</p>
            <div class="risk-badge risk-${metadata.riskLevel.toLowerCase()}">${metadata.riskLevel} RISK</div>
        </div>

        <div class="section">
            <h2>📋 Target Profile</h2>
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">${target.name}</div>
                    <div class="stat-label">Full Name</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${target.company}</div>
                    <div class="stat-label">Company</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${target.location}</div>
                    <div class="stat-label">Location</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${new Date(metadata.scanDate).toLocaleDateString()}</div>
                    <div class="stat-label">Scan Date</div>
                </div>
            </div>
            <p><strong>Headline:</strong> ${target.headline}</p>
            <p><strong>Profile URL:</strong> <a href="${target.profileUrl}" target="_blank">${target.profileUrl}</a></p>
        </div>

        <div class="section">
            <h2>📊 Exposure Summary</h2>
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">${metadata.totalFindings}</div>
                    <div class="stat-label">Total Credentials Found</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${aliases.length}</div>
                    <div class="stat-label">Generated Aliases</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${repositories.length}</div>
                    <div class="stat-label">GitHub Repositories</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${exposures.length}</div>
                    <div class="stat-label">Public Exposures</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🔄 Generated Aliases</h2>
            <div class="alias-grid">
                ${aliases.map(alias => `
                    <div class="alias-item">
                        <strong>${alias.type.toUpperCase()}:</strong><br>
                        ${alias.value}
                        ${alias.platform ? `<br><small>Platform: ${alias.platform}</small>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>

        ${credentials.length > 0 ? `
        <div class="section">
            <h2>🔍 Detected Credentials</h2>
            ${credentials.map(cred => `
                <div class="credential-item credential-${cred.riskLevel.toLowerCase()}">
                    <h3>${cred.description}</h3>
                    <p><strong>Type:</strong> ${cred.type}</p>
                    <p><strong>Severity:</strong> ${cred.severity}</p>
                    <p><strong>Confidence:</strong> ${(cred.confidence * 100).toFixed(1)}%</p>
                    <p><strong>Risk Level:</strong> ${cred.riskLevel}</p>
                    <p><strong>Line:</strong> ${cred.lineNumber}</p>
                    <div class="code-block">${this.escapeHtml(cred.context)}</div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${repositories.length > 0 ? `
        <div class="section">
            <h2>🐙 GitHub Repositories</h2>
            ${repositories.map(repo => `
                <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 10px 0;">
                    <h3><a href="${repo.url}" target="_blank">${repo.name}</a></h3>
                    <p>${repo.description || 'No description'}</p>
                    <p><strong>Language:</strong> ${repo.language || 'Unknown'} | 
                       <strong>Stars:</strong> ${repo.stars} | 
                       <strong>Forks:</strong> ${repo.forks}</p>
                    <p><strong>Updated:</strong> ${new Date(repo.updatedAt).toLocaleDateString()}</p>
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${exposures.length > 0 ? `
        <div class="section">
            <h2>🌐 Public Exposures</h2>
            ${exposures.map(exposure => `
                <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 10px 0;">
                    <h3>${exposure.type.replace(/_/g, ' ').toUpperCase()}</h3>
                    ${exposure.url ? `<p><a href="${exposure.url}" target="_blank">${exposure.url}</a></p>` : ''}
                    ${exposure.description ? `<p>${exposure.description}</p>` : ''}
                    ${exposure.riskLevel ? `<span class="risk-badge risk-${exposure.riskLevel.toLowerCase()}">${exposure.riskLevel}</span>` : ''}
                </div>
            `).join('')}
        </div>
        ` : ''}

        <div class="footer">
            <p>Generated by CredSweeper - Personal OSINT & Credential Exposure Scanner</p>
            <p>This report is for educational and security research purposes only.</p>
        </div>
    </div>
</body>
</html>`;
  }

  createMarkdownReport(results) {
    const { target, aliases, credentials, exposures, repositories, metadata } = results;
    
    return `# 🕵️‍♂️ CredSweeper Report

## Target Profile
- **Name:** ${target.name}
- **Company:** ${target.company}
- **Location:** ${target.location}
- **Headline:** ${target.headline}
- **Profile URL:** ${target.profileUrl}
- **Scan Date:** ${new Date(metadata.scanDate).toLocaleDateString()}

## Exposure Summary
- **Total Credentials Found:** ${metadata.totalFindings}
- **Risk Level:** ${metadata.riskLevel}
- **Generated Aliases:** ${aliases.length}
- **GitHub Repositories:** ${repositories.length}
- **Public Exposures:** ${exposures.length}

## Generated Aliases
${aliases.map(alias => `- **${alias.type.toUpperCase()}:** ${alias.value}${alias.platform ? ` (${alias.platform})` : ''}`).join('\n')}

${credentials.length > 0 ? `## Detected Credentials
${credentials.map(cred => `
### ${cred.description}
- **Type:** ${cred.type}
- **Severity:** ${cred.severity}
- **Confidence:** ${(cred.confidence * 100).toFixed(1)}%
- **Risk Level:** ${cred.riskLevel}
- **Line:** ${cred.lineNumber}

\`\`\`
${cred.context}
\`\`\`
`).join('\n')}` : ''}

${repositories.length > 0 ? `## GitHub Repositories
${repositories.map(repo => `
### [${repo.name}](${repo.url})
- **Description:** ${repo.description || 'No description'}
- **Language:** ${repo.language || 'Unknown'}
- **Stars:** ${repo.stars} | **Forks:** ${repo.forks}
- **Updated:** ${new Date(repo.updatedAt).toLocaleDateString()}
`).join('\n')}` : ''}

${exposures.length > 0 ? `## Public Exposures
${exposures.map(exposure => `
### ${exposure.type.replace(/_/g, ' ').toUpperCase()}
${exposure.url ? `- **URL:** ${exposure.url}` : ''}
${exposure.description ? `- **Description:** ${exposure.description}` : ''}
${exposure.riskLevel ? `- **Risk Level:** ${exposure.riskLevel}` : ''}
`).join('\n')}` : ''}

---
*Generated by CredSweeper - Personal OSINT & Credential Exposure Scanner*
*This report is for educational and security research purposes only.*`;
  }

  escapeHtml(text) {
    const div = { innerHTML: text };
    return div.innerHTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}