# n8n-nodes-recurpost

This is an n8n community node for [RecurPost](https://recurpost.com) - the social media scheduling tool that helps you automate and recycle your content.

Version 2 of the node uses **RecurPost API v2**: token login, encrypted ids, real HTTP error codes and every API module (27 resources, 302 operations).

## Features

- **Every RecurPost API v2 endpoint** - one resource per API module and one operation per endpoint, built from the RecurPost API docs
- **Schedule Posts** - Post to one or more social media accounts instantly or at a scheduled time
- **Multiple Images** - Attach several images to a single post or library item (carousel/gallery)
- **Per-Platform Customization** - Override the message and set platform-specific options for Facebook, Instagram, LinkedIn, Pinterest, Google Business, YouTube, TikTok, Threads, Bluesky and X
- **Libraries, queue, schedules, inbox, reports, feeds, approvals, workflow board and more** - see the resource list below
- **Workspaces** - Scope any operation to a workspace you own or that is shared with you; the account, library and other dropdowns follow the chosen workspace
- **Dropdowns** - Pick workspaces, social accounts, libraries, post labels, RSS feeds, AI templates, custom reports, custom fields and URL shorteners from lists

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

The **RecurPost API** credential needs:

| Field | Value |
|-------|-------|
| Email | The email address of your RecurPost account |
| API Key | Your API key from **Account Settings > API key** in RecurPost |
| API URL | `https://social.recurpost.com` (change it only for a different RecurPost host) |

How authentication works:

- n8n exchanges the email and API key for an access token at `/api/user_login` and sends it as `Authorization: Bearer <token>` on every call. The token is stored (encrypted) with the credential and lasts one hour.
- When a call answers 401 (`token_expired` or `token_invalid`, for example after the hour or after the API key was regenerated), n8n logs in again and retries the call once.
- Testing the credential logs in with `/api/user_login`, so a wrong email or key shows the API's message.
- Every request, login included, carries the header `X-RecurPost-Client: n8n`, so RecurPost shows n8n on the API key page.

## Operations

Pick a **Resource** (an API module) and an **Operation** (an endpoint). Required parameters appear as fields; optional ones are under **Additional Fields**. Field descriptions come from the RecurPost API docs.

- **Ids** are the encrypted strings the API hands out (for example `smpa_id` from Social Accounts > Get Many). Use the dropdowns or pass ids from earlier steps.
- **Lists** (such as `account_ids` without a dropdown) take a comma-separated list or a JSON array; object and object-list parameters take JSON.
- **Dates** are sent as `Y-m-d` / `Y-m-d H:i:s` in the account's timezone, keeping the digits you enter.
- **Destructive operations** have a required **Confirm** switch; the API refuses them with `confirm_required` until it is on.
- **Workspace**: operations that work in a workspace have a **Workspace** selector. Leave it on **Default Workspace** for your own default workspace.
- **Output**: one item with the API's JSON answer per input item. The v1 list operations (Get Many, Get Connection URLs, Get History) still return one item per entry.

| Resource | Operations | Operation names |
|----------|-----------:|-----------------|
| Account & Settings | 21 | Account Details, Account Limits, Account Timezone, Account Update, Billing Invoices, Custom Fields Create, Custom Fields Delete, Custom Fields Delete Value, Custom Fields List, Custom Fields Rename, Custom Fields Set Value, Email Preferences, Notifications, Plan Details, Queue Pause, Queue Resume, White Label Delete, White Label Get, White Label Set, Working Hours, X Wallet |
| Account Groups | 4 | Account Group Create, Account Group Delete, Account Group Update, Account Groups |
| AI | 15 | AI Credits, AI Hashtags, AI Settings Get, AI Settings Set, AI Special Days Generate, AI Special Days List, AI Templates Formats, AI Templates Generate, AI Templates List, AI Templates Questions, AI to Library, AI Variations, AI Week Plan, Generate Image, Generate Text |
| Approvals | 7 | Approval Approve, Approval Comment, Approval Delete, Approval Edit, Approval List, Approval Reject, Approval Resend |
| Authentication | 1 | Log In |
| Content Tools | 23 | Bags of Tags Add, Bags of Tags Delete, Bags of Tags List, Bags of Tags Update, Catalog Businesses, Catalog Create, Catalog Product Delete, Catalog Product Save, Hashtag Groups Add, Hashtag Groups Copy, Hashtag Groups Delete, Hashtag Groups List, Hashtag Groups Update, Shortener Accounts Attach, Shortener Accounts Detach, Shortener Accounts List, Testimonial Templates Add, Testimonial Templates Delete, Testimonial Templates List, Watermark Copy, Watermark Delete, Watermark Get, Watermark Set |
| Custom Reports | 9 | Custom Report Metrics, Custom Report PDF, Custom Report Templates, Custom Reports Data, Custom Reports Delete, Custom Reports Duplicate, Custom Reports Get, Custom Reports List, Custom Reports Save |
| DM Automations | 9 | DM Automation, DM Automation Accounts, DM Automation Create, DM Automation Delete, DM Automation List, DM Automation Posts, DM Automation Stats, DM Automation Status, DM Automation Update |
| Drafts | 4 | Delete Draft, Draft List, Save Draft, Schedule Draft |
| History | 4 | Copy History Post to Library, History Data, History List, Unpublish Post |
| Import | 5 | Fetch Older Posts, Import Accounts, Import Posts, Import To Library, Refresh Import |
| Inbox | 28 | AI Review Summary, Inbox Accounts, Inbox AI Reply, Inbox Assign, Inbox Bookmark Add, Inbox Bookmark Remove, Inbox Comments, Inbox Conversation, Inbox Delete Comment, Inbox Item, Inbox Item Labels Add, Inbox Item Labels Remove, Inbox Item Labels Set, Inbox Label Create, Inbox Label Delete, Inbox Label List, Inbox Label Update, Inbox Like, Inbox List, Inbox Mark Reviewed, Inbox Mark Unreviewed, Inbox Reply Comment, Inbox Reply Message, Inbox Sync, Inbox Team Members, Inbox Unassign, Inbox Unlike, Save Inbox Item to Library |
| Libraries | 22 | Add Content, Content Variation Add, Content Variation Delete, Content Variation List, Content Variation Update, Get Many, Library Content, Library Content Copy, Library Content Delete, Library Content List, Library Content Move, Library Content Order Move, Library Content Order Shuffle, Library Content Search, Library Create, Library Delete, Library Details, Library Duplicate, Library Pause, Library Resume, Library Update, Update Library Content |
| Library Tools | 22 | Expired Content Delete, Expired Content Expire, Expired Content List, Expired Content Restore, Library Bulk Edit Append, Library Bulk Edit Count, Library Bulk Edit Replace, Library Comments Add, Library Comments List, Library Comments Mark, Library Drafts Delete, Library Drafts Get, Library Drafts List, Library Drafts Publish, Library Drafts Update, Library Pointers List, Library Pointers Reset, Library Pointers Set, Library Share Create, Library Share Get, Library Share Invite, Library Share Reset |
| Media | 1 | Media List |
| Post Labels | 7 | Label Assign Add, Label Assign Remove, Label Assign Set, Label Create, Label Delete, Label List, Label Update |
| Posts | 6 | Instagram Locations, Post Details, Post Status, Schedule, Shorten URL, URL Preview |
| Queue | 9 | Add Accounts to Queued Post, Calendar, Delete Queue Items, Publish Now, Queue Item, Queue List, Reschedule Queue Items, Retry Failed Post, Update Queue Item |
| Reports | 9 | Account Report, Ads Report, Pinterest Pins Report, Post Metrics Report, Report AI Chat, Report by Label, Report PDF, X Report Fetch, X Report Quote |
| RSS Feeds | 12 | Create Feed, Feed Delete, Feed Item Approve, Feed Item Approve All, Feed Item Reject, Feed Item Reject All, Feed Items, Feed List, Feed Pause, Feed Resume, Refresh Feed, Update Feed |
| Schedules | 8 | Create Schedule, Delete Schedule, Schedule Calendar, Schedule Copy, Schedule List, Schedule Move Slot, Schedule Remaining, Update Schedule |
| Shared Calendars | 11 | Shared Calendar Clients, Shared Calendar Comments Add, Shared Calendar Comments List, Shared Calendar Comments Mark, Shared Calendar Create, Shared Calendar Delete, Shared Calendar Get, Shared Calendar Invite Client, Shared Calendar Link, Shared Calendar Remove Client, Shared Calendar Update |
| Social Accounts | 15 | Click Tracking, Facebook Backgrounds, Get Connection URLs, Get History, Get Many, Instagram Audio Search, Instagram Products, Mention Search, Share Connect Link, Social Account Details, Social Account Remove, Social Account Rename, Social Account Status, TikTok Options, YouTube Options |
| Team Roles | 8 | Role Create, Role Delete, Role Duplicate, Role Permissions, Role Rename, Role Set Notification, Role Set Permissions, Roles |
| Workflow Board | 17 | Workflow Board, Workflow Card, Workflow Card Advance, Workflow Card Comment, Workflow Card Convert, Workflow Card Delete, Workflow Card Move, Workflow Card Reassign, Workflow Card Request Changes, Workflow Client Approve, Workflow Client Comment, Workflow Client Reject, Workflow Idea Create, Workflow Idea Edit, Workflow Post Create, Workflow Post Edit, Workflow Urgent |
| Workflow Settings | 6 | Workflow Settings Create, Workflow Settings Get, Workflow Settings Ideas, Workflow Settings Update, Workflow Stage Delete, Workflow Stage Save |
| Workspaces | 19 | Get Many, Workspace Clone, Workspace Create, Workspace Delete, Workspace Details, Workspace Invite, Workspace Invite Resend, Workspace Libraries Add, Workspace Libraries Remove, Workspace Member Remove, Workspace Member Update, Workspace Members, Workspace Report Emails Add, Workspace Report Emails Delete, Workspace Report Emails List, Workspace Report Emails Update, Workspace Social Accounts Add, Workspace Social Accounts Remove, Workspace Update |

### Post > Schedule (hand-built)

Creates one post on all selected social accounts, published now or at **Schedule Date & Time**.

**Media & General Options:** image URLs (add several for a carousel), video URL, link URL, first comment, host images on RecurPost.

**Per-Platform Options** (also on Library > Add Content):
- **Per-Platform Message Overrides** - a custom message for any of the 10 supported networks
- **Facebook** - post type (feed/reel/story), first comment
- **Instagram** - post type, share reel to feed, first comment
- **LinkedIn** - document URL + title (document carousel), first comment
- **Pinterest** - pin title
- **Google Business** - CTA + URL, offer title/dates/coupon/terms/redeem link
- **YouTube** - title, category, privacy, tags, thumbnail, made-for-kids
- **TikTok** - privacy, allow comments/duet/stitches, branded content flags

Every other `post_content` parameter (alt text, per-network media, X threads, Instagram location, tags, collaborators and audio, YouTube playlists, AI labels and more) is under **Additional Fields**.

### Library > Add Content (hand-built)

The same media and per-platform options, plus Go Live Date, Stop Recurring Date and Top of Queue, and the other `add_content_in_library` parameters under **Additional Fields**.

### Authentication > Log In

Logs in with the credential and returns the account (`user_info`) and the token expiry. The token itself is never output.

## Upgrading from 1.x

Version 2.0.0 moves to API v2, which breaks some 1.x setups:

- **Credential**: the same email, API key and API URL; nothing to change. n8n now logs in at `/api/user_login` on first use instead of sending the key with every request.
- **Saved workflows** keep opening: the resources, operations and field names of 1.x are unchanged.
- **Ids**: API v2 takes only encrypted ids. Numeric social account or library ids saved in 1.x workflows (typed in, or picked from a 1.x dropdown) answer `400 invalid_id`; pick them again from the dropdowns.
- **Post > Schedule** now makes **one** post across all selected accounts (one request, one item with `post_data.id` for `post_status`) instead of one request and one output item per account.
- **Errors** now fail the node with the API's `error` and `code` (and `Retry-After` on a 429) instead of coming back as HTTP 200 items. With **Continue On Fail** the item holds `error`, `code` and `status`.
- **Workspace**: AI and Get Connection URLs now have the Workspace selector too.

## Updating the endpoint catalog

The node builds its resources, operations and fields from `nodes/RecurPost/catalog.json`, generated from the RecurPost API docs repository:

```bash
npm run sync-catalog -- ../recurpost-apis
npm run build
```

## Example Workflows

### Schedule a Post from RSS Feed

1. **RSS Feed Read** node - Get new articles
2. **RecurPost** node - Post > Schedule with the article title and link
3. Select the social accounts to post to

### Add Blog Posts to Library

1. **Webhook** node - Receive a new blog post notification
2. **RecurPost** node - Library > Add Content to a recurring library
3. The content is recycled by the library's schedules

## Development

```bash
npm install
npm run lint
npm run build
npm test
```

## Support

- [RecurPost Help Center](https://help.recurpost.com)
- [RecurPost API docs](https://developers.recurpost.com/)
- [n8n Community](https://community.n8n.io)

## License

MIT

## Links

- [RecurPost Website](https://recurpost.com)
- [n8n Website](https://n8n.io)
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)
