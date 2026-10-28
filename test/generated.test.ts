/* eslint-disable @n8n/community-nodes/no-restricted-imports -- vitest is a devDependency; tests are excluded from the published package */
import { describe, it, expect } from 'vitest';
import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { RecurPost } from '../nodes/RecurPost/RecurPost.node';
import { CUSTOMIZATION_SHOW } from '../nodes/RecurPost/composer';
import { findOperation } from '../nodes/RecurPost/execute';
import { generatedOperations, generatedProperties, generatedResources } from '../nodes/RecurPost/generated';
import { createContext, run } from './helpers';

const node = new RecurPost();
const properties = node.description.properties;
const resourceProp = properties.find((p) => p.name === 'resource') as INodeProperties;
const resourceValues = (resourceProp.options as INodePropertyOptions[]).map((o) => String(o.value));
const operationProps = properties.filter((p) => p.name === 'operation');

function operationsOf(resource: string): INodePropertyOptions[] {
  const prop = operationProps.find((p) => p.displayOptions?.show?.resource?.includes(resource));
  return (prop?.options ?? []) as INodePropertyOptions[];
}

const LEGACY_PAIRS = new Set([
  'aiContent/generateImage', 'aiContent/generateText',
  'library/addContent', 'library/getAll',
  'post/schedule',
  'socialAccount/getAll', 'socialAccount/getConnectionUrls', 'socialAccount/getHistory',
  'workspace/getAll',
]);
const knownPairs = new Set([...LEGACY_PAIRS, ...generatedOperations.map((op) => `${op.resource}/${op.operation}`)]);

describe('generated endpoint definitions', () => {
  it('covers every documented resource in the Resource dropdown, sorted by name', () => {
    for (const resource of generatedResources) {
      expect(resourceValues).toContain(resource.value);
    }
    const names = (resourceProp.options as INodePropertyOptions[]).map((o) => o.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
  });

  it('lists every generated operation under its resource, sorted by name, with unique values', () => {
    for (const resource of generatedResources) {
      const options = operationsOf(resource.value);
      const values = options.map((o) => String(o.value));
      expect(new Set(values).size).toBe(values.length);
      const names = options.map((o) => o.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
      for (const op of generatedOperations.filter((o) => o.resource === resource.value)) {
        expect(values, `${resource.value}.${op.operation}`).toContain(op.operation);
      }
      for (const option of options) {
        expect(option.action, `${resource.value}.${option.value} action`).toBeTruthy();
        expect(option.description, `${resource.value}.${option.value} description`).toBeTruthy();
      }
    }
  });

  it('keeps the original five resources and their operation values', () => {
    for (const pair of LEGACY_PAIRS) {
      const [resource, operation] = pair.split('/');
      expect(operationsOf(resource).map((o) => o.value)).toContain(operation);
      expect(findOperation(resource, operation)).toBeUndefined();
    }
  });

  it('only shows generated fields on operations that exist', () => {
    for (const prop of generatedProperties) {
      const show = prop.displayOptions?.show ?? {};
      for (const resource of (show.resource ?? []) as string[]) {
        for (const operation of (show.operation ?? []) as string[]) {
          expect(knownPairs.has(`${resource}/${operation}`), `${prop.name} on ${resource}/${operation}`).toBe(true);
        }
      }
    }
  });

  it('shows the post composer only on operations that take post content', () => {
    for (const resource of CUSTOMIZATION_SHOW.resource) {
      for (const operation of CUSTOMIZATION_SHOW.operation) {
        const pair = `${resource}/${operation}`;
        if (!knownPairs.has(pair)) {
          continue;
        }
        const spec = findOperation(resource, operation);
        const isComposer = spec?.composer === true || pair === 'post/schedule' || pair === 'library/addContent';
        expect(isComposer, pair).toBe(true);
      }
    }
    expect(CUSTOMIZATION_SHOW.resource).toEqual(expect.arrayContaining(['draft', 'queue', 'approval', 'post', 'library']));
  });

  it('never exposes action or confirm as fields and never sends credentials', () => {
    const names = new Set<string>();
    for (const prop of generatedProperties) {
      names.add(prop.name);
      for (const option of (prop.options ?? []) as INodeProperties[]) {
        names.add(option.name);
      }
    }
    expect(names.has('action')).toBe(false);
    expect(names.has('confirm')).toBe(false);
    expect(names.has('emailid')).toBe(false);
    expect(names.has('passKey')).toBe(false);
  });

  it('splits multi-action endpoints into one operation per action with the right required fields', () => {
    const invite = findOperation('workspace', 'invite');
    const resend = findOperation('workspace', 'resendInvite');
    expect(invite?.action).toBe('invite');
    expect(resend?.action).toBe('resend');
    expect(invite?.params.find((p) => p.key === 'email')?.required).toBe(true);
    expect(resend?.params.find((p) => p.key === 'user_id')?.required).toBe(true);
  });

  it('confirms destructive operations on the user’s behalf and nothing else', () => {
    expect(findOperation('library', 'delete')?.confirm).toBe(true);
    expect(findOperation('account', 'customFieldDelete')?.confirm).toBe(true);
    expect(findOperation('account', 'customFieldList')?.confirm).toBeUndefined();
    expect(findOperation('library', 'create')?.confirm).toBeUndefined();
  });
});

describe('generated operations at run time', () => {
  it('sends the action, the id and the workspace for Library > Pause', async () => {
    const { calls } = await run({ resource: 'library', operation: 'pause', workspaceId: 'enc-2', id: 'lib-1' });
    expect(calls[0].url).toBe('https://api.test/api/library_pause');
    expect(calls[0].body).toEqual({ action: 'pause', id: 'lib-1', workspace_id: 'enc-2' });
  });

  it('sends confirm for Library > Delete without asking', async () => {
    const { calls } = await run({ resource: 'library', operation: 'delete', workspaceId: '', id: 'lib-1' });
    expect(calls[0].url).toBe('https://api.test/api/library_delete');
    expect(calls[0].body).toEqual({ confirm: '1', id: 'lib-1' });
  });

  it('turns a comma-separated id list into PHP array keys', async () => {
    const { calls } = await run({ resource: 'queue', operation: 'deleteItems', workspaceId: '', id: '48213, 48214' });
    expect(calls[0].body).toEqual({ 'id[0]': '48213', 'id[1]': '48214' });
  });

  it('adds Additional Fields to the body and leaves the rest out', async () => {
    const { calls } = await run({
      resource: 'accountGroup',
      operation: 'create',
      workspaceId: '',
      name: 'Clients',
      additionalFields: { color: '#ff0000' },
    });
    expect(calls[0].url).toBe('https://api.test/api/account_group_create');
    expect(calls[0].body).toEqual({ name: 'Clients', color: '#ff0000' });
  });

  it('formats date fields as Y-m-d and parses JSON fields', async () => {
    const { calls } = await run({
      resource: 'workflow',
      operation: 'cardSave',
      workspaceId: '',
      title: 'Idea',
      additionalFields: { targetDate: '2026-09-01T09:05:00', media: '["https://img.test/a.jpg"]' },
    });
    expect(calls[0].body).toMatchObject({
      title: 'Idea',
      target_date: '2026-09-01 09:05:00',
      'media[0]': 'https://img.test/a.jpg',
    });
  });

  it('rejects a JSON field that does not parse', async () => {
    await expect(
      run({ resource: 'workflow', operation: 'cardSave', workspaceId: '', title: 'Idea', additionalFields: { media: 'nope' } }),
    ).rejects.toThrow('must be valid JSON');
  });

  it('attaches the shared post composer to Draft > Save', async () => {
    const { calls } = await run({
      resource: 'draft',
      operation: 'save',
      workspaceId: '',
      id: ['101'],
      message: 'Draft text',
      imageUrls: ['https://img.test/a.jpg'],
      platformMessages: { fbMessage: 'FB version' },
    });
    expect(calls[0].url).toBe('https://api.test/api/draft_save');
    expect(calls[0].body).toMatchObject({
      'id[0]': '101',
      message: 'Draft text',
      'image_url[0]': 'https://img.test/a.jpg',
      fb_message: 'FB version',
    });
  });

  it('unwraps list responses into one item per row', async () => {
    const groups = [{ id: 1, name: 'Clients' }, { id: 2, name: 'Internal' }];
    const { items } = await run(
      { resource: 'accountGroup', operation: 'list', workspaceId: '' },
      [['/api/account_group_list', { status: 200, groups }]],
    );
    expect(items.map((i) => i.json)).toEqual(groups);
  });
});

describe('generated dropdown loaders', () => {
  it('getLabels reads label_list scoped to the workspace', async () => {
    const { ctx, calls } = createContext({ workspaceId: 'enc-2' }, [
      ['/api/label_list', { status: 200, labels: [{ id: 7, name: 'Promo' }] }],
    ]);
    const options = await node.methods.loadOptions.getLabels.call(ctx);
    expect(calls[0].body).toEqual({ workspace_id: 'enc-2' });
    expect(options).toEqual([{ name: 'Promo', value: 7 }]);
  });

  it('getFeeds labels a feed by its title and falls back to the URL', async () => {
    const { ctx } = createContext({}, [
      ['/api/feed_list', { status: 200, feeds: [{ id: 3, title: 'Blog', url: 'https://b.test/rss' }, { id: 4, title: '', url: 'https://c.test/rss' }] }],
    ]);
    const options = await node.methods.loadOptions.getFeeds.call(ctx);
    expect(options).toEqual([{ name: 'Blog', value: 3 }, { name: 'https://c.test/rss', value: 4 }]);
  });
});
