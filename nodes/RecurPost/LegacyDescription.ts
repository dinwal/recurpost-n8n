import type { INodeProperties } from 'n8n-workflow';

// The hand-built fields of the operations the node had before API v2 (Post > Schedule,
// Library > Add Content, AI, Social Account history). Their names, types and defaults
// are kept as they were so saved workflows keep opening; LegacyOperations.ts turns them
// into the v2 request bodies.

// Shared media + per-platform customization options of "Post > Schedule" and
// "Library > Add Content", which take the same content fields on the API.
export const CUSTOMIZATION_SHOW = {
  resource: ['post', 'library'],
  operation: ['schedule', 'addContent'],
};

export const legacyProperties: INodeProperties[] = [
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
    description: 'Social accounts to post to. One post is created with an entry per account. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
        description: 'Default first comment, applied to all platforms that support it (can be overridden per platform)',
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
          { name: 'Feed + Reel', value: 'feed,reel' },
          { name: 'Feed + Story', value: 'feed,story' },
          { name: 'Feed + Story + Reel', value: 'feed,story,reel' },
          { name: 'Reel', value: 'reel' },
          { name: 'Story', value: 'story' },
          { name: 'Story + Reel', value: 'story,reel' },
        ],
        default: 'feed',
        description:
          'Facebook post type. A combination posts each type as its own post (Post > Schedule only; library content takes one type).',
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
          { name: 'Feed + Story', value: 'feed,story' },
          { name: 'Reel', value: 'reel' },
          { name: 'Story', value: 'story' },
          { name: 'Story + Reel', value: 'story,reel' },
        ],
        default: 'feed',
        description:
          'Instagram post type. A combination posts each type as its own post, the second a minute after the first (Post > Schedule only; library content takes one type). Instagram does not take feed and reel together.',
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
        description: 'CTA button type: Learn more, Sign up, Buy, Order online, Book, Call now, Offer or None',
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
        description: 'YouTube category name, for example Howto & Style, Education, Entertainment or People & Blogs',
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
        description: 'TikTok video privacy: Public to Everyone, Mutual Follow Friends or Self Only',
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
];
