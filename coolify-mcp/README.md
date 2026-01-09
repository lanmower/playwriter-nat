# Coolify MCP

MCP server for Coolify CLI - list projects, resources, manage deployments, and configure environment variables.

## Features

- **Projects & Resources**: List projects and project resources
- **App Logs**: Get runtime or deployment logs
- **App Status**: Get status with optional deployment history
- **GitHub Integration**: List GitHub apps and repositories
- **Deployment**: Deploy from private GitHub repos, redeploy with options
- **Environment Variables**: List, create, update, delete env variables for dev cycles
- **Persistent Auth**: API token automatically saved to `~/.coolify-mcp/config.json`

## Installation

### Add to Claude Code (Recommended)

```bash
claude mcp add -s user coolify npx -y gxe@latest AnEntrypoint/coolify-mcp
```

### Direct Execution with gxe

```bash
npx -y gxe@latest AnEntrypoint/coolify-mcp
```

### Local Development

```bash
cd /home/user/coolify-mcp
npm install
node index.js
```

## Quick Start

1. **Get API token** from https://coolify.247420.xyz/security/api-tokens
2. **Set the token** using the `set_api_token` tool once per session
3. **Call any tool** to interact with Coolify

## API Token Setup

To obtain an API token:

1. Navigate to https://coolify.247420.xyz/security/api-tokens
2. Click the "Create" button
3. Enter a description (e.g., "mcp-tool-token")
4. Select permissions (recommend "root" for full access)
5. Click "Create"
6. **Copy the token immediately** (shown only once!)

The token is automatically saved to `~/.coolify-mcp/config.json` and persists between sessions.

## Tools (12 total)

### Project & Resource Management

#### list_projects
List Coolify projects or get resources for a project.

**Input:**
- `project_id` (string, optional) - Get resources if set

**Output:** Array of projects or project with applications

### Logs & Status

#### get_app_logs
Get app logs (runtime or deployment).

**Input:**
- `app_uuid` (string, required) - Application UUID
- `type` (string, optional, default: "runtime") - "runtime" or "deploy"
- `lines` (number, optional, default: 100) - Log lines

**Output:** Log data

#### get_app_status
Get app status and deployment history.

**Input:**
- `app_uuid` (string, required) - Application UUID
- `include_deployments` (boolean, optional, default: false) - Include deployment history
- `skip` (number, optional, default: 0) - Pagination skip
- `take` (number, optional, default: 50) - Pagination take

**Output:** App status with optional deployment history

### GitHub Deployment

#### list_github_apps
List GitHub apps or get repositories from a GitHub app.

**Input:**
- `github_app_id` (string, optional) - Get repos if set

**Output:** Array of GitHub apps or repositories

#### create_application_github
Deploy app from private GitHub repo.

**Input:** (required)
- `project_uuid`, `server_uuid`, `github_app_uuid`, `git_repository`, `git_branch`, `ports_exposes`

**Optional:**
- `name`, `description`, `build_pack`, `instant_deploy`, `base_directory`, `build_command`, `start_command`

**Output:** Created application object

#### redeploy_application
Redeploy application.

**Input:**
- `app_uuid` (string, required) - Application UUID
- `force` (boolean, optional) - Force rebuild
- `instant_deploy` (boolean, optional) - Skip deployment queue

**Output:** Deployment response

### Environment Variables (CRUD)

#### list_env_variables
List app environment variables.

**Input:**
- `app_uuid` (string, required) - Application UUID

**Output:** Array of environment variables with UUIDs and settings

#### create_env_variable
Add environment variable to app.

**Input:** (required)
- `app_uuid`, `key`, `value`

**Optional:**
- `is_buildtime` (boolean, default: true)
- `is_runtime` (boolean, default: true)
- `is_preview`, `is_literal`

**Output:** Created environment variable

#### update_env_variable
Edit app environment variable.

**Input:** (required)
- `app_uuid`, `env_uuid`

**Optional:**
- `key`, `value`, `is_buildtime`, `is_runtime`, `is_preview`, `is_literal`

**Output:** Updated environment variable

#### delete_env_variable
Delete app environment variable.

**Input:** (required)
- `app_uuid`, `env_uuid`

**Output:** Success confirmation

### Authentication

#### set_api_token
Set Coolify API token for authentication.

**Input:**
- `token` (string, required) - Your API token from Coolify

**Output:**
```json
{
  "success": true,
  "message": "API token saved successfully"
}
```

## Configuration

Configuration is stored at `~/.coolify-mcp/config.json`:

```json
{
  "apiToken": "3|your-token-here"
}
```

The token is automatically saved via the `set_api_token` tool and persists across sessions.

## Dev Cycle Workflow Example

```
1. list_env_variables          → See current configuration
2. update_env_variable         → Adjust settings (build, runtime, etc)
3. redeploy_application        → Test changes (force rebuild)
4. get_app_logs type=deploy    → Check deployment status
5. get_app_status              → Verify app health
```

## Security

- **Token Storage**: Stored locally in `~/.coolify-mcp/config.json`
- **No Logging**: Tokens never logged except to Coolify server
- **Token Rotation**: Regularly rotate tokens at https://coolify.247420.xyz/security/api-tokens

## Architecture

- Uses `@modelcontextprotocol/sdk` for MCP protocol
- Communicates via stdio (stdin/stdout)
- Compatible with any MCP client (Claude Code, etc)
- No external dependencies beyond npm packages

## License

MIT
