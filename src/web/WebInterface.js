import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { CredSweeper } from '../core/CredSweeper.js';
import { Logger } from '../core/utils/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WebInterface {
  constructor() {
    this.app = express();
    this.logger = new Logger();
    this.port = process.env.PORT || 3000;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(__dirname, '../../public')));
  }

  setupRoutes() {
    // Serve the main web interface
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../../public/index.html'));
    });

    // API endpoint for scanning
    this.app.post('/api/scan', async (req, res) => {
      try {
        const { linkedinUrl, options = {} } = req.body;

        if (!linkedinUrl && !options.offline) {
          return res.status(400).json({
            error: 'LinkedIn URL is required unless using offline mode'
          });
        }

        const credSweeper = new CredSweeper({
          validate: options.validate || false,
          deep: options.deep || false,
          offline: options.offline || false,
          company: options.company,
          output: 'temp-report.json'
        });

        const results = await credSweeper.scan(linkedinUrl);
        
        res.json({
          success: true,
          results: results
        });

      } catch (error) {
        this.logger.error('Scan failed:', error.message);
        res.status(500).json({
          error: error.message
        });
      }
    });

    // API endpoint for demo scan
    this.app.post('/api/demo', async (req, res) => {
      try {
        const credSweeper = new CredSweeper({
          validate: false,
          deep: true,
          offline: true,
          output: 'demo-report.json'
        });

        const results = await credSweeper.scan('https://linkedin.com/in/demo-user');
        
        res.json({
          success: true,
          results: results,
          isDemo: true
        });

      } catch (error) {
        this.logger.error('Demo scan failed:', error.message);
        res.status(500).json({
          error: error.message
        });
      }
    });

    // Health check endpoint
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });
  }

  async start() {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        this.logger.success(`🌐 CredSweeper Web Interface running on http://localhost:${this.port}`);
        resolve();
      });
    });
  }
}