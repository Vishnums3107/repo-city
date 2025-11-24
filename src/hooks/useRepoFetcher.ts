import { useState, useCallback } from 'react';
import { get, set } from 'idb-keyval';
import { type FileNode } from '../utils/layoutEngine';

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

interface FetcherState {
  loading: boolean;
  error: string | null;
  data: FileNode | null;
}

export const useRepoFetcher = () => {
  const [state, setState] = useState<FetcherState>({
    loading: false,
    error: null,
    data: null,
  });

  const fetchRepo = useCallback(async (repoUrl: string, token?: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // 1. Parse Repo URL (e.g., "facebook/react" or full URL)
      const cleanUrl = repoUrl.replace('https://github.com/', '').replace(/\/$/, '');
      const parts = cleanUrl.split('/');
      // Handle cases like "owner/repo" or "owner/repo/tree/branch"
      const owner = parts[0];
      const repo = parts[1];
      
      if (!owner || !repo) {
        throw new Error('Invalid Repository URL. Format: owner/repo');
      }

      const cacheKey = `repo-city-v1-${owner}-${repo}`;

      // 2. Check Cache
      const cachedData = await get<FileNode>(cacheKey);
      if (cachedData) {
        console.log('Loaded from cache');
        setState({ loading: false, error: null, data: cachedData });
        return;
      }

      // 3. Fetch Default Branch (to get the tree SHA or just use HEAD)
      const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json',
      };
      if (token) {
        headers['Authorization'] = `token ${token}`;
      }

      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (!repoRes.ok) {
          if (repoRes.status === 403 || repoRes.status === 429) {
              throw new Error("API Rate Limit Exceeded. Please provide a Token.");
          }
          throw new Error(`Failed to fetch repo info: ${repoRes.statusText}`);
      }
      const repoInfo = await repoRes.json();
      const defaultBranch = repoInfo.default_branch;

      // 4. Fetch Recursive Tree
      const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, { headers });
      if (!treeRes.ok) {
         if (treeRes.status === 403 || treeRes.status === 429) {
              throw new Error("API Rate Limit Exceeded. Please provide a Token.");
          }
          throw new Error(`Failed to fetch file tree: ${treeRes.statusText}`);
      }
      
      const treeData = await treeRes.json();
      
      if (treeData.truncated) {
          console.warn("Tree is truncated! Repo is too large.");
      }

      // 5. Transform Data
      const root: FileNode = {
          name: repo,
          type: 'folder',
          children: []
      };

      // Helper to find or create a folder node
      const findOrCreateFolder = (parent: FileNode, name: string): FileNode => {
          if (!parent.children) parent.children = [];
          let folder = parent.children.find(c => c.name === name && c.type === 'folder');
          if (!folder) {
              folder = { name, type: 'folder', children: [] };
              parent.children.push(folder);
          }
          return folder;
      };

      (treeData.tree as GitHubTreeItem[]).forEach(item => {
          const parts = item.path.split('/');
          const fileName = parts.pop()!;
          
          let currentDir = root;
          
          // Traverse/Create directories
          parts.forEach(part => {
              currentDir = findOrCreateFolder(currentDir, part);
          });

          // Add the item
          if (item.type === 'blob') {
              if (!currentDir.children) currentDir.children = [];
              currentDir.children.push({
                  name: fileName,
                  type: 'file',
                  loc: item.size ? Math.ceil(item.size / 30) : 0,
                  url: item.url
              });
          } else if (item.type === 'tree') {
              // Ensure the folder exists (it might have been created by a file path already)
              findOrCreateFolder(currentDir, fileName);
          }
      });

      // 6. Cache and Set State
      await set(cacheKey, root);
      setState({ loading: false, error: null, data: root });

    } catch (err: any) {
      setState({ loading: false, error: err.message, data: null });
    }
  }, []);

  return { ...state, fetchRepo };
};
