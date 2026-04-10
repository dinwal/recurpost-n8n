import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
  IDataObject,
  NodeApiError,
  NodeConnectionTypes,
} from 'n8n-workflow';

export class RecurPost implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'RecurPost',
    name: 'recurPost',
    icon: 'file:recurpost.png',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Schedule and automate social media posts with RecurPost',
    defaults: {
      name: 'RecurPost',
    },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: 'recurPostApi',
        required: true,
      },
    ],
    properties: [
      // Resource (sorted alphabetically)
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'AI Content',
            value: 'aiContent',
          },
          {
            name: 'Library',
            value: 'library',
          },
          {
            name: 'Post',
            value: 'post',
          },
          {
            name: 'Social Account',
            value: 'socialAccount',
          },
        ],
        default: 'post',
      },

      // Operations for AI Content (sorted alphabetically)
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['aiContent'],
          },
        },
        options: [
          {
            name: 'Generate Image',
            value: 'generateImage',
            description: 'Generate an image using AI',
            action: 'Generate image',
          },
          {
            name: 'Generate Text',
            value: 'generateText',
            description: 'Generate post content using AI',
            action: 'Generate text content',
          },
        ],
        default: 'generateText',
      },

      // Operations for Library (sorted alphabetically)
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['library'],
          },
        },
        options: [
          {
            name: 'Add Content',
            value: 'addContent',
            description: 'Add content to a library for recurring posts',
            action: 'Add content to library',
          },
          {
            name: 'Get All',
            value: 'getAll',
            description: 'Get all libraries',
            action: 'Get all libraries',
          },
        ],
        default: 'addContent',
      },

      // Operations for Post
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['post'],
          },
        },
        options: [
          {
            name: 'Schedule',
            value: 'schedule',
            description: 'Schedule a post to social media accounts',
            action: 'Schedule a post',
          },
        ],
        default: 'schedule',
      },

      // Operations for Social Account (sorted alphabetically)
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['socialAccount'],
          },
        },
        options: [
          {
            name: 'Get All',
            value: 'getAll',
            description: 'Get all connected social media accounts',
            action: 'Get all social accounts',
          },
          {
            name: 'Get Connection URLs',
            value: 'getConnectionUrls',
            description: 'Get URLs to connect new social media accounts',
            action: 'Get connection URLs',
          },
          {
            name: 'Get History',
            value: 'getHistory',
            description: 'Get posting history for a social media account',
            action: 'Get posting history',
          },
        ],
        default: 'getAll',
      },

      // ==========================================
      // POST: SCHEDULE FIELDS
      // ==========================================
      {
        displayName: 'Social Account Names or IDs',
        name: 'socialAccounts',
        type: 'multiOptions',
        typeOptions: {
          loadOptionsMethod: 'getSocialAccounts',
        },
        required: true,
        default: [],
        displayOptions: {
          show: {
            resource: ['post'],
            operation: ['schedule'],
          },
        },
        description: 'Select social media accounts to post to. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Post Content',
        name: 'content',
        type: 'string',
        typeOptions: {
          rows: 4,
        },
        required: true,
        default: '',
        displayOptions: {
          show: {
            resource: ['post'],
            operation: ['schedule'],
          },
        },
        description: 'The text content of your post',
      },
      {
        displayName: 'Schedule Type',
        name: 'scheduleType',
        type: 'options',
        options: [
          {
            name: 'Post Now',
            value: 'now',
          },
          {
            name: 'Schedule for Later',
            value: 'scheduled',
          },
          {
            name: 'Add to Queue',
            value: 'queue',
          },
        ],
        default: 'now',
        displayOptions: {
          show: {
            resource: ['post'],
            operation: ['schedule'],
          },
        },
        description: 'When to publish this post',
      },
      {
        displayName: 'Schedule Date & Time',
        name: 'scheduleDateTime',
        type: 'dateTime',
        default: '',
        displayOptions: {
          show: {
            resource: ['post'],
            operation: ['schedule'],
            scheduleType: ['scheduled'],
          },
        },
        description: 'The date and time to publish this post',
      },
      {
        displayName: 'Additional Options',
        name: 'additionalOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: {
            resource: ['post'],
            operation: ['schedule'],
          },
        },
        options: [
          {
            displayName: 'First Comment',
            name: 'firstComment',
            type: 'string',
            typeOptions: {
              rows: 2,
            },
            default: '',
            description: 'Add a first comment to your post (supported on some platforms)',
          },
          {
            displayName: 'Image URL',
            name: 'imageUrl',
            type: 'string',
            default: '',
            description: 'URL of an image to include with the post',
          },
          {
            displayName: 'Link URL',
            name: 'linkUrl',
            type: 'string',
            default: '',
            description: 'URL to include as a link preview',
          },
          {
            displayName: 'Video URL',
            name: 'videoUrl',
            type: 'string',
            default: '',
            description: 'URL of a video to include with the post',
          },
        ],
      },

      // ==========================================
      // LIBRARY: ADD CONTENT FIELDS
      // ==========================================
      {
        displayName: 'Library Name or ID',
        name: 'libraryId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getLibraries',
        },
        required: true,
        default: '',
        displayOptions: {
          show: {
            resource: ['library'],
            operation: ['addContent'],
          },
        },
        description: 'The library to add content to. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Content',
        name: 'libraryContent',
        type: 'string',
        typeOptions: {
          rows: 4,
        },
        required: true,
        default: '',
        displayOptions: {
          show: {
            resource: ['library'],
            operation: ['addContent'],
          },
        },
        description: 'The text content to add to the library',
      },
      {
        displayName: 'Additional Options',
        name: 'libraryOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: {
            resource: ['library'],
            operation: ['addContent'],
          },
        },
        options: [
          {
            displayName: 'Image URL',
            name: 'imageUrl',
            type: 'string',
            default: '',
            description: 'URL of an image to include',
          },
          {
            displayName: 'Link URL',
            name: 'linkUrl',
            type: 'string',
            default: '',
            description: 'URL to include as a link',
          },
          {
            displayName: 'Video URL',
            name: 'videoUrl',
            type: 'string',
            default: '',
            description: 'URL of a video to include',
          },
        ],
      },

      // ==========================================
      // AI CONTENT: GENERATE TEXT FIELDS
      // ==========================================
      {
        displayName: 'Prompt',
        name: 'aiPrompt',
        type: 'string',
        typeOptions: {
          rows: 3,
        },
        required: true,
        default: '',
        displayOptions: {
          show: {
            resource: ['aiContent'],
            operation: ['generateText'],
          },
        },
        description: 'Describe the content you want to generate',
      },
      {
        displayName: 'Platform',
        name: 'aiPlatform',
        type: 'options',
        options: [
          { name: 'Facebook', value: 'facebook' },
          { name: 'General', value: 'general' },
          { name: 'Instagram', value: 'instagram' },
          { name: 'LinkedIn', value: 'linkedin' },
          { name: 'Twitter/X', value: 'twitter' },
        ],
        default: 'general',
        displayOptions: {
          show: {
            resource: ['aiContent'],
            operation: ['generateText'],
          },
        },
        description: 'Optimize content for this platform',
      },

      // ==========================================
      // AI CONTENT: GENERATE IMAGE FIELDS
      // ==========================================
      {
        displayName: 'Image Prompt',
        name: 'imagePrompt',
        type: 'string',
        typeOptions: {
          rows: 3,
        },
        required: true,
        default: '',
        displayOptions: {
          show: {
            resource: ['aiContent'],
            operation: ['generateImage'],
          },
        },
        description: 'Describe the image you want to generate',
      },

      // ==========================================
      // SOCIAL ACCOUNT: GET HISTORY FIELDS
      // ==========================================
      {
        displayName: 'Social Account Name or ID',
        name: 'historyAccountId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getSocialAccounts',
        },
        required: true,
        default: '',
        displayOptions: {
          show: {
            resource: ['socialAccount'],
            operation: ['getHistory'],
          },
        },
        description: 'Select the social media account to get history for. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
    ],
  };

  methods = {
    loadOptions: {
      async getSocialAccounts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials('recurPostApi');
        const apiUrl = credentials.apiUrl as string;

        const response = await this.helpers.httpRequestWithAuthentication.call(this, 'recurPostApi', {
          method: 'POST',
          url: `${apiUrl}/api/social_account_list`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: {},
        });

        if (response.status !== 200 || !response.social_accounts) {
          return [];
        }

        const accounts: INodePropertyOptions[] = [];
        for (const account of response.social_accounts) {
          accounts.push({
            name: account.smpa_name || account.smpa_id,
            value: account.smpa_id,
          });
        }

        return accounts;
      },

      async getLibraries(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials('recurPostApi');
        const apiUrl = credentials.apiUrl as string;

        const response = await this.helpers.httpRequestWithAuthentication.call(this, 'recurPostApi', {
          method: 'POST',
          url: `${apiUrl}/api/library_list`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: {},
        });

        if (response.status !== 200 || !response.library_list) {
          return [];
        }

        const libraries: INodePropertyOptions[] = [];
        for (const library of response.library_list) {
          libraries.push({
            name: library.cd_name || library.cd_id,
            value: library.cd_id,
          });
        }

        return libraries;
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const credentials = await this.getCredentials('recurPostApi');
    const apiUrl = credentials.apiUrl as string;

    const resource = this.getNodeParameter('resource', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;

    for (let i = 0; i < items.length; i++) {
      try {
        let responseData;

        // ==========================================
        // POST OPERATIONS
        // ==========================================
        if (resource === 'post') {
          if (operation === 'schedule') {
            const socialAccounts = this.getNodeParameter('socialAccounts', i) as string[];
            const content = this.getNodeParameter('content', i) as string;
            const scheduleType = this.getNodeParameter('scheduleType', i) as string;
            const additionalOptions = this.getNodeParameter('additionalOptions', i) as {
              imageUrl?: string;
              videoUrl?: string;
              linkUrl?: string;
              firstComment?: string;
            };

            const body: Record<string, string> = {
              id: socialAccounts.join(','),
              message: content,
            };

            // Handle schedule type
            if (scheduleType === 'now') {
              body.post_now = '1';
            } else if (scheduleType === 'scheduled') {
              const scheduleDateTime = this.getNodeParameter('scheduleDateTime', i) as string;
              if (scheduleDateTime) {
                const date = new Date(scheduleDateTime);
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                const hh = String(date.getHours()).padStart(2, '0');
                const min = String(date.getMinutes()).padStart(2, '0');
                const ss = String(date.getSeconds()).padStart(2, '0');
                body.schedule_date_time = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
              }
            } else if (scheduleType === 'queue') {
              body.add_to_queue = '1';
            }

            if (additionalOptions.imageUrl) {
              body.image_url = additionalOptions.imageUrl;
            }
            if (additionalOptions.videoUrl) {
              body.video_url = additionalOptions.videoUrl;
            }
            if (additionalOptions.linkUrl) {
              body.url = additionalOptions.linkUrl;
            }
            if (additionalOptions.firstComment) {
              body.first_comment = additionalOptions.firstComment;
            }

            responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'recurPostApi', {
              method: 'POST',
              url: `${apiUrl}/api/post_content`,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body,
            });
          }
        }

        // ==========================================
        // LIBRARY OPERATIONS
        // ==========================================
        else if (resource === 'library') {
          if (operation === 'getAll') {
            responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'recurPostApi', {
              method: 'POST',
              url: `${apiUrl}/api/library_list`,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: {},
            });

            if (responseData.library_list) {
              responseData = responseData.library_list;
            }
          } else if (operation === 'addContent') {
            const libraryId = this.getNodeParameter('libraryId', i) as string;
            const libraryContent = this.getNodeParameter('libraryContent', i) as string;
            const libraryOptions = this.getNodeParameter('libraryOptions', i) as {
              imageUrl?: string;
              videoUrl?: string;
              linkUrl?: string;
            };

            const body: Record<string, string> = {
              id: libraryId,
              message: libraryContent,
            };

            if (libraryOptions.imageUrl) {
              body.image_url = libraryOptions.imageUrl;
            }
            if (libraryOptions.videoUrl) {
              body.video_url = libraryOptions.videoUrl;
            }
            if (libraryOptions.linkUrl) {
              body.url = libraryOptions.linkUrl;
            }

            responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'recurPostApi', {
              method: 'POST',
              url: `${apiUrl}/api/add_content_in_library`,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body,
            });
          }
        }

        // ==========================================
        // SOCIAL ACCOUNT OPERATIONS
        // ==========================================
        else if (resource === 'socialAccount') {
          if (operation === 'getAll') {
            responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'recurPostApi', {
              method: 'POST',
              url: `${apiUrl}/api/social_account_list`,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: {},
            });

            if (responseData.social_accounts) {
              responseData = responseData.social_accounts;
            }
          } else if (operation === 'getConnectionUrls') {
            responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'recurPostApi', {
              method: 'POST',
              url: `${apiUrl}/api/connect_social_account_urls`,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: {},
            });

            if (responseData.social_links) {
              responseData = responseData.social_links;
            }
          } else if (operation === 'getHistory') {
            const historyAccountId = this.getNodeParameter('historyAccountId', i) as string;

            responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'recurPostApi', {
              method: 'POST',
              url: `${apiUrl}/api/history_data`,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: {
                id: historyAccountId,
              },
            });

            if (responseData.history_data) {
              responseData = responseData.history_data;
            }
          }
        }

        // ==========================================
        // AI CONTENT OPERATIONS
        // ==========================================
        else if (resource === 'aiContent') {
          if (operation === 'generateText') {
            const aiPrompt = this.getNodeParameter('aiPrompt', i) as string;
            const aiPlatform = this.getNodeParameter('aiPlatform', i) as string;

            responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'recurPostApi', {
              method: 'POST',
              url: `${apiUrl}/api/generate_content_with_ai`,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: {
                prompt_text: aiPrompt,
                platform: aiPlatform,
              },
            });
          } else if (operation === 'generateImage') {
            const imagePrompt = this.getNodeParameter('imagePrompt', i) as string;

            responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'recurPostApi', {
              method: 'POST',
              url: `${apiUrl}/api/generate_image_with_ai`,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: {
                prompt_text: imagePrompt,
              },
            });
          }
        }

        // Add response to return data
        if (Array.isArray(responseData)) {
          returnData.push(...responseData.map((item: IDataObject) => ({ json: item, pairedItem: { item: i } })));
        } else {
          returnData.push({ json: responseData, pairedItem: { item: i } });
        }

      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
          continue;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        throw new NodeApiError(this.getNode(), error as any);
      }
    }

    return [returnData];
  }
}
