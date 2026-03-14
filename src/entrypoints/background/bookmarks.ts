import type { SearchableItem } from '../../lib/search';

function flattenBookmarkTree(
  nodes: chrome.bookmarks.BookmarkTreeNode[]
): chrome.bookmarks.BookmarkTreeNode[] {
  const result: chrome.bookmarks.BookmarkTreeNode[] = [];
  for (const node of nodes) {
    if (node.url) {
      result.push(node);
    }
    if (node.children && node.children.length > 0) {
      result.push(...flattenBookmarkTree(node.children));
    }
  }
  return result;
}

export class BookmarkCache {
  private items: SearchableItem[] = [];

  async refresh(): Promise<void> {
    return new Promise((resolve) => {
      chrome.bookmarks.getTree((tree) => {
        const flat = flattenBookmarkTree(tree);
        this.items = flat.map((node): SearchableItem => ({
          id: `bookmark-${node.id}`,
          title: node.title,
          url: node.url,
          category: 'bookmarks',
          timestamp: node.dateAdded,
        }));
        resolve();
      });
    });
  }

  getItems(): SearchableItem[] {
    return this.items;
  }

  setupListeners(onUpdate: () => void): void {
    const handler = () => {
      this.refresh().then(onUpdate);
    };

    chrome.bookmarks.onCreated.addListener(handler);
    chrome.bookmarks.onRemoved.addListener(handler);
    chrome.bookmarks.onChanged.addListener(handler);
  }
}
