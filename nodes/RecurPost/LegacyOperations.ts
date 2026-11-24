import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { formatDateTime, toList } from './GenericFunctions';

// The operations the node had before API v2, kept with the same resource / operation
// values and field names so saved workflows keep opening. Each one now builds the v2
// JSON body of its endpoint. Catalog params a hand-built operation does not fill itself
// are offered in its Additional Fields collection.

export interface LegacyOperation {
  resource: string;
  operation: string;
  endpoint: string;
  name: string;
  description: string;
  action: string;
  // Catalog params the hand-built fields (or the credential) fill
  covered: string[];
  // Answer key whose list is returned as one item per entry, as before v2
  unwrap?: string;
  buildBody(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> | IDataObject;
}

// Collection field (camelCase) -> API param for the string / option fields of the
// shared per-platform options.
const PLATFORM_MESSAGE_MAP: Record<string, string> = {
  bsMessage: 'bs_message',
  fbMessage: 'fb_message',
  gmbMessage: 'gmb_message',
  inMessage: 'in_message',
  lnMessage: 'ln_message',
  piMessage: 'pi_message',
  thMessage: 'th_message',
  tkMessage: 'tk_message',
  twMessage: 'tw_message',
  ytMessage: 'yt_message',
};

const FACEBOOK_MAP: Record<string, string> = {
  fbFirstComment: 'fb_first_comment',
  fbPostType: 'fb_post_type',
};

const INSTAGRAM_MAP: Record<string, string> = {
  inFirstComment: 'in_first_comment',
  inPostType: 'in_post_type',
};

const LINKEDIN_MAP: Record<string, string> = {
  lnDocument: 'ln_document',
  lnDocumentTitle: 'ln_document_title',
  lnFirstComment: 'ln_first_comment',
};

const PINTEREST_MAP: Record<string, string> = {
  piTitle: 'pi_title',
};

const GMB_MAP: Record<string, string> = {
  gbpCta: 'gbp_cta',
  gbpCtaUrl: 'gbp_cta_url',
  gbpOfferCouponCode: 'gbp_offer_coupon_code',
  gbpOfferEndDate: 'gbp_offer_end_date',
  gbpOfferStartDate: 'gbp_offer_start_date',
  gbpOfferTerms: 'gbp_offer_terms',
  gbpOfferTitle: 'gbp_offer_title',
  gbpRedeemOfferLink: 'gbp_redeem_offer_link',
};

const YOUTUBE_MAP: Record<string, string> = {
  ytCategory: 'yt_category',
  ytThumb: 'yt_thumb',
  ytTitle: 'yt_title',
  ytUserTags: 'yt_user_tags',
};

const TIKTOK_MAP: Record<string, string> = {
  tkPrivacyStatus: 'tk_privacy_status',
};

const STRING_COLLECTION_MAPS: Array<[string, Record<string, string>]> = [
  ['platformMessages', PLATFORM_MESSAGE_MAP],
  ['facebookOptions', FACEBOOK_MAP],
  ['instagramOptions', INSTAGRAM_MAP],
  ['linkedinOptions', LINKEDIN_MAP],
  ['pinterestOptions', PINTEREST_MAP],
  ['gmbOptions', GMB_MAP],
  ['youtubeOptions', YOUTUBE_MAP],
  ['tiktokOptions', TIKTOK_MAP],
];

// API params the shared media + per-platform fields fill.
const CUSTOMIZATION_PARAMS = [
  'image_url',
  'video_url',
  'url',
  'first_comment',
  'host_images_on_recurpost',
  ...STRING_COLLECTION_MAPS.flatMap(([, map]) => Object.values(map)),
  'yt_privacy_status',
  'in_reel_share_in_feed',
  'yt_video_made_for_kids',
  'tk_allow_comments',
  'tk_allow_duet',
  'tk_allow_stitches',
  'tk_promote_own_brand',
  'tk_promote_other_brand',
];

function collection(ctx: IExecuteFunctions, name: string, itemIndex: number): IDataObject {
  return (ctx.getNodeParameter(name, itemIndex, {}) as IDataObject) || {};
}

// The shared media + per-platform options of "Post > Schedule" and
// "Library > Add Content" as v2 JSON values.
// A post type combination (feed,story) is a list for post_content; library content
// takes one type, so a combination there stops with a clear error.
const POST_TYPE_PARAMS = ['fb_post_type', 'in_post_type'];

export function buildCustomizationBody(
  ctx: IExecuteFunctions,
  itemIndex: number,
  multiplePostTypes = false,
): IDataObject {
  const body: IDataObject = {};

  const imageUrls = toList(ctx.getNodeParameter('imageUrls', itemIndex, []))
    .map((url) => String(url).trim())
    .filter((url) => url !== '');
  if (imageUrls.length > 0) {
    body.image_url = imageUrls;
  }

  const mediaOptions = collection(ctx, 'mediaOptions', itemIndex);
  if (mediaOptions.videoUrl) {
    body.video_url = mediaOptions.videoUrl;
  }
  if (mediaOptions.linkUrl) {
    body.url = mediaOptions.linkUrl;
  }
  if (mediaOptions.firstComment) {
    body.first_comment = mediaOptions.firstComment;
  }
  if (mediaOptions.hostImagesOnRecurpost === false) {
    body.host_images_on_recurpost = false;
  }

  for (const [collectionName, map] of STRING_COLLECTION_MAPS) {
    const values = collection(ctx, collectionName, itemIndex);
    for (const [field, param] of Object.entries(map)) {
      const value = values[field];
      if (value !== undefined && value !== '') {
        body[param] = value;
      }
    }
  }

  for (const param of POST_TYPE_PARAMS) {
    const value = body[param];
    if (typeof value !== 'string' || !value.includes(',')) {
      continue;
    }
    if (!multiplePostTypes) {
      throw new NodeOperationError(
        ctx.getNode(),
        'Library content takes one post type. Pick Feed, Reel or Story, or schedule the post with Post > Schedule to send several types.',
        { itemIndex },
      );
    }
    body[param] = value.split(',');
  }

  const instagramOptions = collection(ctx, 'instagramOptions', itemIndex);
  if (instagramOptions.inReelShareInFeed === false) {
    body.in_reel_share_in_feed = 'no';
  }

  const youtubeOptions = collection(ctx, 'youtubeOptions', itemIndex);
  if (youtubeOptions.ytPrivacyStatus) {
    // The field keeps its old option values (Public, Private, Unlisted); v2 takes lower case.
    body.yt_privacy_status = String(youtubeOptions.ytPrivacyStatus).toLowerCase();
  }
  if (youtubeOptions.ytVideoMadeForKids === true) {
    body.yt_video_made_for_kids = 'yes';
  }

  const tiktokOptions = collection(ctx, 'tiktokOptions', itemIndex);
  if (tiktokOptions.tkAllowComments === false) {
    body.tk_allow_comments = 'no';
  }
  if (tiktokOptions.tkAllowDuet === false) {
    body.tk_allow_duet = 'no';
  }
  if (tiktokOptions.tkAllowStitches === false) {
    body.tk_allow_stitches = 'no';
  }
  if (tiktokOptions.tkPromoteOwnBrand === true) {
    body.tk_promote_own_brand = 1;
  }
  if (tiktokOptions.tkPromoteOtherBrand === true) {
    body.tk_promote_other_brand = 1;
  }

  return body;
}

function buildChatHistory(ctx: IExecuteFunctions, value: unknown, itemIndex: number): IDataObject[] {
  let history: unknown = value;
  if (typeof value === 'string') {
    try {
      history = JSON.parse(value);
    } catch {
      throw new NodeOperationError(ctx.getNode(), 'Chat History must be a valid JSON array', { itemIndex });
    }
  }
  if (!Array.isArray(history)) {
    throw new NodeOperationError(ctx.getNode(), 'Chat History must be a valid JSON array', { itemIndex });
  }
  return (history as IDataObject[]).map((message) => ({ role: message.role, content: message.content }));
}

export const LEGACY_OPERATIONS: LegacyOperation[] = [
  {
    resource: 'post',
    operation: 'schedule',
    endpoint: 'post_content',
    name: 'Schedule',
    description: 'Publish a post now or schedule it on one or more social accounts',
    action: 'Schedule a post',
    covered: ['id', 'message', 'schedule_date_time', ...CUSTOMIZATION_PARAMS],
    buildBody(ctx, i) {
      const body: IDataObject = {
        id: toList(ctx.getNodeParameter('socialAccounts', i, [])).map((id) => String(id)),
        message: ctx.getNodeParameter('content', i, '') as string,
        ...buildCustomizationBody(ctx, i, true),
      };
      if (ctx.getNodeParameter('scheduleType', i, 'now') === 'scheduled') {
        const scheduleDateTime = ctx.getNodeParameter('scheduleDateTime', i, '') as string;
        if (scheduleDateTime) {
          body.schedule_date_time = formatDateTime(scheduleDateTime, true);
        }
      }
      return body;
    },
  },
  {
    resource: 'library',
    operation: 'addContent',
    endpoint: 'add_content_in_library',
    name: 'Add Content',
    description: 'Add content to a library for recurring posts',
    action: 'Add content to library',
    covered: ['id', 'message', 'is_top_of_queue', 'content_livedate', 'content_expiredate', ...CUSTOMIZATION_PARAMS],
    buildBody(ctx, i) {
      const body: IDataObject = {
        id: ctx.getNodeParameter('libraryId', i, '') as string,
        message: ctx.getNodeParameter('libraryContent', i, '') as string,
        ...buildCustomizationBody(ctx, i),
      };
      const options = collection(ctx, 'libraryScheduleOptions', i);
      if (options.isTopOfQueue === true) {
        body.is_top_of_queue = 1;
      }
      if (options.contentLiveDate) {
        body.content_livedate = formatDateTime(options.contentLiveDate, false);
      }
      if (options.contentExpireDate) {
        body.content_expiredate = formatDateTime(options.contentExpireDate, false);
      }
      return body;
    },
  },
  {
    resource: 'library',
    operation: 'getAll',
    endpoint: 'library_list',
    name: 'Get Many',
    description: 'Get many libraries',
    action: 'Get many libraries',
    covered: [],
    unwrap: 'library_list',
    buildBody: () => ({}),
  },
  {
    resource: 'socialAccount',
    operation: 'getAll',
    endpoint: 'social_account_list',
    name: 'Get Many',
    description: 'Get many connected social media accounts',
    action: 'Get many social accounts',
    covered: [],
    unwrap: 'social_accounts',
    buildBody: () => ({}),
  },
  {
    resource: 'socialAccount',
    operation: 'getConnectionUrls',
    endpoint: 'connect_social_account_urls',
    name: 'Get Connection URLs',
    description: 'Get URLs to connect new social media accounts',
    action: 'Get connection links',
    covered: [],
    unwrap: 'social_links',
    buildBody: () => ({}),
  },
  {
    resource: 'socialAccount',
    operation: 'getHistory',
    endpoint: 'history_data',
    name: 'Get History',
    description: 'Get posting history for a social media account',
    action: 'Get posting history',
    covered: ['id', 'start_date', 'end_date', 'is_get_video_updates'],
    unwrap: 'history_data',
    buildBody(ctx, i) {
      const body: IDataObject = { id: ctx.getNodeParameter('historyAccountId', i, '') as string };
      const options = collection(ctx, 'historyOptions', i);
      if (options.startDate) {
        body.start_date = formatDateTime(options.startDate, true);
      }
      if (options.endDate) {
        body.end_date = formatDateTime(options.endDate, true);
      }
      if (options.isGetVideoUpdates === false) {
        body.is_get_video_updates = false;
      }
      return body;
    },
  },
  {
    resource: 'workspace',
    operation: 'getAll',
    endpoint: 'workspace_list',
    name: 'Get Many',
    description: 'Get many workspaces you are a member of',
    action: 'Get many workspaces',
    covered: [],
    unwrap: 'workspace_list',
    buildBody: () => ({}),
  },
  {
    resource: 'aiContent',
    operation: 'generateText',
    endpoint: 'generate_content_with_ai',
    name: 'Generate Text',
    description: 'Generate post content using AI',
    action: 'Generate text content',
    covered: ['prompt_text', 'ai_id', 'chat_progress', 'chat_history'],
    buildBody(ctx, i) {
      const body: IDataObject = { prompt_text: ctx.getNodeParameter('aiPrompt', i, '') as string };
      const options = collection(ctx, 'aiOptions', i);
      if (options.aiId) {
        body.ai_id = options.aiId;
      }
      if (options.chatProgress) {
        body.chat_progress = options.chatProgress;
      }
      if (options.chatHistory) {
        body.chat_history = buildChatHistory(ctx, options.chatHistory, i);
      }
      return body;
    },
  },
  {
    resource: 'aiContent',
    operation: 'generateImage',
    endpoint: 'generate_image_with_ai',
    name: 'Generate Image',
    description: 'Generate an image using AI',
    action: 'Generate image',
    covered: ['prompt_text'],
    buildBody: (ctx, i) => ({ prompt_text: ctx.getNodeParameter('imagePrompt', i, '') as string }),
  },
  {
    resource: 'auth',
    operation: 'userLogin',
    endpoint: 'user_login',
    name: 'Log In',
    description:
      'Log in with the email and API key of the credential and return the account and token expiry (the token itself is not returned)',
    action: 'Log in',
    covered: ['emailid', 'api_key'],
    async buildBody(ctx) {
      const credentials = await ctx.getCredentials('recurPostApi');
      return { emailid: credentials.email, api_key: credentials.apiKey };
    },
  },
];
