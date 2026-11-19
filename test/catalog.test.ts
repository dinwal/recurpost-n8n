/* eslint-disable @n8n/community-nodes/no-restricted-imports -- vitest is a devDependency; tests are excluded from the published package */
import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain ES module script without type declarations
import { buildCatalog, toPlainText } from '../scripts/sync-catalog.mjs';
import { catalog } from '../nodes/RecurPost/catalog';

const fixture = [
  {
    module: 'zeta_tools',
    title: 'Zeta Tools',
    description: '<p>Tools for <code>zeta</code>. Second sentence.</p>',
    endpoints: [
      {
        id: 'zeta_list',
        title: 'Zeta List',
        summary: 'List the zetas &amp; more \u2014 fast.',
        description: '<p>Long text that is not kept.</p>',
        auth: 'required',
        legacy: false,
        params: [
          {
            name: 'library_id',
            type: 'string',
            required: true,
            description: 'Encrypted library id from <code>/api/library_list</code>.',
            example: 'lB7xK2mP9q==',
          },
          {
            name: 'account_ids',
            type: 'array',
            required: false,
            description: '<ul><li>Ids from /api/social_account_list</li></ul>',
            example: ['a==', 'b=='],
          },
          {
            name: 'slots',
            type: 'array',
            required: false,
            description: 'Slots.',
            example: [{ day: 1, time: '09:00' }],
          },
          {
            name: 'mode',
            type: 'string',
            required: false,
            description: 'Mode &lt;x&gt;.',
            example: 'fast',
            values: ['fast', 'slow'],
            default: 'fast',
          },
          {
            name: 'customize',
            type: 'object',
            required: false,
            description: 'Options.',
            example: { prefix: 'x' },
          },
          {
            name: 'customize.prefix',
            type: 'string',
            required: false,
            description: 'Prefix.',
            example: 'x',
          },
          {
            name: 'notes',
            type: 'string',
            required: false,
            description: 'Notes.',
            example: 'x'.repeat(400),
          },
        ],
        response: [],
        example_response: {},
        errors: [],
      },
    ],
  },
  {
    module: 'alpha',
    title: 'Alpha',
    description: 'Alpha module',
    endpoints: [],
  },
];

describe('toPlainText', () => {
  it('strips tags, decodes entities, turns list items into hyphens and dashes into hyphens', () => {
    expect(toPlainText('<p>Use <code>id</code> &amp; <strong>name</strong>.</p><p>Next</p>')).toBe(
      'Use id & name. Next',
    );
    expect(toPlainText('<ul><li>One</li><li>Two</li></ul>')).toBe('- One - Two');
    expect(toPlainText('a \u2014 b \u2013 c')).toBe('a - b - c');
    expect(toPlainText('&lt;token&gt; &#39;x&#39; &quot;y&quot;')).toBe('<token> \'x\' "y"');
    expect(toPlainText(undefined)).toBe('');
  });
});

describe('buildCatalog', () => {
  const built = buildCatalog(fixture);

  it('sorts modules and keeps only the compact endpoint fields', () => {
    expect(built.version).toBe(1);
    expect(built.modules.map((m: { module: string }) => m.module)).toEqual(['alpha', 'zeta_tools']);
    const mod = built.modules[1];
    expect(mod.title).toBe('Zeta Tools');
    expect(mod.description).toBe('Tools for zeta.');
    const endpoint = mod.endpoints[0];
    expect(Object.keys(endpoint).sort()).toEqual(['auth', 'id', 'legacy', 'module', 'params', 'summary', 'title']);
    expect(endpoint.summary).toBe('List the zetas & more - fast.');
  });

  it('builds params with plain text, required, enum, default, items and the referenced list', () => {
    const params = built.modules[1].endpoints[0].params;
    const byName = Object.fromEntries(params.map((p: { name: string }) => [p.name, p]));
    expect(byName.library_id).toEqual({
      name: 'library_id',
      type: 'string',
      required: true,
      description: 'Encrypted library id from /api/library_list.',
      example: 'lB7xK2mP9q==',
      ref: 'library_list',
    });
    expect(byName.account_ids.required).toBeUndefined();
    expect(byName.account_ids.ref).toBe('social_account_list');
    expect(byName.account_ids.items).toBeUndefined();
    expect(byName.slots.items).toBe('object');
    expect(byName.mode).toMatchObject({ enum: ['fast', 'slow'], default: 'fast', description: 'Mode <x>.' });
    expect(byName.notes.example).toBeUndefined();
  });

  it('folds nested params into the parent description instead of making fields of them', () => {
    const params = built.modules[1].endpoints[0].params;
    expect(params.map((p: { name: string }) => p.name)).not.toContain('customize.prefix');
    const customize = params.find((p: { name: string }) => p.name === 'customize');
    expect(customize.description).toBe('Options. Keys: prefix.');
  });
});

describe('checked-in catalog.json', () => {
  it('covers every module and endpoint of API v2', () => {
    expect(catalog.modules).toHaveLength(27);
    const endpoints = catalog.modules.flatMap((m) => m.endpoints);
    expect(endpoints).toHaveLength(301);
    expect(new Set(endpoints.map((e) => e.id)).size).toBe(301);
    for (const id of ['user_login', 'post_content', 'workspace_list', 'social_account_list', 'library_list', 'queue_list']) {
      expect(endpoints.some((e) => e.id === id)).toBe(true);
    }
  });

  it('has plain text without HTML or em / en dashes', () => {
    const text = JSON.stringify(catalog);
    expect(text).not.toMatch(/[\u2013\u2014]/);
    expect(text).not.toMatch(/<\/?(p|code|strong|ul|li)>/);
  });

  it('uses only param types the node knows', () => {
    const known = new Set(['string', 'array', 'url', 'integer', 'boolean', 'date', 'datetime', 'email', 'object']);
    for (const mod of catalog.modules) {
      for (const endpoint of mod.endpoints) {
        for (const param of endpoint.params) {
          expect(known.has(param.type)).toBe(true);
          expect(param.name).toMatch(/^[a-z0-9_]+$/i);
        }
      }
    }
  });
});
