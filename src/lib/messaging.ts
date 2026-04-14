// ─── Source & Result Types ───────────────────────────────────────────────────

export type Source = 'tabs' | 'bookmarks' | 'history' | 'actions';

export interface SearchResultItem {
  id: string;
  title: string;
  url?: string;
  icon?: string;
  score: number;
}

export interface ResultGroup {
  category: Source;
  items: SearchResultItem[];
}

// ─── Content → Background Messages ───────────────────────────────────────────

export interface SearchRequest {
  type: 'SEARCH';
  payload: { query: string; sources: Source[] };
}

export interface SearchResponse {
  groups: ResultGroup[];
}

export interface SmartSuggestionsRequest {
  type: 'SMART_SUGGESTIONS';
}

export interface ExecuteActionRequest {
  type: 'EXECUTE_ACTION';
  payload: { actionId: string; targetTabId?: number };
}

export interface ExecuteActionResponse {
  success: boolean;
  error?: string;
}

export interface GetSettingsRequest {
  type: 'GET_SETTINGS';
}

export interface GetSettingsResponse {
  settings: UserSettings;
}

export interface SwitchTabRequest {
  type: 'SWITCH_TAB';
  payload: { tabId: number };
}

export interface OpenNewTabRequest {
  type: 'OPEN_NEW_TAB';
  payload: { url: string };
}

export interface NavigateRequest {
  type: 'NAVIGATE';
  payload: { url: string };
}

// ─── Background → Content Messages ───────────────────────────────────────────

export interface ToggleOverlayCommand {
  type: 'TOGGLE_OVERLAY';
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface UserSettings {
  shortcut: string;
  position: 'center' | 'top' | 'bottom';
  theme: 'system' | 'light' | 'dark';
  maxResultsPerGroup: number;
  showFavicons: boolean;
  searchSources: { tabs: boolean; bookmarks: boolean; history: boolean };
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

export const DEFAULT_SETTINGS: UserSettings = {
  shortcut: isMac ? 'Command+Shift+Space' : 'Ctrl+Shift+Space',
  position: 'center',
  theme: 'system',
  maxResultsPerGroup: 5,
  showFavicons: true,
  searchSources: { tabs: true, bookmarks: true, history: true },
};

// ─── Tree View Messages ─────────────────────────────────────────────────────

export interface GetAllTabsRequest { type: 'GET_ALL_TABS'; }

export interface TabWithGroup {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  windowId: number;
  groupId?: number;
  pinned: boolean;
  audible: boolean;
  muted: boolean;
  lastAccessed?: number;
}

export interface TabGroupInfo {
  label: string;
  type: 'window' | 'tabGroup';
  tabs: TabWithGroup[];
}

export interface GetAllTabsResponse { groups: TabGroupInfo[]; }

export interface GetBookmarkTreeRequest { type: 'GET_BOOKMARK_TREE'; }

export interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  children?: BookmarkNode[];
  dateAdded?: number;
}

export interface GetBookmarkTreeResponse { tree: BookmarkNode[]; }

// ─── Union Type ───────────────────────────────────────────────────────────────

export type Message =
  | SearchRequest
  | SmartSuggestionsRequest
  | ExecuteActionRequest
  | GetSettingsRequest
  | SwitchTabRequest
  | OpenNewTabRequest
  | NavigateRequest
  | ToggleOverlayCommand
  | GetAllTabsRequest
  | GetBookmarkTreeRequest;

// ─── Type Guards ──────────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && value !== undefined && typeof value === 'object';
}

const VALID_SOURCES: ReadonlySet<Source> = new Set(['tabs', 'bookmarks', 'history', 'actions']);

export function isSearchRequest(value: unknown): value is SearchRequest {
  if (!isObject(value) || value['type'] !== 'SEARCH') return false;
  const payload = value['payload'];
  if (!isObject(payload)) return false;
  if (typeof payload['query'] !== 'string') return false;
  if (payload['query'].length > 2048) return false;
  const sources = payload['sources'];
  if (!Array.isArray(sources)) return false;
  if (sources.length > 16) return false;
  for (const s of sources) {
    if (typeof s !== 'string' || !VALID_SOURCES.has(s as Source)) return false;
  }
  return true;
}

export function isExecuteActionRequest(
  value: unknown
): value is ExecuteActionRequest {
  if (!isObject(value) || value['type'] !== 'EXECUTE_ACTION') return false;
  const payload = value['payload'];
  if (!isObject(payload)) return false;
  if (typeof payload['actionId'] !== 'string' || payload['actionId'].length === 0) return false;
  if (payload['actionId'].length > 128) return false;
  const t = payload['targetTabId'];
  if (t !== undefined && (typeof t !== 'number' || !Number.isInteger(t) || t < 0)) return false;
  return true;
}

export function isToggleOverlayCommand(
  value: unknown
): value is ToggleOverlayCommand {
  return isObject(value) && value['type'] === 'TOGGLE_OVERLAY';
}

export function isSmartSuggestionsRequest(
  value: unknown
): value is SmartSuggestionsRequest {
  return isObject(value) && value['type'] === 'SMART_SUGGESTIONS';
}

export function isGetSettingsRequest(
  value: unknown
): value is GetSettingsRequest {
  return isObject(value) && value['type'] === 'GET_SETTINGS';
}

export function isSwitchTabRequest(value: unknown): value is SwitchTabRequest {
  if (!isObject(value) || value['type'] !== 'SWITCH_TAB') return false;
  const payload = value['payload'];
  if (!isObject(payload)) return false;
  const tabId = payload['tabId'];
  if (typeof tabId !== 'number' || !Number.isInteger(tabId) || tabId < 0) return false;
  return true;
}

function isUrlPayload(value: unknown): value is { url: string } {
  if (!isObject(value)) return false;
  const url = value['url'];
  // Scheme safety is enforced at the call site by validateNavigationUrl.
  // The guard only checks shape and an upper length bound.
  return typeof url === 'string' && url.length > 0 && url.length <= 4096;
}

export function isOpenNewTabRequest(value: unknown): value is OpenNewTabRequest {
  return isObject(value) && value['type'] === 'OPEN_NEW_TAB' && isUrlPayload(value['payload']);
}

export function isNavigateRequest(value: unknown): value is NavigateRequest {
  return isObject(value) && value['type'] === 'NAVIGATE' && isUrlPayload(value['payload']);
}

export function isGetAllTabsRequest(v: unknown): v is GetAllTabsRequest {
  return isObject(v) && v['type'] === 'GET_ALL_TABS';
}

export function isGetBookmarkTreeRequest(v: unknown): v is GetBookmarkTreeRequest {
  return isObject(v) && v['type'] === 'GET_BOOKMARK_TREE';
}
