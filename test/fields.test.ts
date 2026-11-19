/* eslint-disable @n8n/community-nodes/no-restricted-imports -- vitest is a devDependency; tests are excluded from the published package */
import { describe, it, expect } from 'vitest';
import type { CatalogParam } from '../nodes/RecurPost/catalog';
import { convertParamValue, humanize, listOptions, LIST_SOURCES, paramToProperty } from '../nodes/RecurPost/Fields';
import { formatDateTime, toList } from '../nodes/RecurPost/GenericFunctions';

const node = { id: 'n1', name: 'RecurPost', type: 'recurPost', typeVersion: 1, position: [0, 0] as [number, number], parameters: {} };
const show = { resource: ['queue'], operation: ['queueList'] };

function param(overrides: Partial<CatalogParam>): CatalogParam {
  return { name: 'field', type: 'string', description: 'A field.', ...overrides };
}

describe('paramToProperty: one n8n field per param type', () => {
  it('string: a string field with the docs description and example placeholder', () => {
    const p = paramToProperty(param({ name: 'search_text', required: true, example: 'Pune' }), show);
    expect(p).toMatchObject({
      displayName: 'Search Text',
      name: 'search_text',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'Pune',
      description: 'A field.',
      displayOptions: { show },
    });
  });

  it('long text params get a multi-line editor and email gets an email placeholder', () => {
    expect(paramToProperty(param({ name: 'message' })).typeOptions).toEqual({ rows: 4 });
    expect(paramToProperty(param({ name: 'email', type: 'email' })).placeholder).toBe('name@email.com');
  });

  it('integer: number with the docs default', () => {
    expect(paramToProperty(param({ name: 'per_page', type: 'integer', default: '20' }))).toMatchObject({
      type: 'number',
      default: 20,
    });
  });

  it('boolean: boolean with the docs default', () => {
    expect(paramToProperty(param({ name: 'host_images', type: 'boolean', default: 'true' }))).toMatchObject({
      type: 'boolean',
      default: true,
    });
    expect(paramToProperty(param({ name: 'confirm', type: 'boolean', required: true }), show)).toMatchObject({
      type: 'boolean',
      default: false,
      required: true,
    });
  });

  it('string enum: options sorted by name with the docs default', () => {
    const p = paramToProperty(param({ name: 'fb_post_type', enum: ['feed', 'reel', 'story'], default: 'feed' }));
    expect(p.displayName).toBe('Facebook Post Type');
    expect(p.type).toBe('options');
    expect(p.options).toEqual([
      { name: 'Feed', value: 'feed' },
      { name: 'Reel', value: 'reel' },
      { name: 'Story', value: 'story' },
    ]);
    expect(p.default).toBe('feed');
  });

  it('0 / 1 enum: Yes / No options with numeric values', () => {
    const p = paramToProperty(param({ name: 'tk_is_aigc', type: 'integer', enum: [0, 1], default: '0' }));
    expect(p.options).toEqual([
      { name: 'No', value: 0 },
      { name: 'Yes', value: 1 },
    ]);
    expect(p.default).toBe(0);
  });

  it('date and datetime: dateTime fields', () => {
    expect(paramToProperty(param({ name: 'from', type: 'date' })).type).toBe('dateTime');
    expect(paramToProperty(param({ name: 'schedule_date_time', type: 'datetime' })).type).toBe('dateTime');
  });

  it('array of strings: comma-separated or JSON string; array of objects and object: JSON', () => {
    const list = paramToProperty(param({ name: 'emails', type: 'array' }));
    expect(list.type).toBe('string');
    expect(list.description).toContain('comma-separated list or a JSON array');
    expect(paramToProperty(param({ name: 'slots', type: 'array', items: 'object' }))).toMatchObject({
      type: 'json',
      default: '[]',
    });
    expect(paramToProperty(param({ name: 'answers', type: 'object' }))).toMatchObject({ type: 'json', default: '{}' });
  });

  it('ids from a supported list endpoint become dropdowns', () => {
    const single = paramToProperty(param({ name: 'id', ref: 'library_list', required: true }), show);
    expect(single).toMatchObject({
      displayName: 'Library Name or ID',
      type: 'options',
      default: '',
      typeOptions: { loadOptionsMethod: 'getLibraries' },
    });
    expect(single.description).toContain('expression');
    const multi = paramToProperty(param({ name: 'account_ids', type: 'array', ref: 'social_account_list' }));
    expect(multi).toMatchObject({
      displayName: 'Account Names or IDs',
      type: 'multiOptions',
      default: [],
      typeOptions: { loadOptionsMethod: 'getSocialAccounts' },
    });
    // A list endpoint without a dropdown stays a plain field.
    expect(paramToProperty(param({ name: 'post_id', ref: 'history_list' })).type).toBe('string');
  });

  it('workspace_id is the shared workspaceId selector name', () => {
    expect(paramToProperty(param({ name: 'workspace_id' })).name).toBe('workspaceId');
  });

  it('humanize expands network prefixes and acronyms', () => {
    expect(humanize('gbp_cta_url')).toBe('Google Business CTA URL');
    expect(humanize('in_reel_share_in_feed')).toBe('Instagram Reel Share In Feed');
    expect(humanize('ai_id')).toBe('AI ID');
    expect(humanize('in')).toBe('In');
  });
});

describe('convertParamValue: field values to API values', () => {
  it('converts each type', () => {
    expect(convertParamValue(param({ type: 'integer' }), 5, node, 0)).toBe(5);
    expect(convertParamValue(param({ type: 'integer' }), '7', node, 0)).toBe(7);
    expect(convertParamValue(param({ type: 'integer' }), '', node, 0)).toBeUndefined();
    expect(convertParamValue(param({ type: 'boolean' }), true, node, 0)).toBe(true);
    expect(convertParamValue(param({ type: 'boolean' }), 'false', node, 0)).toBe(false);
    expect(convertParamValue(param({ type: 'date' }), '2026-12-25T10:30:00', node, 0)).toBe('2026-12-25');
    expect(convertParamValue(param({ type: 'datetime' }), '2026-12-25T10:30:00.000+05:30', node, 0)).toBe(
      '2026-12-25 10:30:00',
    );
    expect(convertParamValue(param({ type: 'datetime' }), '', node, 0)).toBeUndefined();
    expect(convertParamValue(param({ type: 'array' }), 'a, b ,,c', node, 0)).toEqual(['a', 'b', 'c']);
    expect(convertParamValue(param({ type: 'array' }), '["x,1","y"]', node, 0)).toEqual(['x,1', 'y']);
    expect(convertParamValue(param({ type: 'array' }), ['p', 'q'], node, 0)).toEqual(['p', 'q']);
    expect(convertParamValue(param({ type: 'array', items: 'number' }), '1, 3', node, 0)).toEqual([1, 3]);
    expect(convertParamValue(param({ type: 'array', items: 'object' }), '[{"day":1}]', node, 0)).toEqual([{ day: 1 }]);
    expect(convertParamValue(param({ type: 'array', items: 'object' }), '{"day":1}', node, 0)).toEqual([{ day: 1 }]);
    expect(convertParamValue(param({ type: 'object' }), '{"a":1}', node, 0)).toEqual({ a: 1 });
    expect(convertParamValue(param({ type: 'object' }), { a: 2 }, node, 0)).toEqual({ a: 2 });
    expect(convertParamValue(param({ type: 'integer', enum: [0, 1] }), 1, node, 0)).toBe(1);
    expect(convertParamValue(param({ type: 'string' }), 'text', node, 0)).toBe('text');
    expect(convertParamValue(param({ type: 'string', ref: 'library_list' }), '', node, 0)).toBeUndefined();
    expect(convertParamValue(param({ type: 'array', ref: 'social_account_list' }), ['a', 'b'], node, 0)).toEqual([
      'a',
      'b',
    ]);
  });

  it('rejects invalid JSON with a clear message', () => {
    expect(() => convertParamValue(param({ name: 'answers', type: 'object' }), '{oops', node, 0)).toThrow(
      '"Answers" must be valid JSON',
    );
  });
});

describe('helpers', () => {
  it('formatDateTime keeps the wall-clock digits and pads missing seconds', () => {
    expect(formatDateTime('2026-09-01T09:05', true)).toBe('2026-09-01 09:05:00');
    expect(formatDateTime('2026-09-01 09:05:07', true)).toBe('2026-09-01 09:05:07');
    expect(formatDateTime('2026-09-01', true)).toBe('2026-09-01 00:00:00');
    expect(formatDateTime('2026-09-01T23:59:00Z', false)).toBe('2026-09-01');
    expect(formatDateTime('', true)).toBe('');
  });

  it('toList accepts arrays, JSON arrays and comma-separated text', () => {
    expect(toList(['a'])).toEqual(['a']);
    expect(toList('["a","b"]')).toEqual(['a', 'b']);
    expect(toList('a,b')).toEqual(['a', 'b']);
    expect(toList('')).toEqual([]);
    expect(toList(undefined)).toEqual([]);
  });

  it('listOptions maps list answers to dropdown options', () => {
    const feeds = LIST_SOURCES.find((s) => s.endpoint === 'feed_list')!;
    expect(
      listOptions(feeds, {
        feeds: [
          { id: 'f1', title: 'Blog', url: 'https://b.test/feed' },
          { id: 'f2', title: '', url: 'https://c.test/feed' },
          { title: 'no id' },
        ],
      }),
    ).toEqual([
      { name: 'Blog', value: 'f1' },
      { name: 'https://c.test/feed', value: 'f2' },
    ]);
    expect(listOptions(feeds, {})).toEqual([]);
  });
});
