#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOLIFY_URL = 'https://coolify.247420.xyz';
const CONFIG_DIR = path.join(os.homedir(), '.coolify-mcp');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

class CoolifyAPIClient {
  constructor() {
    this.apiToken = this.loadToken();
  }

  loadToken() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        return config.apiToken;
      }
    } catch (error) {
      console.error('Error loading token:', error.message);
    }
    return null;
  }

  saveToken(token) {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({ apiToken: token }, null, 2));
    } catch (error) {
      console.error('Error saving token:', error.message);
    }
  }

  makeRequest(method, endpoint, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, COOLIFY_URL);
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (this.apiToken) {
        options.headers['Authorization'] = `Bearer ${this.apiToken}`;
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: data ? JSON.parse(data) : null,
              text: data
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: null,
              text: data
            });
          }
        });
      });

      req.on('error', reject);

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  async listProjects() {
    if (!this.apiToken) {
      throw new Error('API token not set. Use set_api_token tool first.');
    }

    const response = await this.makeRequest('GET', '/api/v1/projects');

    if (response.status === 401) {
      throw new Error('Unauthorized: Invalid API token');
    }

    if (response.status !== 200) {
      throw new Error(`API error: ${response.status} - ${response.text}`);
    }

    return response.body || [];
  }

  async listResources(projectId) {
    if (!this.apiToken) {
      throw new Error('API token not set. Use set_api_token tool first.');
    }

    const projectResponse = await this.makeRequest('GET', `/api/v1/projects/${projectId}`);

    if (projectResponse.status === 401) {
      throw new Error('Unauthorized: Invalid API token');
    }

    if (projectResponse.status !== 200) {
      throw new Error(`API error: ${projectResponse.status} - ${projectResponse.text}`);
    }

    const projectData = projectResponse.body;
    const resources = {
      project: projectData,
      applications: []
    };

    const appsResponse = await this.makeRequest('GET', '/api/v1/applications');
    if (appsResponse.status === 200 && Array.isArray(appsResponse.body)) {
      resources.applications = appsResponse.body.filter(app => {
        return app.project_id === projectData.id;
      });
    }

    return resources;
  }

  async getAppLogs(appUuid, lines = 100) {
    if (!this.apiToken) {
      throw new Error('API token not set. Use set_api_token tool first.');
    }

    const response = await this.makeRequest('GET', `/api/v1/applications/${appUuid}/logs?lines=${lines}`);

    if (response.status === 401) {
      throw new Error('Unauthorized: Invalid API token');
    }

    if (response.status !== 200) {
      throw new Error(`API error: ${response.status} - ${response.text}`);
    }

    return response.body || [];
  }

  async getDeployLogs(appUuid, lines = 100) {
    if (!this.apiToken) {
      throw new Error('API token not set. Use set_api_token tool first.');
    }

    const response = await this.makeRequest('GET', `/api/v1/applications/${appUuid}/deploy-logs?lines=${lines}`);

    if (response.status === 401) {
      throw new Error('Unauthorized: Invalid API token');
    }

    if (response.status !== 200) {
      throw new Error(`API error: ${response.status} - ${response.text}`);
    }

    return response.body || [];
  }

  async getDeployments(appUuid, skip = 0, take = 50) {
    if (!this.apiToken) {
      throw new Error('API token not set. Use set_api_token tool first.');
    }

    const response = await this.makeRequest('GET', `/api/v1/deployments/applications/${appUuid}?skip=${skip}&take=${take}`);

    if (response.status === 401) {
      throw new Error('Unauthorized: Invalid API token');
    }

    if (response.status !== 200) {
      throw new Error(`API error: ${response.status} - ${response.text}`);
    }

    return response.body || { count: 0, deployments: [] };
  }

  async getAppStatus(appUuid) {
    if (!this.apiToken) {
      throw new Error('API token not set. Use set_api_token tool first.');
    }

    const response = await this.makeRequest('GET', `/api/v1/applications/${appUuid}`);

    if (response.status === 401) {
      throw new Error('Unauthorized: Invalid API token');
    }

    if (response.status !== 200) {
      throw new Error(`API error: ${response.status} - ${response.text}`);
    }

    const app = response.body;
    return {
      uuid: app.uuid,
      name: app.name,
      description: app.description,
      status: app.status,
      server_status: app.server_status,
      last_restart_at: app.last_restart_at,
      last_restart_type: app.last_restart_type,
      restart_count: app.restart_count,
      last_online_at: app.last_online_at,
      created_at: app.created_at,
      updated_at: app.updated_at
    };
  }
}

const apiClient = new CoolifyAPIClient();

const server = new Server(
  {
    name: 'coolify-mcp',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

const tools = [
  {
    name: 'list_projects',
    description: 'List Coolify projects',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'list_resources',
    description: 'List project resources (apps, databases, services)',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project UUID'
        }
      },
      required: ['project_id']
    }
  },
  {
    name: 'get_app_logs',
    description: 'Get app runtime logs',
    inputSchema: {
      type: 'object',
      properties: {
        app_uuid: {
          type: 'string',
          description: 'App UUID'
        },
        lines: {
          type: 'number',
          description: 'Log lines (default: 100)',
          default: 100
        }
      },
      required: ['app_uuid']
    }
  },
  {
    name: 'get_deploy_logs',
    description: 'Get deployment logs',
    inputSchema: {
      type: 'object',
      properties: {
        app_uuid: {
          type: 'string',
          description: 'App UUID'
        },
        lines: {
          type: 'number',
          description: 'Log lines (default: 100)',
          default: 100
        }
      },
      required: ['app_uuid']
    }
  },
  {
    name: 'get_deployments',
    description: 'List app deployments with status and commit',
    inputSchema: {
      type: 'object',
      properties: {
        app_uuid: {
          type: 'string',
          description: 'App UUID'
        },
        skip: {
          type: 'number',
          description: 'Skip count',
          default: 0
        },
        take: {
          type: 'number',
          description: 'Take count',
          default: 50
        }
      },
      required: ['app_uuid']
    }
  },
  {
    name: 'get_app_status',
    description: 'Get app status and health',
    inputSchema: {
      type: 'object',
      properties: {
        app_uuid: {
          type: 'string',
          description: 'App UUID'
        }
      },
      required: ['app_uuid']
    }
  },
  {
    name: 'set_api_token',
    description: 'Set Coolify API token',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'API token'
        }
      },
      required: ['token']
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'list_projects':
        result = await apiClient.listProjects();
        break;

      case 'list_resources':
        result = await apiClient.listResources(args.project_id);
        break;

      case 'get_app_logs':
        result = await apiClient.getAppLogs(args.app_uuid, args.lines || 100);
        break;

      case 'get_deploy_logs':
        result = await apiClient.getDeployLogs(args.app_uuid, args.lines || 100);
        break;

      case 'get_deployments':
        result = await apiClient.getDeployments(args.app_uuid, args.skip || 0, args.take || 50);
        break;

      case 'get_app_status':
        result = await apiClient.getAppStatus(args.app_uuid);
        break;

      case 'set_api_token':
        apiClient.saveToken(args.token);
        apiClient.apiToken = args.token;
        result = { success: true, message: 'API token saved successfully' };
        break;

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`
            }
          ],
          isError: true
        };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isMain = process.argv[1] && (
  process.argv[1] === fileURLToPath(import.meta.url) ||
  process.argv[1].endsWith('index.js') ||
  process.argv[1].endsWith('coolify-mcp')
);

if (isMain) {
  main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}
