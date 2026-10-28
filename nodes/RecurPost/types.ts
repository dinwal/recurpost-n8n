// Shapes shared by the generated endpoint definitions (nodes/RecurPost/generated) and the
// generic executor. Regenerate with `npm run gen` after the API docs change.

export type ParamKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'options'
  | 'multiOptions'
  | 'list'
  | 'json';

export interface ParamSpec {
  // n8n property name, camelCase
  name: string;
  // RecurPost API parameter name, snake_case
  key: string;
  kind: ParamKind;
  // Shown at the top level; everything else lives in the Additional Fields collection
  required: boolean;
}

export interface OperationSpec {
  resource: string;
  operation: string;
  endpoint: string;
  // Sent as the `action` parameter on endpoints that bundle several actions
  action?: string;
  // Sent as confirm=true: the user chose the operation, that is the confirmation
  confirm?: boolean;
  // Response key whose array becomes the output items
  unwrap?: string;
  // Attach the shared post composer fields (media, per-platform messages and options)
  composer?: boolean;
  // Endpoint accepts workspace_id
  workspace: boolean;
  params: ParamSpec[];
}
