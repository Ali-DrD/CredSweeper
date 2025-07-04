import axios from 'axios';
import { Logger } from '../utils/Logger.js';

export class GitHubRecon {
  constructor() {
    this.logger = new Logger();
    this.apiBase = 'https://api.github.com';
    this.rateLimitDelay = 1000; // 1 second between requests
  }

  async scan(aliases) {
    const results = {
      repositories: [],
      exposures: []
    };

    // Extract potential GitHub usernames
    const githubUsernames = this.extractGitHubUsernames(aliases);
    
    for (const username of githubUsernames) {
      try {
        await this.delay(this.rateLimitDelay);
        
        const userData = await this.getUserData(username);
        if (userData) {
          const repos = await this.getUserRepositories(username);
          const gists = await this.getUserGists(username);
          
          results.repositories.push(...repos);
          results.exposures.push(...gists);
          
          // Scan repository contents for secrets
          for (const repo of repos) {
            const repoSecrets = await this.scanRepositoryContents(repo);
            results.exposures.push(...repoSecrets);
          }
        }
      } catch (error) {
        this.logger.warn(`GitHub scan failed for ${username}:`, error.message);
      }
    }

    return results;
  }

  extractGitHubUsernames(aliases) {
    const usernames = new Set();
    
    aliases.forEach(alias => {
      if (alias.type === 'username' || alias.type === 'social') {
        usernames.add(alias.value);
      }
    });

    return Array.from(usernames).slice(0, 20); // Limit to prevent rate limiting
  }

  async getUserData(username) {
    try {
      const response = await axios.get(`${this.apiBase}/users/${username}`, {
        headers: this.getHeaders()
      });
      
      return {
        username: response.data.login,
        name: response.data.name,
        email: response.data.email,
        bio: response.data.bio,
        company: response.data.company,
        location: response.data.location,
        publicRepos: response.data.public_repos,
        followers: response.data.followers,
        following: response.data.following,
        createdAt: response.data.created_at
      };
    } catch (error) {
      if (error.response?.status !== 404) {
        this.logger.warn(`Failed to get user data for ${username}`);
      }
      return null;
    }
  }

  async getUserRepositories(username) {
    try {
      const response = await axios.get(`${this.apiBase}/users/${username}/repos`, {
        headers: this.getHeaders(),
        params: {
          sort: 'updated',
          per_page: 50
        }
      });

      return response.data.map(repo => ({
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        url: repo.html_url,
        cloneUrl: repo.clone_url,
        language: repo.language,
        size: repo.size,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        isPrivate: repo.private,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at,
        owner: username
      }));
    } catch (error) {
      this.logger.warn(`Failed to get repositories for ${username}`);
      return [];
    }
  }

  async getUserGists(username) {
    try {
      const response = await axios.get(`${this.apiBase}/users/${username}/gists`, {
        headers: this.getHeaders(),
        params: { per_page: 30 }
      });

      const gists = [];
      for (const gist of response.data) {
        const gistContent = await this.getGistContent(gist.id);
        gists.push({
          id: gist.id,
          description: gist.description,
          url: gist.html_url,
          isPublic: gist.public,
          files: Object.keys(gist.files),
          content: gistContent,
          createdAt: gist.created_at,
          updatedAt: gist.updated_at,
          owner: username,
          type: 'gist'
        });
      }

      return gists;
    } catch (error) {
      this.logger.warn(`Failed to get gists for ${username}`);
      return [];
    }
  }

  async getGistContent(gistId) {
    try {
      const response = await axios.get(`${this.apiBase}/gists/${gistId}`, {
        headers: this.getHeaders()
      });

      let content = '';
      Object.values(response.data.files).forEach(file => {
        if (file.content) {
          content += `\n--- ${file.filename} ---\n${file.content}\n`;
        }
      });

      return content;
    } catch (error) {
      return '';
    }
  }

  async scanRepositoryContents(repo) {
    const exposures = [];
    
    try {
      // Get repository tree
      const treeResponse = await axios.get(`${this.apiBase}/repos/${repo.fullName}/git/trees/HEAD`, {
        headers: this.getHeaders(),
        params: { recursive: 1 }
      });

      const interestingFiles = treeResponse.data.tree.filter(item => 
        item.type === 'blob' && this.isInterestingFile(item.path)
      );

      // Limit to prevent excessive API calls
      for (const file of interestingFiles.slice(0, 10)) {
        await this.delay(this.rateLimitDelay);
        
        const content = await this.getFileContent(repo.fullName, file.path);
        if (content) {
          exposures.push({
            type: 'repository_file',
            repository: repo.name,
            filePath: file.path,
            content: content,
            url: `${repo.url}/blob/HEAD/${file.path}`,
            owner: repo.owner
          });
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to scan repository contents for ${repo.name}`);
    }

    return exposures;
  }

  async getFileContent(repoFullName, filePath) {
    try {
      const response = await axios.get(`${this.apiBase}/repos/${repoFullName}/contents/${filePath}`, {
        headers: this.getHeaders()
      });

      if (response.data.content) {
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
      }
    } catch (error) {
      // File might be too large or binary
    }
    
    return null;
  }

  isInterestingFile(filePath) {
    const interestingPatterns = [
      /\.env/i,
      /config\.(js|json|yaml|yml)$/i,
      /secrets?\.(js|json|yaml|yml)$/i,
      /credentials?\.(js|json|yaml|yml)$/i,
      /\.aws/i,
      /\.ssh/i,
      /password/i,
      /token/i,
      /key/i,
      /\.pem$/i,
      /\.key$/i,
      /docker-compose/i,
      /dockerfile/i
    ];

    return interestingPatterns.some(pattern => pattern.test(filePath));
  }

  getHeaders() {
    return {
      'User-Agent': 'CredSweeper-Research-Tool',
      'Accept': 'application/vnd.github.v3+json'
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}