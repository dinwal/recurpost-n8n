import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class RecurPostApi implements ICredentialType {
  name = 'recurPostApi';
  displayName = 'RecurPost API';
  documentationUrl = 'https://developers.recurpost.com/';
  icon = 'file:recurpost.svg' as const;
  properties: INodeProperties[] = [
    {
      displayName: 'Email',
      name: 'email',
      type: 'string',
      placeholder: 'name@email.com',
      default: '',
      required: true,
      description: 'Your RecurPost account email address',
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      required: true,
      description: 'Your RecurPost API key (found in Account Settings)',
    },
    {
      displayName: 'API URL',
      name: 'apiUrl',
      type: 'string',
      default: 'https://social.recurpost.com',
      required: true,
      description: 'RecurPost API base URL',
    },
  ];

  // Email and API key go out as Authorization: Basic on every request, never in the body
  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      auth: {
        username: '={{$credentials.email}}',
        password: '={{$credentials.apiKey}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.apiUrl}}',
      url: '/api/user_login',
      method: 'POST',
    },
    rules: [
      {
        type: 'responseSuccessBody',
        properties: {
          key: 'status',
          value: 200,
          message: 'Invalid credentials',
        },
      },
    ],
  };
}
