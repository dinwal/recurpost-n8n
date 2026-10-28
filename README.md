# n8n-nodes-recurpost

This is an n8n community node for [RecurPost](https://recurpost.com) - the social media scheduling tool that helps you automate and recycle your content.

## Features

- **The whole RecurPost API** - every public endpoint is an operation: posts, queue, drafts, libraries, schedules, approvals, workflow board, inbox, DM automations, reports, AI content, RSS feeds, labels, workspaces, team roles and account settings
- **Schedule Posts** - post to multiple social media accounts instantly or at a scheduled time, with multiple images and per-platform customisation for Facebook, Instagram, LinkedIn, Pinterest, Google Business, YouTube, TikTok, Threads, Bluesky and Twitter/X
- **Workspaces** - scope any operation to a workspace you own or share; the dropdowns follow it
- **Dropdowns everywhere** - social accounts, libraries, account groups, labels, schedules, feeds and roles are picked from lists, or set by expression

## Installation

### In n8n Desktop or Self-hosted

1. Go to **Settings** > **Community Nodes**
2. Select **Install**
3. Enter `n8n-nodes-recurpost` and click **Install**

### Manual Installation

```bash
npm install n8n-nodes-recurpost
```

## Credentials

You'll need your RecurPost API credentials:

1. Log in to your RecurPost account
2. Go to **Account Settings**
3. Find your **API Key**
4. Use your account email and API key to authenticate in n8n

The node sends them as an `Authorization: Basic` header on every request; they never travel in the request body.

### Rate limits

The API allows a number of calls per minute per account and answers `429` with the seconds to wait when it is reached. The node reports that as an error with the wait time in the message. To ride it out automatically, open the node's **Settings** and turn on **Retry On Fail** with a wait of a minute or so.

## Operations

The node exposes the whole RecurPost public API: 296 operations across 24 resources. Every operation maps to one endpoint documented at [developers.recurpost.com](https://developers.recurpost.com/); the endpoint name is shown next to each operation so you can look up field details there.

Required fields appear at the top of the node; everything optional is under **Additional Fields**. Operations that act in a workspace have a **Workspace** selector; leave it on **Default Workspace** to use your default one. Dropdowns for social accounts, libraries, account groups, labels, schedules, RSS feeds and team roles load from your account and follow the selected workspace.

Operations that delete or overwrite something send the API's `confirm` flag for you: choosing the operation is the confirmation.

### Account

| Operation | Endpoint |
|-----------|----------|
| Create Custom Field | `custom_fields:create` |
| Delete Branding | `branding:delete` |
| Delete Custom Field | `custom_fields:delete` |
| Delete Custom Field Value | `custom_fields:delete_value` |
| Get | `account_details` |
| Get Announcements | `notifications` |
| Get Billing Invoices | `billing_invoices` |
| Get Branding | `branding:get` |
| Get Limits | `account_limits` |
| Get Many Custom Fields | `custom_fields:list` |
| Get or Set Email Preferences | `email_preferences` |
| Get or Set Working Hours | `working_hours` |
| Get Plan | `plan_details` |
| Get Storage Usage | `storage_usage` |
| Rename Custom Field | `custom_fields:rename` |
| Set Branding | `branding:set` |
| Set Click Tracking | `click_tracking` |
| Set Custom Field Value | `custom_fields:set_value` |
| Set Timezone | `account_timezone` |
| Update | `account_update` |

### Account Group

| Operation | Endpoint |
|-----------|----------|
| Create | `account_group_create` |
| Delete | `account_group_delete` |
| Get | `account_group` |
| Get Many | `account_group_list` |
| Update | `account_group_update` |

### AI Content

| Operation | Endpoint |
|-----------|----------|
| Draft Week Plan | `ai_week_plan` |
| Generate From Template | `ai_templates:generate` |
| Generate Image | `generate_image_with_ai` |
| Generate Special Day Posts | `ai_special_days:generate` |
| Generate Text | `generate_content_with_ai` |
| Get Credits | `ai_credits` |
| Get Many Special Days | `ai_special_days:list` |
| Get Many Templates | `ai_templates:list` |
| Get Settings | `ai_settings:get` |
| Get Template Formats | `ai_templates:formats` |
| Get Template Questions | `ai_templates:questions` |
| Save to Library | `ai_to_library` |
| Set Settings | `ai_settings:set` |
| Suggest Hashtags | `ai_hashtags` |
| Suggest Variations | `ai_variations` |

### Approval

| Operation | Endpoint |
|-----------|----------|
| Approve | `approval_decide:approve` |
| Comment | `approval_comment` |
| Delete | `approval_delete` |
| Edit | `approval_edit` |
| Get Many | `approval_list` |
| Reject | `approval_decide:reject` |
| Resend | `approval_resend` |

### Content Tool

| Operation | Endpoint |
|-----------|----------|
| Add Hashtag Group | `hashtag_groups:add` |
| Add Tag Bag | `tag_bags:add` |
| Add Testimonial Template | `testimonial_templates:add` |
| Attach Shortener Account | `shortener_accounts:attach` |
| Copy Hashtag Groups | `hashtag_groups:copy` |
| Copy Watermark | `watermark:copy` |
| Create Catalog | `catalog:create` |
| Delete Catalog Product | `catalog:product_delete` |
| Delete Hashtag Group | `hashtag_groups:delete` |
| Delete Tag Bag | `tag_bags:delete` |
| Delete Testimonial Template | `testimonial_templates:delete` |
| Delete Watermark | `watermark:delete` |
| Detach Shortener Account | `shortener_accounts:detach` |
| Get Catalog Businesses | `catalog:businesses` |
| Get Many Hashtag Groups | `hashtag_groups:list` |
| Get Many Shortener Accounts | `shortener_accounts:list` |
| Get Many Tag Bags | `tag_bags:list` |
| Get Many Testimonial Templates | `testimonial_templates:list` |
| Get Watermark | `watermark:get` |
| Save Catalog Product | `catalog:product_save` |
| Set Watermark | `watermark:set` |
| Update Hashtag Group | `hashtag_groups:update` |
| Update Tag Bag | `tag_bags:update` |

### Custom Report

| Operation | Endpoint |
|-----------|----------|
| Delete | `custom_reports:delete` |
| Duplicate | `custom_reports:duplicate` |
| Get | `custom_reports:get` |
| Get Data | `custom_reports:data` |
| Get Many | `custom_reports:list` |
| Get PDF | `custom_report_pdf` |
| Save | `custom_reports:save` |

### DM Automation

| Operation | Endpoint |
|-----------|----------|
| Create | `dm_automation_create` |
| Delete | `dm_automation_delete` |
| Get | `dm_automation` |
| Get Many | `dm_automation_list` |
| Get Many Accounts | `dm_automation_accounts` |
| Get Many Posts | `dm_automation_posts` |
| Get Stats | `dm_automation_stats` |
| Set Status | `dm_automation_status` |
| Update | `dm_automation_update` |

### Draft

| Operation | Endpoint |
|-----------|----------|
| Delete | `draft_delete` |
| Get Many | `draft_list` |
| Save | `draft_save` |
| Schedule | `draft_schedule` |

### History

| Operation | Endpoint |
|-----------|----------|
| Copy to Library | `history_to_library` |
| Get Many | `history_list` |
| Unpublish Post | `post_unpublish` |

### Import

| Operation | Endpoint |
|-----------|----------|
| Fetch Older Posts | `import_posts_more` |
| Get Many Accounts | `import_accounts` |
| Get Many Posts | `import_posts` |
| Import to Library | `import_to_library` |
| Refresh | `import_refresh` |

### Inbox

| Operation | Endpoint |
|-----------|----------|
| Add Bookmark | `inbox_bookmark:add` |
| Add Labels | `inbox_item_labels:add` |
| Assign | `inbox_assign:assign` |
| Copy to Library | `inbox_to_library` |
| Create Label | `inbox_label_create` |
| Delete Comment | `inbox_delete_comment` |
| Delete Label | `inbox_label_delete` |
| Get AI Review Summary | `inbox_ai_review_summary` |
| Get Conversation | `inbox_conversation` |
| Get Item | `inbox_item` |
| Get Many | `inbox_list` |
| Get Many Accounts | `inbox_accounts` |
| Get Many Comments | `inbox_comments` |
| Get Many Labels | `inbox_label_list` |
| Get Many Team Members | `inbox_team_members` |
| Like | `inbox_like:like` |
| Mark Reviewed | `inbox_mark_reviewed:review` |
| Mark Unreviewed | `inbox_mark_reviewed:unreview` |
| Remove Bookmark | `inbox_bookmark:remove` |
| Remove Labels | `inbox_item_labels:remove` |
| Reply to Comment | `inbox_reply_comment` |
| Send Message | `inbox_reply_message` |
| Set Labels | `inbox_item_labels:set` |
| Suggest AI Reply | `inbox_ai_reply` |
| Sync | `inbox_sync` |
| Unassign | `inbox_assign:unassign` |
| Unlike | `inbox_like:unlike` |
| Update Label | `inbox_label_update` |

### Library

| Operation | Endpoint |
|-----------|----------|
| Add Comment | `library_comments:add` |
| Add Content | `add_content_in_library` |
| Add Content Variation | `content_variation_add` |
| Bulk Append Text | `library_bulk_edit:append` |
| Bulk Count Text | `library_bulk_edit:count` |
| Bulk Replace Text | `library_bulk_edit:replace` |
| Copy Content | `library_content_copy` |
| Create | `library_create` |
| Create Share Link | `library_share:create` |
| Delete | `library_delete` |
| Delete Content | `library_content_delete` |
| Delete Content Variation | `content_variation_delete` |
| Delete Draft | `library_drafts:delete` |
| Delete Expired Post | `expired_content:delete` |
| Duplicate | `library_duplicate` |
| Email Share Link | `library_share:invite` |
| Expire Post | `expired_content:expire` |
| Get | `library_details` |
| Get Content | `library_content` |
| Get Draft | `library_drafts:get` |
| Get Many | `library_list` |
| Get Many Comments | `library_comments:list` |
| Get Many Content Items | `library_content_list` |
| Get Many Content Variations | `content_variation_list` |
| Get Many Drafts | `library_drafts:list` |
| Get Many Expired Posts | `expired_content:list` |
| Get Many Media | `media_list` |
| Get Many Pointers | `library_pointers:list` |
| Get Share Link | `library_share:get` |
| Mark Comment | `library_comments:mark` |
| Move Content | `library_content_move` |
| Pause | `library_pause:pause` |
| Publish Draft | `library_drafts:publish` |
| Reorder Content | `library_content_order:move` |
| Reset Pointers | `library_pointers:reset` |
| Reset Share Link | `library_share:reset` |
| Restore Expired Post | `expired_content:restore` |
| Resume | `library_pause:resume` |
| Search Content | `library_content_search` |
| Set Pointer | `library_pointers:set` |
| Shuffle Content | `library_content_order:shuffle` |
| Update | `library_update` |
| Update Content Variation | `content_variation_update` |
| Update Draft | `library_drafts:update` |

### Media

| Operation | Endpoint |
|-----------|----------|
| Get Upload URL | `media_upload_url` |

### Post

| Operation | Endpoint |
|-----------|----------|
| Get Status | `post_status` |
| Get URL Preview | `url_preview` |
| Schedule | `post_content` |
| Shorten URL | `shorten_url` |
| Update Library Content | `library_content_update` |

### Post Label

| Operation | Endpoint |
|-----------|----------|
| Add to Post | `label_assign:add` |
| Create | `label_create` |
| Delete | `label_delete` |
| Get Many | `label_list` |
| Remove From Post | `label_assign:remove` |
| Set on Post | `label_assign:set` |
| Update | `label_update` |

### Queue

| Operation | Endpoint |
|-----------|----------|
| Add Accounts to Post | `queue_post_add_accounts` |
| Delete Items | `queue_post_delete` |
| Get Calendar | `calendar` |
| Get Item | `queue_post` |
| Get Many | `queue_list` |
| Publish Now | `queue_post_now` |
| Reschedule Items | `queue_reschedule` |
| Retry Failed Post | `post_retry` |
| Update Item | `queue_post_update` |

### Report

| Operation | Endpoint |
|-----------|----------|
| Ask AI About Report | `report_ai_chat` |
| Buy X Report | `report_x:fetch` |
| Get Account Report | `report_account` |
| Get Ads Report | `report_ads` |
| Get Label Report | `report_labels` |
| Get PDF | `report_pdf` |
| Get Pinterest Report | `report_pins` |
| Get Post Metrics | `report_posts` |
| Quote X Report | `report_x:quote` |

### RSS Feed

| Operation | Endpoint |
|-----------|----------|
| Approve All Items | `feed_item_decide:approve_all` |
| Approve Items | `feed_item_decide:approve` |
| Create | `feed_create` |
| Delete | `feed_status:delete` |
| Get Many | `feed_list` |
| Get Many Items | `feed_items` |
| Pause | `feed_status:pause` |
| Refresh | `feed_refresh` |
| Reject All Items | `feed_item_decide:reject_all` |
| Reject Items | `feed_item_decide:reject` |
| Resume | `feed_status:resume` |
| Update | `feed_update` |

### Schedule

| Operation | Endpoint |
|-----------|----------|
| Copy | `schedule_copy` |
| Create | `schedule_create` |
| Delete | `schedule_delete` |
| Get Calendar | `schedule_calendar` |
| Get Many | `schedule_list` |
| Get Remaining Posts | `schedule_remaining` |
| Move Slot | `schedule_move_slot` |
| Update | `schedule_update` |

### Shared Calendar

| Operation | Endpoint |
|-----------|----------|
| Add Comment | `shared_calendar_comments:add` |
| Create | `shared_calendar:create` |
| Delete | `shared_calendar:delete` |
| Get | `shared_calendar:get` |
| Get Many Clients | `shared_calendar:clients` |
| Get Many Comments | `shared_calendar_comments:list` |
| Invite Client | `shared_calendar:invite_client` |
| Mark Comment | `shared_calendar_comments:mark` |
| Remove Client | `shared_calendar:remove_client` |
| Set Public Link | `shared_calendar:link` |
| Update | `shared_calendar:update` |

### Social Account

| Operation | Endpoint |
|-----------|----------|
| Email Connect Link | `share_connect_link` |
| Get | `social_account_details` |
| Get Connection URLs | `connect_social_account_urls` |
| Get Facebook Backgrounds | `facebook_backgrounds` |
| Get History | `history_data` |
| Get Many | `social_account_list` |
| Get Many Instagram Products | `instagram_products` |
| Get TikTok Options | `tiktok_options` |
| Get X Wallet | `x_wallet` |
| Get YouTube Options | `youtube_options` |
| Pause Queue | `queue_pause:pause` |
| Remove | `social_account_remove` |
| Rename | `social_account_rename` |
| Resume Queue | `queue_pause:resume` |
| Search Instagram Audio | `instagram_audio_search` |
| Search Instagram Locations | `instagram_locations` |
| Search Mentions | `mention_search` |
| Set Status | `social_account_status` |

### Team Role

| Operation | Endpoint |
|-----------|----------|
| Create | `role_manage:create` |
| Delete | `role_manage:delete` |
| Duplicate | `role_manage:duplicate` |
| Get Many | `roles` |
| Rename | `role_manage:rename` |
| Set Notification | `role_manage:set_notification` |
| Set Permissions | `role_manage:set_permissions` |

### Workflow

| Operation | Endpoint |
|-----------|----------|
| Advance Card | `workflow_card_move:advance` |
| Client Approve Card | `workflow_client_decision:approve` |
| Client Comment on Card | `workflow_client_decision:comment` |
| Client Reject Card | `workflow_client_decision:reject` |
| Comment on Card | `workflow_card_comment` |
| Convert Card | `workflow_card_move:convert` |
| Create Workflow | `workflow_settings:create` |
| Delete Card | `workflow_card_delete` |
| Delete Stage | `workflow_stage:delete` |
| Get Board | `workflow_board` |
| Get Card | `workflow_card` |
| Get Workflow | `workflow_settings:get` |
| Move Card | `workflow_card_move:move` |
| Reassign Card | `workflow_card_move:reassign` |
| Request Card Changes | `workflow_card_move:request_changes` |
| Save Card | `workflow_card_save` |
| Save Stage | `workflow_stage:save` |
| Send Urgent Approval Email | `workflow_urgent` |
| Toggle Ideas Stage | `workflow_settings:ideas` |
| Update Workflow Settings | `workflow_settings:settings` |

### Workspace

| Operation | Endpoint |
|-----------|----------|
| Add Libraries | `workspace_libraries:add` |
| Add Report Recipient | `workspace_report_emails:add` |
| Add Social Accounts | `workspace_social_accounts:add` |
| Clone | `workspace_clone` |
| Create | `workspace_create` |
| Delete | `workspace_delete` |
| Delete Report Recipient | `workspace_report_emails:delete` |
| Get | `workspace_details` |
| Get Many | `workspace_list` |
| Get Many Members | `workspace_members` |
| Get Many Report Recipients | `workspace_report_emails:list` |
| Invite Member | `workspace_invite:invite` |
| Remove Libraries | `workspace_libraries:remove` |
| Remove Member | `workspace_member_remove` |
| Remove Social Accounts | `workspace_social_accounts:remove` |
| Resend Invite | `workspace_invite:resend` |
| Update | `workspace_update` |
| Update Member | `workspace_member_update` |
| Update Report Recipient | `workspace_report_emails:update` |

### Post content fields

**Post > Schedule**, **Library > Add Content**, **Draft > Save**, **Queue > Update Item**, **Post > Update Library Content** and **Approval > Edit** share the post composer: image URLs (several for a carousel), video URL, link URL, first comment, host-images toggle, a per-platform message override for all 10 networks, and the platform option groups:

- **Facebook** - post type (feed/reel/story), first comment
- **Instagram** - post type, share reel to feed, first comment
- **LinkedIn** - document URL + title (document carousel), first comment
- **Pinterest** - pin title
- **Google Business** - CTA + URL, offer title/dates/coupon/terms/redeem link
- **YouTube** - title, category, privacy, tags, thumbnail, made-for-kids
- **TikTok** - privacy, allow comments/duet/stitches, branded content flags

## Example Workflow

### Schedule a Post from RSS Feed

1. **RSS Feed Read** node - Get new articles
2. **RecurPost** node - Schedule post with article title and link
3. Connect to multiple social accounts

### Add Blog Posts to Library

1. **Webhook** node - Receive new blog post notification
2. **RecurPost** node - Add content to a recurring library
3. Content will be automatically recycled

## Support

- [RecurPost Help Center](https://help.recurpost.com)
- [n8n Community](https://community.n8n.io)

## License

MIT

## Links

- [RecurPost Website](https://recurpost.com)
- [n8n Website](https://n8n.io)
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)
