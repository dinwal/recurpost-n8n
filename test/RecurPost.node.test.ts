/* eslint-disable @n8n/community-nodes/no-restricted-imports -- vitest is a devDependency; tests are excluded from the published package */
import { describe, it, expect } from 'vitest';
import { RecurPost } from '../nodes/RecurPost/RecurPost.node';

interface HttpCall {
  url: string;
  body: Record<string, unknown>;
}

// Minimal stand-in for IExecuteFunctions / ILoadOptionsFunctions. Node
// parameters come from `params`; every HTTP call is recorded and answered
// from `responses` (keyed by URL suffix, first match wins).
function createContext(
  params: Record<string, unknown>,
  responses: Array<[string, unknown]> = [['', { status: 200, message: 'Success' }]],
) {
  const calls: HttpCall[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx: any = {
    getInputData: () => [{ json: {} }],
    getCredentials: async () => ({
      email: 'test@example.com',
      apiKey: 'test-key',
      apiUrl: 'https://api.test',
    }),
    getNodeParameter: (name: string, _i: number, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(params, name) ? params[name] : fallback,
    getCurrentNodeParameter: (name: string) => params[name],
    continueOnFail: () => false,
    getNode: () => ({ name: 'RecurPost', type: 'recurPost', typeVersion: 1 }),
    helpers: {
      httpRequestWithAuthentication: async (_credName: string, options: { url: string; body: Record<string, unknown> }) => {
        calls.push({ url: options.url, body: options.body });
        const match = responses.find(([suffix]) => options.url.endsWith(suffix));
        return match ? match[1] : { status: 200, message: 'Success' };
      },
    },
  };
  return { ctx, calls };
}

async function run(params: Record<string, unknown>, responses?: Array<[string, unknown]>) {
  const { ctx, calls } = createContext(params, responses);
  const node = new RecurPost();
  const result = await node.execute.call(ctx);
  return { items: result[0], calls };
}

describe('Workspace resource', () => {
  it('Get Many calls /api/workspace_list and unwraps workspace_list', async () => {
    const workspaces = [
      { ws_id: 'enc-1', ws_name: 'Default', is_default: 1, ownership: 'own' },
      { ws_id: 'enc-2', ws_name: 'Client A', is_default: 0, ownership: 'shared' },
    ];
    const { items, calls } = await run(
      { resource: 'workspace', operation: 'getAll' },
      [['/api/workspace_list', { status: 200, workspace_list: workspaces }]],
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.test/api/workspace_list');
    expect(items.map((i) => i.json)).toEqual(workspaces);
  });
});

describe('workspace scoping in execute()', () => {
  it('Post → Schedule sends workspace_id with each per-account request', async () => {
    const { calls } = await run({
      resource: 'post',
      operation: 'schedule',
      workspaceId: 'enc-2',
      socialAccounts: ['101', '102'],
      content: 'Hello world',
      scheduleType: 'now',
    });

    expect(calls).toHaveLength(2);
    for (const [idx, accountId] of ['101', '102'].entries()) {
      expect(calls[idx].url).toBe('https://api.test/api/post_content');
      expect(calls[idx].body).toMatchObject({
        id: accountId,
        message: 'Hello world',
        workspace_id: 'enc-2',
      });
    }
  });

  it('Post → Schedule omits workspace_id when Default Workspace is selected', async () => {
    const { calls } = await run({
      resource: 'post',
      operation: 'schedule',
      workspaceId: '',
      socialAccounts: ['101'],
      content: 'Hello world',
      scheduleType: 'now',
    });

    expect(calls[0].body).not.toHaveProperty('workspace_id');
  });

  it('Library → Add Content sends workspace_id along with library id and message', async () => {
    const { calls } = await run({
      resource: 'library',
      operation: 'addContent',
      workspaceId: 'enc-1',
      libraryId: '77',
      libraryContent: 'Evergreen tip',
      libraryScheduleOptions: { isTopOfQueue: true },
    });

    expect(calls[0].url).toBe('https://api.test/api/add_content_in_library');
    expect(calls[0].body).toMatchObject({
      id: '77',
      message: 'Evergreen tip',
      workspace_id: 'enc-1',
      is_top_of_queue: '1',
    });
  });

  it('Library → Get Many sends workspace_id and unwraps library_list', async () => {
    const libraries = [{ cd_id: '5', cd_name: 'Tips' }];
    const { items, calls } = await run(
      { resource: 'library', operation: 'getAll', workspaceId: 'enc-2' },
      [['/api/library_list', { status: 200, library_list: libraries }]],
    );

    expect(calls[0].body).toEqual({ workspace_id: 'enc-2' });
    expect(items.map((i) => i.json)).toEqual(libraries);
  });

  it('Social Account → Get Many sends workspace_id and unwraps social_accounts', async () => {
    const accounts = [{ smpa_id: '101', smpa_name: 'FB Page' }];
    const { items, calls } = await run(
      { resource: 'socialAccount', operation: 'getAll', workspaceId: 'enc-2' },
      [['/api/social_account_list', { status: 200, social_accounts: accounts }]],
    );

    expect(calls[0].body).toEqual({ workspace_id: 'enc-2' });
    expect(items.map((i) => i.json)).toEqual(accounts);
  });

  it('Social Account → Get Many sends an empty body without a workspace', async () => {
    const { calls } = await run({ resource: 'socialAccount', operation: 'getAll', workspaceId: '' });
    expect(calls[0].body).toEqual({});
  });

  it('Social Account → Get History sends account id plus workspace_id', async () => {
    const { calls } = await run({
      resource: 'socialAccount',
      operation: 'getHistory',
      workspaceId: 'enc-1',
      historyAccountId: '101',
      historyOptions: { isGetVideoUpdates: false },
    });

    expect(calls[0].url).toBe('https://api.test/api/history_data');
    expect(calls[0].body).toMatchObject({
      id: '101',
      workspace_id: 'enc-1',
      is_get_video_updates: '0',
    });
  });
});

describe('request body encoding (regression)', () => {
  it('encodes images as indexed keys and booleans in PHP-friendly form', async () => {
    const { calls } = await run({
      resource: 'post',
      operation: 'schedule',
      workspaceId: '',
      socialAccounts: ['101'],
      content: 'With media',
      scheduleType: 'now',
      imageUrls: ['https://img.test/a.jpg', ' ', 'https://img.test/b.jpg'],
      mediaOptions: { hostImagesOnRecurpost: false, firstComment: 'First!' },
      tiktokOptions: { tkAllowComments: false, tkPromoteOwnBrand: true },
      platformMessages: { fbMessage: 'FB version' },
    });

    expect(calls[0].body).toMatchObject({
      'image_url[0]': 'https://img.test/a.jpg',
      'image_url[1]': 'https://img.test/b.jpg',
      host_images_on_recurpost: '0',
      first_comment: 'First!',
      tk_allow_comments: 'no',
      tk_promote_own_brand: '1',
      fb_message: 'FB version',
    });
  });

  it('formats the schedule date as Y-m-d H:i:s', async () => {
    const { calls } = await run({
      resource: 'post',
      operation: 'schedule',
      workspaceId: '',
      socialAccounts: ['101'],
      content: 'Scheduled',
      scheduleType: 'scheduled',
      scheduleDateTime: '2026-09-01T09:05:00',
    });

    expect(calls[0].body.schedule_date_time).toBe('2026-09-01 09:05:00');
  });
});

describe('loadOptions', () => {
  it('getWorkspaces prepends Default Workspace and labels shared workspaces', async () => {
    const { ctx } = createContext({}, [
      ['/api/workspace_list', {
        status: 200,
        workspace_list: [
          { ws_id: 'enc-1', ws_name: 'Mine', is_default: 1, ownership: 'own' },
          { ws_id: 'enc-2', ws_name: 'Client A', is_default: 0, ownership: 'shared' },
        ],
      }],
    ]);

    const node = new RecurPost();
    const options = await node.methods.loadOptions.getWorkspaces.call(ctx);

    expect(options).toEqual([
      { name: 'Default Workspace', value: '' },
      { name: 'Mine', value: 'enc-1' },
      { name: 'Client A (Shared)', value: 'enc-2' },
    ]);
  });

  it('getSocialAccounts scopes the dropdown to the selected workspace', async () => {
    const { ctx, calls } = createContext({ workspaceId: 'enc-2' }, [
      ['/api/social_account_list', {
        status: 200,
        social_accounts: [{ smpa_id: '101', smpa_name: 'FB Page' }],
      }],
    ]);

    const node = new RecurPost();
    const options = await node.methods.loadOptions.getSocialAccounts.call(ctx);

    expect(calls[0].body).toEqual({ workspace_id: 'enc-2' });
    expect(options).toEqual([{ name: 'FB Page', value: '101' }]);
  });

  it('getLibraries sends no workspace_id when none is selected', async () => {
    const { ctx, calls } = createContext({}, [
      ['/api/library_list', { status: 200, library_list: [{ cd_id: '5', cd_name: 'Tips' }] }],
    ]);

    const node = new RecurPost();
    const options = await node.methods.loadOptions.getLibraries.call(ctx);

    expect(calls[0].body).toEqual({});
    expect(options).toEqual([{ name: 'Tips', value: '5' }]);
  });
});

describe('node description', () => {
  it('offers the Workspace resource and scopes the workspace selector to the right operations', () => {
    const node = new RecurPost();
    const resourceProp = node.description.properties.find((p) => p.name === 'resource');
    const resourceValues = (resourceProp?.options as Array<{ value: string }>).map((o) => o.value);
    expect(resourceValues).toContain('workspace');

    const wsProp = node.description.properties.find((p) => p.name === 'workspaceId');
    expect(wsProp).toBeDefined();
    expect(wsProp?.displayOptions?.show?.resource).toEqual(['post', 'library', 'socialAccount']);
    expect(wsProp?.displayOptions?.show?.operation).toEqual([
      'schedule',
      'addContent',
      'getAll',
      'getHistory',
    ]);
  });
});
