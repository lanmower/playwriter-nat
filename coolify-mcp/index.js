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

  async listGitHubApps() {
    if (!this.apiToken) {
      throw new Error('API token not set. Use set_api_token tool first.');
    }

    const response = await this.makeRequest('GET', '/api/v1/github-apps');

    if (response.status === 401) {
      throw new Error('Unauthorized: Invalid API token');
    }

    if (response.status !== 200) {
      throw new Error(`API error: ${response.status} - ${response.text}`);
    }

    return response.body || [];
  }

  async getGitHubRepositories(gitHubAppUuid) {
    if (!this.apiToken) {
      throw new Error('API token not set. Use set_api_token tool first.');
    }

    const response = await this.makeRequest('GET', `/api/v1/github-apps/${gitHubAppUuid}/repositories`);

    if (response.status === 401) {
      throw new Error('Unauthorized: Invalid API token');
    }

    if (response.status !== 200) {
      throw new Error(`API error: ${response.status} - ${response.text}`);
    }

    return response.body?.repositories || [];
  }

  async createApplicationGitHub(params) {
    if (!this.apiToken) {
      throw new Error('API token not set. Use set_api_token tool first.');
    }

    const body = {
      project_uuid: params.project_uuid,
      server_uuid: params.server_uuid,
      github_app_uuid: params.github_app_uuid,
      git_repository: params.git_repository,
      git_branch: params.git_branch,
      build_pack: params.build_pack || 'nixpacks',
      ports_exposes: params.ports_exposes
    };

    if (params.environment_name) body.environment_name = params.environment_name;
    if (params.environment_uuid) body.environment = params.environment_uuid;
    if (params.name) body.name = params.name;
    if (params.description) body.description = params.description;
    if (params.domains) body.domains = params.domains;
    if (params.instant_deploy !== undefined) body.instant_deploy = params.instant_deploy;
    if (params.base_directory) body.base_directory = params.base_directory;
    if (params.build_command) body.build_command = params.build_command;
    if (params.start_command) body.start_command = params.start_command;
    if (params.ports_mappings) body.ports_mappings = params.ports_mappings;

    const response = await this.makeRequest('POST', '/api/v1/applications/private-github-app', body);

    if (response.status === 401) {
      throw new Error('Unauthorized: Invalid API token');
    }

    if (response.status !== 201 && response.status !== 200) {
      throw new Error(`API error: ${response.status} - ${response.text}`);
    }

    return response.body;
  }

  async createEnvVariable(appUuid, key, value, options = {}) {
    if (!this.apiToken) {
      throw new Error('API token not set. Use set_api_token tool first.');
    }

    const body = {
      key,
      value,
      is_buildtime: options.is_buildtime !== undefined ? options.is_buildtime : true,
      is_runtime: options.is_runtime !== undefined ? options.is_runtime : true
    };

    if (options.is_preview !== undefined) body.is_preview = options.is_preview;
    if (options.is_literal !== undefined) body.is_literal = options.is_literal;
    if (options.is_multiline !== undefined) body.is_multiline = options.is_multiline;

    const response = await this.makeRequest('POST', `/api/v1/applications/${appUuid}/envs`, body);

    if (response.status === 401) {
      throw new Error('Unauthorized: Invalid API token');
    }

    if (response.status !== 201 && response.status !== 200) {
      throw new Error(`API error: ${response.status} - ${response.text}`);
    }

    return response.body;
  }

  async redeployApplication(appUuid, force = false, instantDeploy = false) {
    if (!this.apiToken) {
      throw new Error('API token not set. Use set_api_token tool first.');
    }

    let endpoint = `/api/v1/applications/${appUuid}/start`;
    const params = [];

    if (force) params.push('force=true');
    if (instantDeploy) params.push('instant_deploy=true');

    if (params.length > 0) {
      endpoint += '?' + params.join('&');
    }

    const response = await this.makeRequest('GET', endpoint);

    if (response.status === 401) {
      throw new Error('Unauthorized: Invalid API token');
    }

    if (response.status !== 200) {
      throw new Error(`API error: ${response.status} - ${response.text}`);
    }

    return response.body;
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
    name: 'list_github_apps',
    description: 'List installed GitHub apps',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_github_repositories',
    description: 'List repos from GitHub app',
    inputSchema: {
      type: 'object',
      properties: {
        github_app_uuid: {
          type: 'string',
          description: 'GitHub app UUID'
        }
      },
      required: ['github_app_uuid']
    }
  },
  {
    name: 'create_application_github',
    description: 'Deploy app from GitHub repo',
    inputSchema: {
      type: 'object',
      properties: {
        project_uuid: {
          type: 'string',
          description: 'Project UUID'
        },
        server_uuid: {
          type: 'string',
          description: 'Server UUID'
        },
        github_app_uuid: {
          type: 'string',
          description: 'GitHub app UUID'
        },
        git_repository: {
          type: 'string',
          description: 'Repo (owner/repo)'
        },
        git_branch: {
          type: 'string',
          description: 'Branch name'
        },
        ports_exposes: {
          type: 'string',
          description: 'Port to expose'
        },
        environment_name: {
          type: 'string',
          description: 'Environment name'
        },
        environment_uuid: {
          type: 'string',
          description: 'Environment UUID'
        },
        name: {
          type: 'string',
          description: 'App name'
        },
        description: {
          type: 'string',
          description: 'App description'
        },
        build_pack: {
          type: 'string',
          description: 'Build pack (nixpacks, dockerfile, etc)'
        },
        instant_deploy: {
          type: 'boolean',
          description: 'Deploy immediately'
        },
        base_directory: {
          type: 'string',
          description: 'Base directory'
        },
        build_command: {
          type: 'string',
          description: 'Build command'
        },
        start_command: {
          type: 'string',
          description: 'Start command'
        }
      },
      required: ['project_uuid', 'server_uuid', 'github_app_uuid', 'git_repository', 'git_branch', 'ports_exposes']
    }
  },
  {
    name: 'create_env_variable',
    description: 'Add env variable to app',
    inputSchema: {
      type: 'object',
      properties: {
        app_uuid: {
          type: 'string',
          description: 'App UUID'
        },
        key: {
          type: 'string',
          description: 'Variable name'
        },
        value: {
          type: 'string',
          description: 'Variable value'
        },
        is_buildtime: {
          type: 'boolean',
          description: 'Build-time variable'
        },
        is_runtime: {
          type: 'boolean',
          description: 'Runtime variable'
        },
        is_preview: {
          type: 'boolean',
          description: 'Preview environment only'
        },
        is_literal: {
          type: 'boolean',
          description: 'Don\'t interpolate'
        }
      },
      required: ['app_uuid', 'key', 'value']
    }
  },
  {
    name: 'redeploy_application',
    description: 'Redeploy app',
    inputSchema: {
      type: 'object',
      properties: {
        app_uuid: {
          type: 'string',
          description: 'App UUID'
        },
        force: {
          type: 'boolean',
          description: 'Force rebuild'
        },
        instant_deploy: {
          type: 'boolean',
          description: 'Skip queue'
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

      case 'list_github_apps':
        result = await apiClient.listGitHubApps();
        break;

      case 'get_github_repositories':
        result = await apiClient.getGitHubRepositories(args.github_app_uuid);
        break;

      case 'create_application_github':
        result = await apiClient.createApplicationGitHub(args);
        break;

      case 'create_env_variable':
        result = await apiClient.createEnvVariable(args.app_uuid, args.key, args.value, {
          is_buildtime: args.is_buildtime,
          is_runtime: args.is_runtime,
          is_preview: args.is_preview,
          is_literal: args.is_literal
        });
        break;

      case 'redeploy_application':
        result = await apiClient.redeployApplication(args.app_uuid, args.force || false, args.instant_deploy || false);
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
