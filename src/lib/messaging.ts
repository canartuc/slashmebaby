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

// ─── Union Type ───────────────────────────────────────────────────────────────

export type Message =
  | SearchRequest
  | SmartSuggestionsRequest
  | ExecuteActionRequest
  | GetSettingsRequest
  | ToggleOverlayCommand;

// ─── Type Guards ──────────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && value !== undefined && typeof value === 'object';
}

export function isSearchRequest(value: unknown): value is SearchRequest {
  return isObject(value) && value['type'] === 'SEARCH';
}

export function isExecuteActionRequest(
  value: unknown
): value is ExecuteActionRequest {
  return isObject(value) && value['type'] === 'EXECUTE_ACTION';
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
