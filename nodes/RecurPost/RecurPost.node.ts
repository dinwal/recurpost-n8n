import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
  INodeProperties,
  IDataObject,
  NodeApiError,
  NodeOperationError,
  NodeConnectionTypes,
} from 'n8n-workflow';
import { recurPostRequest } from './request';
import { buildCustomizationBody, CUSTOMIZATION_SHOW, formatDateTime } from './composer';
import { findOperation, runGeneratedOperation } from './execute';
import { generatedOperationOptions, generatedProperties, generatedResources } from './generated';

type OperationOption = { name: string; value: string; description: string; action: string };

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

// The five original resources and their hand-written operations keep their values so saved
// workflows keep running; every other resource and operation comes from the generated files.
const LEGACY_RESOURCES = [
  { name: 'AI Content', value: 'aiContent' },
  { name: 'Library', value: 'library' },
  { name: 'Post', value: 'post' },
  { name: 'Social Account', value: 'socialAccount' },
  { name: 'Workspace', value: 'workspace' },
];

const LEGACY_OPERATIONS: Record<string, OperationOption[]> = {
  aiContent: [
    { name: 'Generate Image', value: 'generateImage', description: 'Generate an image using AI', action: 'Generate image' },
    { name: 'Generate Text', value: 'generateText', description: 'Generate post content using AI', action: 'Generate text content' },
  ],
  library: [
    { name: 'Add Content', value: 'addContent', description: 'Add content to a library for recurring posts', action: 'Add content to library' },
    { name: 'Get Many', value: 'getAll', description: 'Get many libraries', action: 'Get many libraries' },
  ],
  post: [
    { name: 'Schedule', value: 'schedule', description: 'Schedule a post to social media accounts', action: 'Schedule a post' },
  ],
  socialAccount: [
    { name: 'Get Connection URLs', value: 'getConnectionUrls', description: 'Get URLs to connect new social media accounts', action: 'Get connection links' },
    { name: 'Get History', value: 'getHistory', description: 'Get posting history for a social media account', action: 'Get posting history' },
    { name: 'Get Many', value: 'getAll', description: 'Get many connected social media accounts', action: 'Get many social accounts' },
  ],
  workspace: [
    { name: 'Get Many', value: 'getAll', description: 'Get many workspaces you are a member of', action: 'Get many workspaces' },
  ],
};

const RESOURCE_OPTIONS = [...LEGACY_RESOURCES, ...generatedResources.filter((r) => !LEGACY_RESOURCES.some((l) => l.value === r.value))].sort(byName);

const OPERATION_PROPERTIES: INodeProperties[] = RESOURCE_OPTIONS.map((resource) => {
  const options = [...(LEGACY_OPERATIONS[resource.value] ?? []), ...(generatedOperationOptions[resource.value] ?? [])].sort(byName);
  const preferred = options.find((o) => o.value === 'getAll' || o.value === 'list') ?? options[0];
  const property: INodeProperties = {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    default: '',
    displayOptions: { show: { resource: [resource.value] } },
    options,
  };
  property.default = preferred.value;
  return property;
});

// Fills a dropdown from a list endpoint, scoped to the selected workspace when one is chosen.
async function loadNamed(
  ctx: ILoadOptionsFunctions,
  endpoint: string,
  listKey: string,
  label: (row: IDataObject) => string = (row) => String(row.name ?? row.id),
): Promise<INodePropertyOptions[]> {
  const body: IDataObject = {};
  const workspaceId = ctx.getCurrentNodeParameter('workspaceId') as string;
  if (workspaceId) {
    body.workspace_id = workspaceId;
  }
  const response = await recurPostRequest(ctx, endpoint, body);
  const rows = (response[listKey] ?? []) as IDataObject[];
  return rows.map((row) => ({ name: label(row), value: row.id as string | number }));
}

export class RecurPost implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'RecurPost',
    name: 'recurPost',
    icon: 'file:recurpost.svg',
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
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: RESOURCE_OPTIONS,
        default: 'post',
      },
      ...OPERATION_PROPERTIES,

      // ==========================================
      // SHARED: WORKSPACE SELECTOR
      // Shown for every operation that accepts an optional workspace_id.
      // An empty value means the account's default workspace (previous behaviour).
      // ==========================================
      {
        displayName: 'Workspace Name or ID',
        name: 'workspaceId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getWorkspaces',
        },
        default: '',
        displayOptions: {
          show: {
            resource: ['post', 'library', 'socialAccount'],
            operation: ['schedule', 'addContent', 'getAll', 'getHistory'],
          },
        },
        description: 'The workspace to operate in. Leave as Default Workspace to keep using your default workspace. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
        description: 'Select social media accounts to post to. The post is sent to each selected account separately. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
        ],
        default: 'now',
        displayOptions: {
          show: {
            resource: ['post'],
            operation: ['schedule'],
          },
        },
        description: 'Publish immediately or schedule for a future date and time',
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

      // ==========================================
      // SHARED MEDIA FIELDS (Post + Library)
      // ==========================================
      {
        displayName: 'Image URLs',
        name: 'imageUrls',
        type: 'string',
        typeOptions: {
          multipleValues: true,
          multipleValueButtonText: 'Add Image URL',
        },
        default: [],
        placeholder: 'https://example.com/image.jpg',
        displayOptions: {
          show: CUSTOMIZATION_SHOW,
        },
        description: 'One or more publicly accessible image URLs. Add multiple for a carousel/gallery post. Ignored when a video URL is set.',
      },

      // ==========================================
      // SHARED MEDIA / GENERAL OPTIONS (Post + Library)
      // ==========================================
      {
        displayName: 'Media & General Options',
        name: 'mediaOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: CUSTOMIZATION_SHOW,
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
            description: 'Default first comment, applied to all platforms that support it (overridable per platform)',
          },
          {
            displayName: 'Host Images on RecurPost',
            name: 'hostImagesOnRecurpost',
            type: 'boolean',
            default: true,
            description: 'Whether to copy the supplied images to RecurPost servers. Turn off to pass the original image URLs straight through.',
          },
          {
            displayName: 'Link URL',
            name: 'linkUrl',
            type: 'string',
            default: '',
            description: 'A website URL to share with the post (used when no image or video is provided)',
          },
          {
            displayName: 'Video URL',
            name: 'videoUrl',
            type: 'string',
            default: '',
            description: 'URL of a publicly accessible video (mp4/mov). Takes precedence over images.',
          },
        ],
      },

      // ==========================================
      // LIBRARY-ONLY: RECURRING / QUEUE OPTIONS
      // ==========================================
      {
        displayName: 'Recurring & Queue Options',
        name: 'libraryScheduleOptions',
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
            displayName: 'Go Live Date',
            name: 'contentLiveDate',
            type: 'dateTime',
            default: '',
            description: 'Keep the content as a draft until this date',
          },
          {
            displayName: 'Stop Recurring Date',
            name: 'contentExpireDate',
            type: 'dateTime',
            default: '',
            description: 'Stop recurring this content after this date',
          },
          {
            displayName: 'Top of Queue',
            name: 'isTopOfQueue',
            type: 'boolean',
            default: false,
            description: 'Whether to move this content to the top of the queue',
          },
        ],
      },

      // ==========================================
      // SHARED: PER-PLATFORM CUSTOMIZATION (Post + Library)
      // ==========================================
      {
        displayName: 'Per-Platform Message Overrides',
        name: 'platformMessages',
        type: 'collection',
        placeholder: 'Add Platform Message',
        default: {},
        displayOptions: {
          show: CUSTOMIZATION_SHOW,
        },
        options: [
          { displayName: 'Bluesky', name: 'bsMessage', type: 'string', typeOptions: { rows: 3 }, default: '', description: 'Custom message for Bluesky' },
          { displayName: 'Facebook', name: 'fbMessage', type: 'string', typeOptions: { rows: 3 }, default: '', description: 'Custom message for Facebook' },
          { displayName: 'Google Business', name: 'gmbMessage', type: 'string', typeOptions: { rows: 3 }, default: '', description: 'Custom message for Google Business Profile' },
          { displayName: 'Instagram', name: 'inMessage', type: 'string', typeOptions: { rows: 3 }, default: '', description: 'Custom message for Instagram' },
          { displayName: 'LinkedIn', name: 'lnMessage', type: 'string', typeOptions: { rows: 3 }, default: '', description: 'Custom message for LinkedIn' },
          { displayName: 'Pinterest', name: 'piMessage', type: 'string', typeOptions: { rows: 3 }, default: '', description: 'Custom message for Pinterest' },
          { displayName: 'Threads', name: 'thMessage', type: 'string', typeOptions: { rows: 3 }, default: '', description: 'Custom message for Threads' },
          { displayName: 'TikTok', name: 'tkMessage', type: 'string', typeOptions: { rows: 3 }, default: '', description: 'Custom message for TikTok' },
          { displayName: 'Twitter / X', name: 'twMessage', type: 'string', typeOptions: { rows: 3 }, default: '', description: 'Custom message for Twitter/X' },
          { displayName: 'YouTube', name: 'ytMessage', type: 'string', typeOptions: { rows: 3 }, default: '', description: 'Custom message for YouTube' },
        ],
      },
      {
        displayName: 'Facebook Options',
        name: 'facebookOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: CUSTOMIZATION_SHOW,
        },
        options: [
          {
            displayName: 'First Comment',
            name: 'fbFirstComment',
            type: 'string',
            typeOptions: { rows: 2 },
            default: '',
            description: 'Facebook-specific first comment',
          },
          {
            displayName: 'Post Type',
            name: 'fbPostType',
            type: 'options',
            options: [
              { name: 'Feed', value: 'feed' },
              { name: 'Reel', value: 'reel' },
              { name: 'Story', value: 'story' },
            ],
            default: 'feed',
            description: 'Facebook post type',
          },
        ],
      },
      {
        displayName: 'Instagram Options',
        name: 'instagramOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: CUSTOMIZATION_SHOW,
        },
        options: [
          {
            displayName: 'First Comment',
            name: 'inFirstComment',
            type: 'string',
            typeOptions: { rows: 2 },
            default: '',
            description: 'Instagram-specific first comment (feed only)',
          },
          {
            displayName: 'Post Type',
            name: 'inPostType',
            type: 'options',
            options: [
              { name: 'Feed', value: 'feed' },
              { name: 'Reel', value: 'reel' },
              { name: 'Story', value: 'story' },
            ],
            default: 'feed',
            description: 'Instagram post type',
          },
          {
            displayName: 'Share Reel to Feed',
            name: 'inReelShareInFeed',
            type: 'boolean',
            default: true,
            description: 'Whether to also share a Reel to the feed (applies when post type is Reel)',
          },
        ],
      },
      {
        displayName: 'LinkedIn Options',
        name: 'linkedinOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: CUSTOMIZATION_SHOW,
        },
        options: [
          {
            displayName: 'Document Title',
            name: 'lnDocumentTitle',
            type: 'string',
            default: '',
            description: 'Title for the LinkedIn document',
          },
          {
            displayName: 'Document URL',
            name: 'lnDocument',
            type: 'string',
            default: '',
            description: 'URL of a PDF/PPT/DOC to post as a LinkedIn document carousel',
          },
          {
            displayName: 'First Comment',
            name: 'lnFirstComment',
            type: 'string',
            typeOptions: { rows: 2 },
            default: '',
            description: 'LinkedIn-specific first comment',
          },
        ],
      },
      {
        displayName: 'Pinterest Options',
        name: 'pinterestOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: CUSTOMIZATION_SHOW,
        },
        options: [
          {
            displayName: 'Pin Title',
            name: 'piTitle',
            type: 'string',
            default: '',
            description: 'Title for the Pinterest pin',
          },
        ],
      },
      {
        displayName: 'Google Business Options',
        name: 'gmbOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: CUSTOMIZATION_SHOW,
        },
        options: [
          {
            displayName: 'Call To Action',
            name: 'gbpCta',
            type: 'string',
            default: '',
            description: 'CTA button type, e.g. Book, Order Online, Buy, Learn More, Sign Up, Call Now, Offer',
          },
          {
            displayName: 'CTA URL',
            name: 'gbpCtaUrl',
            type: 'string',
            default: '',
            description: 'URL the CTA button links to',
          },
          {
            displayName: 'Offer Coupon Code',
            name: 'gbpOfferCouponCode',
            type: 'string',
            default: '',
            description: 'Coupon code for the offer (when CTA is Offer)',
          },
          {
            displayName: 'Offer End Date',
            name: 'gbpOfferEndDate',
            type: 'string',
            default: '',
            placeholder: '2026-06-25 18:20:22',
            description: 'Offer end date in Y-m-d H:i:s format',
          },
          {
            displayName: 'Offer Redeem Link',
            name: 'gbpRedeemOfferLink',
            type: 'string',
            default: '',
            description: 'URL to redeem the offer',
          },
          {
            displayName: 'Offer Start Date',
            name: 'gbpOfferStartDate',
            type: 'string',
            default: '',
            placeholder: '2026-06-23 18:20:22',
            description: 'Offer start date in Y-m-d H:i:s format',
          },
          {
            displayName: 'Offer Terms',
            name: 'gbpOfferTerms',
            type: 'string',
            typeOptions: { rows: 2 },
            default: '',
            description: 'Terms and conditions for the offer',
          },
          {
            displayName: 'Offer Title',
            name: 'gbpOfferTitle',
            type: 'string',
            default: '',
            description: 'Offer title (when CTA is Offer)',
          },
        ],
      },
      {
        displayName: 'YouTube Options',
        name: 'youtubeOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: CUSTOMIZATION_SHOW,
        },
        options: [
          {
            displayName: 'Category',
            name: 'ytCategory',
            type: 'string',
            default: '',
            description: 'YouTube video category name',
          },
          {
            displayName: 'Made for Kids',
            name: 'ytVideoMadeForKids',
            type: 'boolean',
            default: false,
            description: 'Whether the video is made for kids',
          },
          {
            displayName: 'Privacy Status',
            name: 'ytPrivacyStatus',
            type: 'options',
            options: [
              { name: 'Private', value: 'Private' },
              { name: 'Public', value: 'Public' },
              { name: 'Unlisted', value: 'Unlisted' },
            ],
            default: 'Public',
            description: 'YouTube video privacy setting',
          },
          {
            displayName: 'Tags',
            name: 'ytUserTags',
            type: 'string',
            default: '',
            description: 'Comma-separated video tags',
          },
          {
            displayName: 'Thumbnail URL',
            name: 'ytThumb',
            type: 'string',
            default: '',
            description: 'Custom thumbnail image URL',
          },
          {
            displayName: 'Title',
            name: 'ytTitle',
            type: 'string',
            default: '',
            description: 'YouTube video title',
          },
        ],
      },
      {
        displayName: 'TikTok Options',
        name: 'tiktokOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: CUSTOMIZATION_SHOW,
        },
        options: [
          {
            displayName: 'Allow Comments',
            name: 'tkAllowComments',
            type: 'boolean',
            default: true,
            description: 'Whether to allow comments on the TikTok video',
          },
          {
            displayName: 'Allow Duet',
            name: 'tkAllowDuet',
            type: 'boolean',
            default: true,
            description: 'Whether to allow duets on the TikTok video',
          },
          {
            displayName: 'Allow Stitches',
            name: 'tkAllowStitches',
            type: 'boolean',
            default: true,
            description: 'Whether to allow stitches on the TikTok video',
          },
          {
            displayName: 'Privacy Status',
            name: 'tkPrivacyStatus',
            type: 'string',
            default: '',
            description: 'TikTok video privacy setting',
          },
          {
            displayName: 'Promote Other Brand',
            name: 'tkPromoteOtherBrand',
            type: 'boolean',
            default: false,
            description: 'Whether the video promotes another brand (branded content)',
          },
          {
            displayName: 'Promote Own Brand',
            name: 'tkPromoteOwnBrand',
            type: 'boolean',
            default: false,
            description: 'Whether the video promotes your own brand (your brand / business)',
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
        displayName: 'Conversation Options',
        name: 'aiOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: {
            resource: ['aiContent'],
            operation: ['generateText'],
          },
        },
        options: [
          {
            displayName: 'AI Session ID',
            name: 'aiId',
            type: 'string',
            default: '',
            description: 'AI session ID returned by a previous Generate Text call, to continue the conversation',
          },
          {
            displayName: 'Chat History (JSON)',
            name: 'chatHistory',
            type: 'string',
            typeOptions: { rows: 4 },
            default: '',
            description: 'JSON array of previous messages, e.g. [{"role":"user","content":"..."},{"role":"system","content":"..."}], returned by a previous Generate Text call',
          },
          {
            displayName: 'Chat Progress',
            name: 'chatProgress',
            type: 'string',
            default: '',
            description: 'Chat progress marker returned by a previous Generate Text call (required when continuing a session)',
          },
        ],
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
      {
        displayName: 'History Options',
        name: 'historyOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: {
            resource: ['socialAccount'],
            operation: ['getHistory'],
          },
        },
        options: [
          {
            displayName: 'End Date',
            name: 'endDate',
            type: 'dateTime',
            default: '',
            description: 'Return posts up to this date (account timezone). Pair with Start Date.',
          },
          {
            displayName: 'Include Video Updates',
            name: 'isGetVideoUpdates',
            type: 'boolean',
            default: true,
            description: 'Whether to include video posts in the response',
          },
          {
            displayName: 'Start Date',
            name: 'startDate',
            type: 'dateTime',
            default: '',
            description: 'Return posts from this date (account timezone). Pair with End Date.',
          },
        ],
      },
      ...generatedProperties,
    ],
    usableAsTool: true,
  };

  methods = {
    loadOptions: {
      async getWorkspaces(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const response = await recurPostRequest(this, 'workspace_list', {});

        // Empty value = the account's default workspace (previous behaviour).
        const workspaces: INodePropertyOptions[] = [{ name: 'Default Workspace', value: '' }];

        if (response.status === 200 && response.workspace_list) {
          for (const workspace of response.workspace_list as IDataObject[]) {
            workspaces.push({
              name: workspace.ownership === 'shared' ? `${workspace.ws_name} (Shared)` : (workspace.ws_name as string),
              value: workspace.ws_id as string,
            });
          }
        }

        return workspaces;
      },

      async getSocialAccounts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const body: IDataObject = {};
        const workspaceId = this.getCurrentNodeParameter('workspaceId') as string;
        if (workspaceId) {
          body.workspace_id = workspaceId;
        }

        const response = await recurPostRequest(this, 'social_account_list', body);

        if (response.status !== 200 || !response.social_accounts) {
          return [];
        }

        const accounts: INodePropertyOptions[] = [];
        for (const account of response.social_accounts as IDataObject[]) {
          accounts.push({
            name: (account.smpa_name || account.smpa_id) as string,
            value: account.smpa_id as string,
          });
        }

        return accounts;
      },

      async getLibraries(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const body: IDataObject = {};
        const workspaceId = this.getCurrentNodeParameter('workspaceId') as string;
        if (workspaceId) {
          body.workspace_id = workspaceId;
        }

        const response = await recurPostRequest(this, 'library_list', body);

        if (response.status !== 200 || !response.library_list) {
          return [];
        }

        const libraries: INodePropertyOptions[] = [];
        for (const library of response.library_list as IDataObject[]) {
          libraries.push({
            name: (library.cd_name || library.cd_id) as string,
            value: library.cd_id as string,
          });
        }

        return libraries;
      },

      async getAccountGroups(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        return loadNamed(this, 'account_group_list', 'groups');
      },

      async getLabels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        return loadNamed(this, 'label_list', 'labels');
      },

      async getSchedules(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        return loadNamed(this, 'schedule_list', 'schedules', (row) => `${row.library} / ${row.account} / ${row.frequency} ${row.day ?? ''} ${row.time ?? ''}`.replace(/\s+/g, ' ').trim());
      },

      async getFeeds(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        return loadNamed(this, 'feed_list', 'feeds', (row) => String(row.title || row.url));
      },

      async getRoles(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        return loadNamed(this, 'roles', 'roles');
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const resource = this.getNodeParameter('resource', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;

    const buildCustomization = (i: number) => buildCustomizationBody(this, i);

    for (let i = 0; i < items.length; i++) {
      try {
        let responseData: IDataObject | IDataObject[] = {};

        // Optional workspace scoping — an empty value means the account's
        // default workspace (the API's behaviour when workspace_id is omitted).
        const workspaceId = this.getNodeParameter('workspaceId', i, '') as string;
        const workspaceBody: Record<string, string> = workspaceId ? { workspace_id: workspaceId } : {};

        const generated = findOperation(resource, operation);

        if (generated) {
          responseData = await runGeneratedOperation(this, generated, i);
        }

        // ==========================================
        // POST OPERATIONS
        // ==========================================
        else if (resource === 'post') {
          if (operation === 'schedule') {
            const socialAccounts = this.getNodeParameter('socialAccounts', i) as string[];
            const content = this.getNodeParameter('content', i) as string;
            const scheduleType = this.getNodeParameter('scheduleType', i) as string;

            const baseBody: Record<string, string> = {
              message: content,
              ...workspaceBody,
              ...buildCustomization(i),
            };

            if (scheduleType === 'scheduled') {
              const scheduleDateTime = this.getNodeParameter('scheduleDateTime', i) as string;
              if (scheduleDateTime) {
                baseBody.schedule_date_time = formatDateTime(scheduleDateTime, true);
              }
            }

            // The API accepts a single social account ID per call, so post to
            // each selected account separately and collect every response.
            const responses: IDataObject[] = [];
            for (const accountId of socialAccounts) {
              const accountResponse = await recurPostRequest(this, 'post_content', { ...baseBody, id: accountId }, i);
              responses.push({ social_account_id: accountId, ...accountResponse });
            }

            responseData = responses.length === 1 ? responses[0] : responses;
          }
        }

        // ==========================================
        // LIBRARY OPERATIONS
        // ==========================================
        else if (resource === 'library') {
          if (operation === 'getAll') {
            responseData = await recurPostRequest(this, 'library_list', workspaceBody, i);

            if (responseData.library_list) {
              responseData = responseData.library_list as IDataObject[];
            }
          } else if (operation === 'addContent') {
            const libraryId = this.getNodeParameter('libraryId', i) as string;
            const libraryContent = this.getNodeParameter('libraryContent', i) as string;
            const libraryScheduleOptions = this.getNodeParameter('libraryScheduleOptions', i, {}) as IDataObject;

            const body: Record<string, string> = {
              id: libraryId,
              message: libraryContent,
              ...workspaceBody,
              ...buildCustomization(i),
            };

            if (libraryScheduleOptions.isTopOfQueue === true) {
              body.is_top_of_queue = '1';
            }
            if (libraryScheduleOptions.contentLiveDate) {
              body.content_livedate = formatDateTime(libraryScheduleOptions.contentLiveDate as string, false);
            }
            if (libraryScheduleOptions.contentExpireDate) {
              body.content_expiredate = formatDateTime(libraryScheduleOptions.contentExpireDate as string, false);
            }

            responseData = await recurPostRequest(this, 'add_content_in_library', body, i);
          }
        }

        // ==========================================
        // SOCIAL ACCOUNT OPERATIONS
        // ==========================================
        else if (resource === 'socialAccount') {
          if (operation === 'getAll') {
            responseData = await recurPostRequest(this, 'social_account_list', workspaceBody, i);

            if (responseData.social_accounts) {
              responseData = responseData.social_accounts as IDataObject[];
            }
          } else if (operation === 'getConnectionUrls') {
            responseData = await recurPostRequest(this, 'connect_social_account_urls', {}, i);

            if (responseData.social_links) {
              responseData = responseData.social_links as IDataObject;
            }
          } else if (operation === 'getHistory') {
            const historyAccountId = this.getNodeParameter('historyAccountId', i) as string;
            const historyOptions = this.getNodeParameter('historyOptions', i, {}) as IDataObject;

            const body: Record<string, string> = {
              id: historyAccountId,
              ...workspaceBody,
            };

            if (historyOptions.startDate) {
              body.start_date = formatDateTime(historyOptions.startDate as string, true);
            }
            if (historyOptions.endDate) {
              body.end_date = formatDateTime(historyOptions.endDate as string, true);
            }
            if (historyOptions.isGetVideoUpdates === false) {
              body.is_get_video_updates = '0';
            }

            responseData = await recurPostRequest(this, 'history_data', body, i);

            if (responseData.history_data) {
              responseData = responseData.history_data as IDataObject[];
            }
          }
        }

        // ==========================================
        // WORKSPACE OPERATIONS
        // ==========================================
        else if (resource === 'workspace') {
          if (operation === 'getAll') {
            responseData = await recurPostRequest(this, 'workspace_list', {}, i);

            if (responseData.workspace_list) {
              responseData = responseData.workspace_list as IDataObject[];
            }
          }
        }

        // ==========================================
        // AI CONTENT OPERATIONS
        // ==========================================
        else if (resource === 'aiContent') {
          if (operation === 'generateText') {
            const aiPrompt = this.getNodeParameter('aiPrompt', i) as string;
            const aiOptions = this.getNodeParameter('aiOptions', i, {}) as IDataObject;

            const body: Record<string, string> = {
              prompt_text: aiPrompt,
            };

            if (aiOptions.aiId) {
              body.ai_id = aiOptions.aiId as string;
            }
            if (aiOptions.chatProgress) {
              body.chat_progress = aiOptions.chatProgress as string;
            }
            if (aiOptions.chatHistory) {
              let history: Array<{ role: string; content: string }>;
              try {
                history = JSON.parse(aiOptions.chatHistory as string);
              } catch {
                throw new NodeOperationError(this.getNode(), 'Chat History must be a valid JSON array', { itemIndex: i });
              }
              if (Array.isArray(history)) {
                history.forEach((msg, idx) => {
                  body[`chat_history[${idx}][role]`] = msg.role;
                  body[`chat_history[${idx}][content]`] = msg.content;
                });
              }
            }

            responseData = await recurPostRequest(this, 'generate_content_with_ai', body, i);
          } else if (operation === 'generateImage') {
            const imagePrompt = this.getNodeParameter('imagePrompt', i) as string;

            responseData = await recurPostRequest(this, 'generate_image_with_ai', { prompt_text: imagePrompt }, i);
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
        throw new NodeApiError(this.getNode(), error as any, { itemIndex: i });
      }
    }

    return [returnData];
  }
}
