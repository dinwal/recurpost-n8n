/* eslint-disable @n8n/community-nodes/no-restricted-imports -- vitest is a devDependency; tests are excluded from the published package */
import { describe, it, expect } from 'vitest';
import type { INodeProperties } from 'n8n-workflow';
import { RecurPost } from '../nodes/RecurPost/RecurPost.node';
import { catalog } from '../nodes/RecurPost/catalog';
import { OPERATIONS, RESOURCES, resourceValue } from '../nodes/RecurPost/RecurPostDescription';
import { splitParams } from '../nodes/RecurPost/Fields';
import { createContext, httpError, run } from './helpers';

const node = new RecurPost();
const properties = node.description.properties;

function operationOptions(resource: string) {
  const prop = properties.find(
    (p) => p.name === 'operation' && (p.displayOptions?.show?.resource as string[] | undefined)?.[0] === resource,
  );
  return prop as INodeProperties;
}

describe('node description: every resource and operation comes from the catalog', () => {
  it('has one resource per API module, keeping the resource values of v1', () => {
    const resourceProp = properties.find((p) => p.name === 'resource')!;
    const values = (resourceProp.options as Array<{ value: string }>).map((o) => o.value);
    expect(values).toHaveLength(27);
    expect(values).toEqual(catalog.modules.map((m) => resourceValue(m.module)).sort((a, b) => {
      const nameOf = (v: string) => RESOURCES.find((r) => r.value === v)!.name;
      return nameOf(a).localeCompare(nameOf(b));
    }));
    for (const legacy of ['aiContent', 'library', 'post', 'socialAccount', 'workspace']) {
      expect(values).toContain(legacy);
    }
    expect(resourceProp.default).toBe('post');
  });

  it('maps every operation to a catalog endpoint and covers every endpoint', () => {
    const endpointIds = new Set(catalog.modules.flatMap((m) => m.endpoints.map((e) => e.id)));
    const covered = new Set<string>();
    let operationCount = 0;
    for (const resource of RESOURCES) {
      const prop = operationOptions(resource.value);
      const options = prop.options as Array<{ value: string; name: string }>;
      expect(new Set(options.map((o) => o.value)).size).toBe(options.length);
      expect(new Set(options.map((o) => o.name)).size).toBe(options.length);
      for (const option of options) {
        const definition = OPERATIONS.get(`${resource.value}:${option.value}`);
        expect(definition, `${resource.value}:${option.value}`).toBeDefined();
        expect(endpointIds.has(definition!.endpoint.id)).toBe(true);
        covered.add(definition!.endpoint.id);
        operationCount++;
      }
    }
    expect(covered).toEqual(endpointIds);
    // 301 endpoints, plus history_data offered both as Social Account > Get History and in History.
    expect(operationCount).toBe(302);
  });

  it('keeps the v1 operations, their values and their default operations', () => {
    const expected: Record<string, string[]> = {
      aiContent: ['generateImage', 'generateText'],
      library: ['addContent', 'getAll'],
      post: ['schedule'],
      socialAccount: ['getAll', 'getConnectionUrls', 'getHistory'],
      workspace: ['getAll'],
    };
    const defaults: Record<string, string> = {
      aiContent: 'generateText',
      library: 'addContent',
      post: 'schedule',
      socialAccount: 'getAll',
      workspace: 'getAll',
    };
    for (const [resource, operations] of Object.entries(expected)) {
      const prop = operationOptions(resource);
      const values = (prop.options as Array<{ value: string }>).map((o) => o.value);
      for (const operation of operations) {
        expect(values).toContain(operation);
        expect(OPERATIONS.get(`${resource}:${operation}`)?.legacy).toBeDefined();
      }
      expect(prop.default).toBe(defaults[resource]);
    }
  });

  it('keeps the v1 field names and defaults', () => {
    const byName = (name: string) => properties.find((p) => p.name === name);
    expect(byName('socialAccounts')).toMatchObject({ type: 'multiOptions', default: [] });
    expect(byName('content')).toMatchObject({ type: 'string', default: '' });
    expect(byName('scheduleType')).toMatchObject({ type: 'options', default: 'now' });
    expect(byName('libraryId')).toMatchObject({ type: 'options', default: '' });
    for (const name of [
      'scheduleDateTime', 'libraryContent', 'imageUrls', 'mediaOptions', 'libraryScheduleOptions',
      'platformMessages', 'facebookOptions', 'instagramOptions', 'linkedinOptions', 'pinterestOptions',
      'gmbOptions', 'youtubeOptions', 'tiktokOptions', 'aiPrompt', 'aiOptions', 'imagePrompt',
      'historyAccountId', 'historyOptions', 'workspaceId',
    ]) {
      expect(byName(name), name).toBeDefined();
    }
  });

  it('hand-built operations fill every required param of their endpoint', () => {
    for (const definition of OPERATIONS.values()) {
      if (definition.legacy) {
        expect(splitParams(definition.endpoint, definition.legacy.covered).required).toEqual([]);
      }
    }
  });

  it('no catalog param collides with the node parameters resource, operation or additionalFields', () => {
    for (const mod of catalog.modules) {
      for (const endpoint of mod.endpoints) {
        for (const param of endpoint.params) {
          expect(['resource', 'operation', 'additionalFields', 'workspaceId']).not.toContain(param.name);
        }
      }
    }
  });

  it('shows a workspace selector per resource for the operations that take workspace_id', () => {
    const selectors = properties.filter((p) => p.name === 'workspaceId');
    const post = selectors.find((p) => (p.displayOptions?.show?.resource as string[])[0] === 'post')!;
    expect(post.displayOptions?.show?.operation).toContain('schedule');
    const workspace = selectors.find((p) => (p.displayOptions?.show?.resource as string[])[0] === 'workspace')!;
    expect(workspace.displayOptions?.show?.operation).not.toContain('getAll');
    expect(selectors.find((p) => (p.displayOptions?.show?.resource as string[])[0] === 'auth')).toBeUndefined();
  });

  it('puts generated required params at the top level and optional ones in Additional Fields', () => {
    const show = (p: INodeProperties) => p.displayOptions?.show;
    const queue = properties.filter((p) => show(p)?.resource?.[0] === 'queue' && show(p)?.operation?.[0] === 'queueList');
    expect(queue.map((p) => p.name)).toEqual(['additionalFields']);
    const optionNames = (queue[0].options as INodeProperties[]).map((o) => o.name);
    expect(optionNames).toEqual(expect.arrayContaining(['account_id', 'library_id', 'from', 'to', 'page', 'per_page']));

    const remove = properties.filter(
      (p) => show(p)?.resource?.[0] === 'socialAccount' && show(p)?.operation?.[0] === 'socialAccountRemove',
    );
    expect(remove.map((p) => p.name)).toEqual(['account_id', 'confirm']);
    expect(remove[0]).toMatchObject({ type: 'options', required: true });
    expect(remove[1]).toMatchObject({ type: 'boolean', required: true, default: false });
  });

  it('adds the v2 params the hand-built Schedule fields do not cover as Additional Fields', () => {
    const extra = properties.find(
      (p) => p.name === 'additionalFields' && p.displayOptions?.show?.operation?.[0] === 'schedule',
    )!;
    const names = (extra.options as INodeProperties[]).map((o) => o.name);
    expect(names).toEqual(expect.arrayContaining(['alt_text', 'twitter_thread', 'fb_image_url', 'yt_playlists']));
    expect(names).not.toContain('message');
    expect(names).not.toContain('image_url');
    expect(names).not.toContain('fb_post_type');
  });
});

describe('preserved v1 operations build v2 requests', () => {
  it('Post > Schedule sends one JSON request with all accounts and v2 value types', async () => {
    const { calls, items } = await run(
      {
        resource: 'post',
        operation: 'schedule',
        workspaceId: 'ws-2',
        socialAccounts: ['acc-1', 'acc-2'],
        content: 'Hello world',
        scheduleType: 'scheduled',
        scheduleDateTime: '2026-12-01T09:05:00',
        imageUrls: ['https://img.test/a.jpg', ' ', 'https://img.test/b.jpg'],
        mediaOptions: { hostImagesOnRecurpost: false, firstComment: 'First!' },
        platformMessages: { fbMessage: 'FB version' },
        instagramOptions: { inReelShareInFeed: false, inPostType: 'reel' },
        youtubeOptions: { ytPrivacyStatus: 'Unlisted', ytVideoMadeForKids: true },
        tiktokOptions: { tkAllowComments: false, tkPromoteOwnBrand: true },
        additionalFields: { alt_text: 'One, Two', tw_made_with_ai: 1 },
      },
      [['/api/post_content', { status: 200, message: 'One-off added successfully', post_data: { id: 'p1', account_count: 2 } }]],
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      credentialType: 'recurPostApi',
      method: 'POST',
      url: 'https://api.test/api/post_content',
      json: true,
    });
    expect(calls[0].headers['X-RecurPost-Client']).toBe('n8n');
    expect(calls[0].headers['Content-Type']).toBe('application/json');
    expect(calls[0].body).toEqual({
      id: ['acc-1', 'acc-2'],
      message: 'Hello world',
      workspace_id: 'ws-2',
      schedule_date_time: '2026-12-01 09:05:00',
      image_url: ['https://img.test/a.jpg', 'https://img.test/b.jpg'],
      host_images_on_recurpost: false,
      first_comment: 'First!',
      fb_message: 'FB version',
      in_post_type: 'reel',
      in_reel_share_in_feed: 'no',
      yt_privacy_status: 'unlisted',
      yt_video_made_for_kids: 'yes',
      tk_allow_comments: 'no',
      tk_promote_own_brand: 1,
      alt_text: ['One', 'Two'],
      tw_made_with_ai: 1,
    });
    expect(items.map((i) => i.json)).toEqual([
      { status: 200, message: 'One-off added successfully', post_data: { id: 'p1', account_count: 2 } },
    ]);
  });

  it('Post > Schedule omits workspace_id and the date for Default Workspace / Post Now', async () => {
    const { calls } = await run({
      resource: 'post',
      operation: 'schedule',
      workspaceId: '',
      socialAccounts: ['acc-1'],
      content: 'Now',
      scheduleType: 'now',
      scheduleDateTime: '2026-12-01T09:05:00',
    });
    expect(calls[0].body).toEqual({ id: ['acc-1'], message: 'Now' });
  });

  it('Library > Add Content sends the library id, message, queue options and workspace', async () => {
    const { calls } = await run({
      resource: 'library',
      operation: 'addContent',
      workspaceId: 'ws-1',
      libraryId: 'lib-1',
      libraryContent: 'Evergreen tip',
      libraryScheduleOptions: {
        isTopOfQueue: true,
        contentLiveDate: '2026-11-01T00:00:00',
        contentExpireDate: '2026-12-31T00:00:00',
      },
    });
    expect(calls[0].url).toBe('https://api.test/api/add_content_in_library');
    expect(calls[0].body).toEqual({
      id: 'lib-1',
      message: 'Evergreen tip',
      workspace_id: 'ws-1',
      is_top_of_queue: 1,
      content_livedate: '2026-11-01',
      content_expiredate: '2026-12-31',
    });
  });

  it('Library / Social Account / Workspace > Get Many return one item per entry as before', async () => {
    const libraries = [{ cd_id: 'l1', cd_name: 'Tips' }];
    const lib = await run({ resource: 'library', operation: 'getAll', workspaceId: 'ws-2' }, [
      ['/api/library_list', { status: 200, library_list: libraries }],
    ]);
    expect(lib.calls[0].body).toEqual({ workspace_id: 'ws-2' });
    expect(lib.items.map((i) => i.json)).toEqual(libraries);

    const accounts = [{ smpa_id: 'a1', smpa_name: 'FB Page' }, { smpa_id: 'a2', smpa_name: 'X' }];
    const acc = await run({ resource: 'socialAccount', operation: 'getAll', workspaceId: '' }, [
      ['/api/social_account_list', { status: 200, social_accounts: accounts }],
    ]);
    expect(acc.calls[0].body).toEqual({});
    expect(acc.items.map((i) => i.json)).toEqual(accounts);

    const workspaces = [{ ws_id: 'w1', ws_name: 'Mine' }];
    const ws = await run({ resource: 'workspace', operation: 'getAll' }, [
      ['/api/workspace_list', { status: 200, workspace_list: workspaces }],
    ]);
    expect(ws.calls[0].url).toBe('https://api.test/api/workspace_list');
    expect(ws.calls[0].body).toEqual({});
    expect(ws.items.map((i) => i.json)).toEqual(workspaces);
  });

  it('Social Account > Get Connection URLs now passes the workspace', async () => {
    const links = [{ platform_name: 'Facebook Page', connect_url: 'https://x.test/c' }];
    const { calls, items } = await run(
      { resource: 'socialAccount', operation: 'getConnectionUrls', workspaceId: 'ws-3' },
      [['/api/connect_social_account_urls', { status: 200, social_links: links }]],
    );
    expect(calls[0].body).toEqual({ workspace_id: 'ws-3' });
    expect(items.map((i) => i.json)).toEqual(links);
  });

  it('Social Account > Get History sends history_data with dates and a real boolean', async () => {
    const { calls } = await run({
      resource: 'socialAccount',
      operation: 'getHistory',
      workspaceId: 'ws-1',
      historyAccountId: 'acc-1',
      historyOptions: { startDate: '2026-10-01T00:00:00', endDate: '2026-10-31T23:59:59', isGetVideoUpdates: false },
    });
    expect(calls[0].url).toBe('https://api.test/api/history_data');
    expect(calls[0].body).toEqual({
      id: 'acc-1',
      workspace_id: 'ws-1',
      start_date: '2026-10-01 00:00:00',
      end_date: '2026-10-31 23:59:59',
      is_get_video_updates: false,
    });
  });

  it('AI > Generate Text sends chat_history as a JSON array', async () => {
    const { calls } = await run({
      resource: 'aiContent',
      operation: 'generateText',
      aiPrompt: 'Write a post',
      aiOptions: {
        aiId: 'ai-1',
        chatProgress: 'cp-1',
        chatHistory: '[{"role":"user","content":"Hi"},{"role":"system","content":"Hello"}]',
      },
    });
    expect(calls[0].url).toBe('https://api.test/api/generate_content_with_ai');
    expect(calls[0].body).toEqual({
      prompt_text: 'Write a post',
      ai_id: 'ai-1',
      chat_progress: 'cp-1',
      chat_history: [
        { role: 'user', content: 'Hi' },
        { role: 'system', content: 'Hello' },
      ],
    });
  });

  it('AI > Generate Text rejects chat history that is not JSON', async () => {
    await expect(
      run({ resource: 'aiContent', operation: 'generateText', aiPrompt: 'x', aiOptions: { chatHistory: 'nope' } }),
    ).rejects.toThrow('Chat History must be a valid JSON array');
  });

  it('AI > Generate Image sends prompt_text', async () => {
    const { calls } = await run({ resource: 'aiContent', operation: 'generateImage', imagePrompt: 'A cup' });
    expect(calls[0].body).toEqual({ prompt_text: 'A cup' });
  });

  it('Authentication > Log In uses the credential and never outputs the token', async () => {
    const { calls, items } = await run({ resource: 'auth', operation: 'userLogin' }, [
      ['/api/user_login', { status: 200, token: 'secret-token', expires_in: 3600, user_info: { id: 'u1' } }],
    ]);
    expect(calls[0].body).toEqual({ emailid: 'test@example.com', api_key: 'test-key' });
    expect(items[0].json).toEqual({ status: 200, expires_in: 3600, user_info: { id: 'u1' } });
  });
});

describe('generated operations', () => {
  it('Queue > Queue List sends workspace and additional fields with converted types', async () => {
    const answer = { status: 200, total: 0, items: [] };
    const { calls, items } = await run(
      {
        resource: 'queue',
        operation: 'queueList',
        workspaceId: 'ws-9',
        additionalFields: { account_id: ['a1', 'a2'], from: '2026-11-01T00:00:00', per_page: 50 },
      },
      [['/api/queue_list', answer]],
    );
    expect(calls[0].url).toBe('https://api.test/api/queue_list');
    expect(calls[0].body).toEqual({ workspace_id: 'ws-9', account_id: ['a1', 'a2'], from: '2026-11-01', per_page: 50 });
    // The answer is returned as one item, list answers included.
    expect(items.map((i) => i.json)).toEqual([answer]);
  });

  it('required params and JSON arrays: Schedules > Schedule Create', async () => {
    const { calls } = await run({
      resource: 'schedules',
      operation: 'scheduleCreate',
      library_id: 'lib-1',
      account_id: 'acc-1',
      slots: '[{"frequency":"weekly","day":3,"time":"09:30"}]',
    });
    expect(calls[0].body).toEqual({
      library_id: 'lib-1',
      account_id: ['acc-1'],
      slots: [{ frequency: 'weekly', day: 3, time: '09:30' }],
    });
  });

  it('destructive endpoints send confirm as set by the user', async () => {
    const { calls } = await run({
      resource: 'socialAccount',
      operation: 'socialAccountRemove',
      account_id: 'acc-1',
      confirm: true,
    });
    expect(calls[0].body).toEqual({ account_id: 'acc-1', confirm: true });
  });

  it('fails clearly for an unknown operation', async () => {
    await expect(run({ resource: 'queue', operation: 'nope' })).rejects.toThrow('Unknown operation "nope"');
  });
});

describe('errors', () => {
  it('turns an API error into a NodeApiError showing error and code', async () => {
    const respond = () => {
      throw httpError(404, { status: 404, error: 'Library not found.', code: 'not_found' });
    };
    await expect(run({ resource: 'library', operation: 'getAll' }, respond)).rejects.toMatchObject({
      message: 'Library not found. (code: not_found)',
      httpCode: '404',
    });
  });

  it('adds Retry-After on a 429', async () => {
    const respond = () => {
      throw httpError(429, { status: 429, error: 'Too many requests.', code: 'rate_limited' }, { 'retry-after': '17' });
    };
    await expect(run({ resource: 'library', operation: 'getAll' }, respond)).rejects.toMatchObject({
      message: 'Too many requests. (code: rate_limited) Retry after 17 seconds.',
      httpCode: '429',
    });
  });

  it('Continue On Fail returns the error, code and status per item and goes on', async () => {
    let count = 0;
    const respond = () => {
      count++;
      if (count === 1) {
        throw httpError(403, {
          status: 403,
          error: 'Your role does not allow this.',
          code: 'permission_denied',
          permission: 'publish',
        });
      }
      return { status: 200, message: 'Success' };
    };
    const { items } = await run({ resource: 'aiContent', operation: 'generateImage', imagePrompt: 'x' }, respond, {
      continueOnFail: true,
      items: 2,
    });
    expect(items).toEqual([
      {
        json: { error: 'Your role does not allow this.', code: 'permission_denied', status: 403, permission: 'publish' },
        pairedItem: { item: 0 },
      },
      { json: { status: 200, message: 'Success' }, pairedItem: { item: 1 } },
    ]);
  });
});

describe('loadOptions', () => {
  it('getWorkspaces prepends Default Workspace and labels shared and paused workspaces', async () => {
    const { ctx, calls } = createContext({}, [
      [
        '/api/workspace_list',
        {
          status: 200,
          workspace_list: [
            { ws_id: 'w1', ws_name: 'Mine', ownership: 'own', owner_paused: 0 },
            { ws_id: 'w2', ws_name: 'Client A', ownership: 'shared', owner_paused: 0 },
            { ws_id: 'w3', ws_name: 'Client B', ownership: 'shared', owner_paused: 1 },
          ],
        },
      ],
    ]);
    const options = await node.methods.loadOptions.getWorkspaces.call(ctx);
    expect(calls[0].headers['X-RecurPost-Client']).toBe('n8n');
    expect(options).toEqual([
      { name: 'Default Workspace', value: '' },
      { name: 'Mine', value: 'w1' },
      { name: 'Client A (Shared)', value: 'w2' },
      { name: 'Client B (Shared) (Paused by Owner)', value: 'w3' },
    ]);
  });

  it('getSocialAccounts is scoped to the selected workspace', async () => {
    const { ctx, calls } = createContext({ workspaceId: 'w2' }, [
      ['/api/social_account_list', { status: 200, social_accounts: [{ smpa_id: 'a1', smpa_name: 'FB Page' }] }],
    ]);
    const options = await node.methods.loadOptions.getSocialAccounts.call(ctx);
    expect(calls[0].body).toEqual({ workspace_id: 'w2' });
    expect(options).toEqual([{ name: 'FB Page', value: 'a1' }]);
  });

  it('getLibraries sends no workspace_id when none is selected', async () => {
    const { ctx, calls } = createContext({}, [
      ['/api/library_list', { status: 200, library_list: [{ cd_id: 'l1', cd_name: 'Tips' }] }],
    ]);
    const options = await node.methods.loadOptions.getLibraries.call(ctx);
    expect(calls[0].body).toEqual({});
    expect(options).toEqual([{ name: 'Tips', value: 'l1' }]);
  });

  it('offers a loader for every dropdown the fields use', () => {
    const methods = new Set<string>();
    const collect = (list: INodeProperties[]) => {
      for (const p of list) {
        const method = p.typeOptions?.loadOptionsMethod;
        if (typeof method === 'string') {
          methods.add(method);
        }
        if (Array.isArray(p.options)) {
          collect(p.options.filter((o) => typeof o === 'object' && 'displayName' in o) as INodeProperties[]);
        }
      }
    };
    collect(properties);
    for (const method of methods) {
      expect(node.methods.loadOptions[method], method).toBeTypeOf('function');
    }
    expect(methods.size).toBeGreaterThanOrEqual(5);
  });

  it('dropdown errors carry the API message', async () => {
    const { ctx } = createContext({}, () => {
      throw httpError(401, { status: 401, error: 'Invalid access token.', code: 'token_invalid' });
    });
    await expect(node.methods.loadOptions.getLibraries.call(ctx)).rejects.toThrow(
      'Invalid access token. (code: token_invalid)',
    );
  });
});
