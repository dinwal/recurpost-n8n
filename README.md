# n8n-nodes-recurpost

This is an n8n community node for [RecurPost](https://recurpost.com) - the social media scheduling tool that helps you automate and recycle your content.

## Features

- **Schedule Posts** - Post to multiple social media accounts instantly or at a scheduled time
- **Multiple Images** - Attach several images to a single post or library item (carousel/gallery)
- **Per-Platform Customization** - Override the message and set platform-specific options for Facebook, Instagram, LinkedIn, Pinterest, Google Business, YouTube, TikTok, Threads, Bluesky and Twitter/X
- **Manage Libraries** - Add content to your recurring content libraries, with go-live / expiry dates and top-of-queue
- **Get Social Accounts** - Retrieve list of connected social media accounts
- **Posting History** - Pull posting history for an account, optionally over a date range
- **AI Content Generation** - Generate post text (with multi-turn conversation) and images using AI

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

## Operations

### Post

| Operation | Description |
|-----------|-------------|
| Schedule | Schedule a post to one or more social media accounts (sent to each account separately) |

**Schedule Type:**
- **Post Now** - Publish immediately
- **Schedule for Later** - Set a specific date and time

**Media & General Options:**
- Image URLs (add multiple for a carousel/gallery)
- Video URL
- Link URL
- First Comment (default, applied to all platforms)
- Host Images on RecurPost (turn off to pass original image URLs straight through)

**Per-Platform Options** (apply to both Schedule and Add Content):
- **Per-Platform Message Overrides** - a custom message for any of the 10 supported networks
- **Facebook** - post type (feed/reel/story), first comment
- **Instagram** - post type, share reel to feed, first comment
- **LinkedIn** - document URL + title (document carousel), first comment
- **Pinterest** - pin title
- **Google Business** - CTA + URL, offer title/dates/coupon/terms/redeem link
- **YouTube** - title, category, privacy, tags, thumbnail, made-for-kids
- **TikTok** - privacy, allow comments/duet/stitches, branded content flags

### Library

| Operation | Description |
|-----------|-------------|
| Add Content | Add content to a library for recurring posts |
| Get All | Retrieve all your content libraries |

**Add Content** supports all the media and per-platform options above, plus:
- Go Live Date (keep as draft until)
- Stop Recurring Date (expire after)
- Top of Queue

### Social Account

| Operation | Description |
|-----------|-------------|
| Get All | Get all connected social media accounts |
| Get Connection URLs | Get URLs to connect new social media accounts |
| Get History | Get posting history for a specific social account (optional start/end date range and video-update filter) |

### AI Content

| Operation | Description |
|-----------|-------------|
| Generate Text | Generate post content using AI (supports multi-turn conversation via session ID, chat progress and chat history) |
| Generate Image | Generate an image using AI |

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
