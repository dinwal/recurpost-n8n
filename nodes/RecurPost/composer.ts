import { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { generatedComposerShow } from './generated';

// Maps n8n collection field names (camelCase) to the exact RecurPost API
// parameter names (snake_case). Only string / options fields live here;
// boolean fields are handled explicitly in buildCustomizationBody() because
// each one has its own truthy/falsy encoding on the API side.
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
  ytPrivacyStatus: 'yt_privacy_status',
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

// Formats an n8n dateTime value to the formats RecurPost expects.
export function formatDateTime(value: string, includeTime: boolean): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  if (!includeTime) {
    return `${yyyy}-${mm}-${dd}`;
  }
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

// Shared media + per-platform customization options. Post > Schedule and Library > Add Content
// take this parameter set, and so do the generated operations that rewrite a post (draft save,
// queue item update, library content update, approval edit), listed in generatedComposerShow.
export const CUSTOMIZATION_SHOW = {
  resource: [...new Set(['post', 'library', ...generatedComposerShow.resource])],
  operation: [...new Set(['schedule', 'addContent', ...generatedComposerShow.operation])],
};

// Builds the shared media + per-platform customization portion of the request
// body for the Post → Schedule and Library → Add Content operations.
// Array (multiple images) and boolean params are encoded so PHP's $_POST
// parser reconstructs them correctly (indexed bracket keys, falsy "0", etc.).
export function buildCustomizationBody(ctx: IExecuteFunctions, i: number): Record<string, string> {
  const body: Record<string, string> = {};

  // Images (array) -> image_url[0], image_url[1], ...
  const imageUrls = (ctx.getNodeParameter('imageUrls', i, []) as string[]) || [];
  imageUrls.filter((u) => u && u.trim() !== '').forEach((u, idx) => {
    body[`image_url[${idx}]`] = u;
  });

  // Media & general options
  const mediaOptions = ctx.getNodeParameter('mediaOptions', i, {}) as IDataObject;
  if (mediaOptions.videoUrl) {
    body.video_url = mediaOptions.videoUrl as string;
  }
  if (mediaOptions.linkUrl) {
    body.url = mediaOptions.linkUrl as string;
  }
  if (mediaOptions.firstComment) {
    body.first_comment = mediaOptions.firstComment as string;
  }
  // PHP treats the string "0" as falsy, so send "0"/"1" (not "false"/"true").
  if (mediaOptions.hostImagesOnRecurpost === false) {
    body.host_images_on_recurpost = '0';
  }

  // String / options per-platform collections (camelCase name -> API key)
  for (const [collectionName, map] of STRING_COLLECTION_MAPS) {
    const collection = ctx.getNodeParameter(collectionName, i, {}) as IDataObject;
    for (const [fieldName, apiKey] of Object.entries(map)) {
      const value = collection[fieldName];
      if (value !== undefined && value !== '') {
        body[apiKey] = value as string;
      }
    }
  }

  // Boolean per-platform fields with custom yes/no/1 encodings
  const instagramOptions = ctx.getNodeParameter('instagramOptions', i, {}) as IDataObject;
  if (instagramOptions.inReelShareInFeed === false) {
    body.in_reel_share_in_feed = 'no';
  }

  const youtubeOptions = ctx.getNodeParameter('youtubeOptions', i, {}) as IDataObject;
  if (youtubeOptions.ytVideoMadeForKids === true) {
    body.yt_video_made_for_kids = 'yes';
  }

  const tiktokOptions = ctx.getNodeParameter('tiktokOptions', i, {}) as IDataObject;
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
    body.tk_promote_own_brand = '1';
  }
  if (tiktokOptions.tkPromoteOtherBrand === true) {
    body.tk_promote_other_brand = '1';
  }

  return body;
}
