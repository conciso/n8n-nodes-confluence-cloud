import {
  IAuthenticateGeneric,
  ICredentialType,
  INodeProperties,
  ICredentialTestRequest,
} from 'n8n-workflow';

export class ConfluenceCloudApi implements ICredentialType {
  name = 'confluenceCloudApi';
  displayName = 'Confluence Cloud API';
  documentationUrl =
    'https://github.com/conciso/n8n-nodes-confluence-cloud?tab=readme-ov-file#-credentials-setup';
  properties: INodeProperties[] = [
    {
      displayName: 'Domain',
      name: 'domain',
      type: 'string',
      placeholder: 'https://your-domain.atlassian.net',
      description:
        'Your Confluence Cloud domain URL (e.g., https://yourcompany.atlassian.net). Make sure to include https:// and do not add /wiki at the end.',
      default: '',
    },
    {
      displayName: 'Email',
      name: 'email',
      type: 'string',
      placeholder: 'user@example.com',
      description: 'The email address of your Atlassian account (used for API authentication)',
      default: '',
    },
    {
      displayName: 'API Token',
      name: 'apiToken',
      type: 'string',
      typeOptions: { password: true },
      description:
        'API Token from your Atlassian Account Settings. Create one at: https://id.atlassian.com/manage-profile/security/api-tokens',
      default: '',
    },
  ];
  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      auth: {
        username: '={{$credentials.email}}',
        password: '={{$credentials.apiToken}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.domain}}/wiki/api/v2',
      url: '/spaces',
      method: 'GET',
      qs: {
        limit: 1,
      },
    },
  };
}
