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
      default: 'https://app.recurpost.com',
      required: true,
      description: 'RecurPost API base URL',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      body: {
        emailid: '={{$credentials.email}}',
        pass_key: '={{$credentials.apiKey}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.apiUrl}}',
      url: '/api/user_login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {
        emailid: '={{$credentials.email}}',
        pass_key: '={{$credentials.apiKey}}',
      },
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
