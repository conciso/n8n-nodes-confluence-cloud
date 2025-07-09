# 🚀 n8n-nodes-confluence-cloud

A powerful n8n Community Node for seamless integration with Confluence Cloud REST API. This node provides comprehensive access to Confluence Cloud's capabilities with automatic API validation, deprecation detection, and intelligent error handling.

[![npm version](https://img.shields.io/npm/v/@conciso/n8n-nodes-confluence-cloud.svg)](https://www.npmjs.com/package/@conciso/n8n-nodes-confluence-cloud)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

### 🔄 **Confluence Cloud Node**
- **Spaces Management**: Create, read, update, and delete Confluence spaces
- **Pages Management**: Full CRUD operations for Confluence pages
- **Automatic API Version Detection**: Seamlessly uses V2 API with V1 fallback for legacy operations
- **Built-in Error Handling**: Comprehensive error messages with actionable solutions
- **OpenAPI-Generated**: Automatically generated from official Confluence API specifications

### 🛡️ **Quality Assurance**
- **Deprecated API Detection**: Build fails if deprecated APIs are detected
- **Missing Route Validation**: Automatic validation of API route configurations
- **Professional Error Messages**: Clear, actionable error messages with documentation links

## 📦 Installation

Install the node using n8n's Community Nodes feature:

1. **Via n8n Interface:**
   - Go to **Settings** → **Community Nodes**
   - Install package: `@conciso/n8n-nodes-confluence-cloud`

2. **Via npm (for self-hosted n8n):**
   ```bash
   npm install @conciso/n8n-nodes-confluence-cloud
   ```

For detailed installation instructions, see the [n8n Community Nodes documentation](https://docs.n8n.io/integrations/community-nodes/installation/).

## 🔐 Credentials Setup

### Required Credentials

Create a **Confluence Cloud API** credential with:

| Field | Description | Example |
|-------|-------------|---------|
| **Domain** | Your Confluence Cloud URL | `https://your-company.atlassian.net` |
| **Email** | Your Atlassian account email | `user@company.com` |
| **API Token** | Generated API token | `ATATT3xFfGF0T...` |

### 🔑 Creating an API Token

1. Go to [Atlassian Account Security](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click **"Create API token"**
3. Enter a label (e.g., "n8n Integration")
4. Copy the generated token (⚠️ **Save it immediately - you won't see it again!**)

## 🏗️ Supported Operations

{{OPERATIONS_TABLE}}

## 💡 Usage Examples

### Example 1: Create a New Page

```javascript
// Input Data
{
  "resource": "page",
  "operation": "create",
  "spaceId": "123456",
  "title": "My New Page",
  "body": {
    "storage": {
      "value": "<p>This is my page content.</p>",
      "representation": "storage"
    }
  }
}
```

### Example 2: List All Spaces

```javascript
// Simple space listing
{
  "resource": "space",
  "operation": "getAll"
}
```

## 🔧 Development

### Prerequisites

- Node.js 18+ 
- npm 8+
- n8n development environment

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/n8n-nodes-confluence-cloud.git
cd n8n-nodes-confluence-cloud

# Install dependencies
npm install

# Build the project
npm run build

# Build and run in dev mode
npm run dev # then open browser with http://localhost:5678
```

### Architecture

This node uses a sophisticated build system:

- **OpenAPI Code Generation**: Automatically generates operations from Confluence API specifications
- **Dual API Version Support**: Seamlessly handles both V1 (legacy) and V2 APIs
- **Quality Validation**: Build fails on deprecated APIs or missing routes
- **Type Safety**: Full TypeScript support with generated types

### Build System Features

- 📥 **Automatic API Spec Download**: Latest Confluence API specifications
- 🔍 **Deprecated API Detection**: Prevents using outdated endpoints
- ⚠️ **Missing Route Validation**: Ensures all configured routes exist
- 🎯 **Smart Error Messages**: Actionable feedback for configuration issues

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

### Adding New Routes

1. Edit `config/confluence-routes.json`
2. Add your route configuration:
   ```json
   {
     "path": "/your-endpoint",
     "methods": ["get", "post"],
     "legacy": false
   }
   ```
3. Run `npm run dev` to generate operations
4. Test your changes

## 📋 API Compatibility

| Confluence Cloud API | Support Status | Notes |
|---------------------|----------------|-------|
| **REST API v2** | ✅ Full Support | Primary API version |
| **REST API v1** | 🟡 Legacy Support | For operations not yet in V2 |

## 🐛 Troubleshooting

### Common Issues

**❌ "API PATH NOT FOUND" Error**
- Solution: Check if the route needs `"legacy": true` flag
- Documentation: [API Migration Guide](https://developer.atlassian.com/cloud/confluence/rest/v2/)

**❌ "DEPRECATED API DETECTED" Error**  
- Solution: Update to the V2 API equivalent
- Check: [Confluence API Deprecation Notices](https://developer.atlassian.com/cloud/confluence/deprecation-notice/)

**❌ "CQL Parse Error" in Trigger**
- Solution: Check your CQL syntax
- Reference: [CQL Documentation](https://developer.atlassian.com/cloud/confluence/advanced-searching-using-cql/)

**❌ Authentication Issues**
- Verify your API token is valid
- Ensure your email address is correct
- Check domain format: `https://your-domain.atlassian.net`

## 📚 Resources

- [Confluence Cloud REST API Documentation](https://developer.atlassian.com/cloud/confluence/rest/v2/)
- [Confluence Query Language (CQL)](https://developer.atlassian.com/cloud/confluence/advanced-searching-using-cql/)
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)
- [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the [n8n](https://n8n.io) automation platform
- Uses official [Confluence Cloud API](https://developer.atlassian.com/cloud/confluence/) specifications
- Inspired by the n8n community's need for robust Confluence integration

---

**Made with ❤️ for the n8n community**
