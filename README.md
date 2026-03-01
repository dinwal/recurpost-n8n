# n8n-nodes-recurpost

This is an n8n community node for [RecurPost](https://recurpost.com) - the social media scheduling tool that helps you automate and recycle your content.

## Features

- **Schedule Posts** - Post to multiple social media accounts instantly, at a scheduled time, or add to your queue
- **Manage Libraries** - Add content to your recurring content libraries
- **Get Social Accounts** - Retrieve list of connected social media accounts
- **AI Content Generation** - Generate post text and images using AI

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
| Schedule | Schedule a post to one or more social media accounts |

**Schedule Options:**
- **Post Now** - Publish immediately
- **Schedule for Later** - Set a specific date and time
- **Add to Queue** - Add to your posting queue

**Additional Options:**
- Image URL
- Video URL
- Link URL
- First Comment

### Library

| Operation | Description |
|-----------|-------------|
| Add Content | Add content to a library for recurring posts |
| Get All | Retrieve all your content libraries |

### Social Account

| Operation | Description |
|-----------|-------------|
| Get All | Get all connected social media accounts |
| Get Connection URLs | Get URLs to connect new social media accounts |
| Get History | Get posting history for a specific social account |

### AI Content

| Operation | Description |
|-----------|-------------|
| Generate Text | Generate post content using AI |
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
