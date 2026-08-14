'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type { FileContent, TreeNode } from '@/lib/types';
import { FolderIcon } from './icons/FolderIcon';
import { FileIcon } from './icons/FileIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { EmptyState, ErrorPanel } from './ui/Panel';

function TreeItem({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(depth === 0);
  const isFolder = node.type === 'folder';
  const isSelected = selected === node.path;

  return (
    <li>
      <button
        type="button"
        onClick={() => (isFolder ? setIsOpen((v) => !v) : onSelect(node.path))}
        aria-expanded={isFolder ? isOpen : undefined}
        aria-current={isSelected ? 'true' : undefined}
        title={node.path}
        style={{ paddingLeft: `${depth * 0.875 + 0.5}rem` }}
        className={`flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm transition-colors ${
          isSelected
            ? 'bg-neon-violet/15 text-neon-violet'
            : 'text-text-secondary hover:bg-white/[0.05]'
        }`}
      >
        {isFolder ? (
          <>
            {isOpen ? (
              <ChevronDownIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronRightIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <FolderIcon className="h-4 w-4 shrink-0 text-neon-violet" aria-hidden="true" />
          </>
        ) : (
          <FileIcon className="ml-5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {isFolder && isOpen && node.children && node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function FileExplorer({
  owner,
  repo,
  tree,
  truncated,
  initialFile,
}: {
  owner: string;
  repo: string;
  tree: TreeNode[];
  truncated: boolean;
  /**
   * Pre-loaded on the server when the URL carries `?path=`, so a deep link from
   * the command palette renders the file immediately instead of selecting it
   * and then fetching it from an effect.
   */
  initialFile?: FileContent | null;
}) {
  const [selected, setSelected] = useState<string | null>(initialFile?.path ?? null);
  const [file, setFile] = useState<FileContent | null>(initialFile ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const select = useCallback(
    async (path: string) => {
      setSelected(path);
      setIsLoading(true);
      setError(null);
      setFile(null);
      try {
        const params = new URLSearchParams({ owner, repo, path });
        const res = await fetch(`/api/github/file?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Could not load that file.');
        setFile(data as FileContent);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load that file.');
      } finally {
        setIsLoading(false);
      }
    },
    [owner, repo],
  );

  // Filtering flattens to matching files so a deep match is reachable in one click.
  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return null;

    const matches: TreeNode[] = [];
    const walk = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file' && node.path.toLowerCase().includes(query)) matches.push(node);
        if (node.children) walk(node.children);
        if (matches.length >= 200) return;
      }
    };
    walk(tree);
    return matches;
  }, [filter, tree]);

  const lines = file ? file.text.split('\n') : [];

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-3">
      <div className="flex min-h-0 flex-col overflow-hidden glass rounded-2xl md:col-span-1">
        <div className="border-b border-white/[0.07] p-3">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter files…"
            aria-label="Filter files by path"
            className="w-full rounded-md border border-white/10 bg-background px-3 py-1.5 text-sm text-text-primary placeholder:text-muted focus:border-neon-violet/60 focus:outline-none"
          />
          {truncated && (
            <p className="mt-2 text-xs text-warning/90">
              This repository is large; GitHub truncated the file listing.
            </p>
          )}
        </div>

        <div className="flex-1 overflow-auto p-2">
          {filtered ? (
            filtered.length === 0 ? (
              <p className="p-4 text-sm text-text-secondary">No files match “{filter}”.</p>
            ) : (
              <ul>
                {filtered.map((node) => (
                  <li key={node.path}>
                    <button
                      type="button"
                      onClick={() => select(node.path)}
                      title={node.path}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        selected === node.path
                          ? 'bg-neon-violet/15 text-neon-violet'
                          : 'text-text-secondary hover:bg-white/[0.05]'
                      }`}
                    >
                      <FileIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                      <span className="truncate">{node.path}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <ul>
              {tree.map((node) => (
                <TreeItem
                  key={node.path}
                  node={node}
                  depth={0}
                  selected={selected}
                  onSelect={select}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden glass rounded-2xl md:col-span-2">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
          <h2 className="min-w-0 truncate font-mono text-sm text-text-primary">
            {selected ?? 'No file selected'}
          </h2>
          {file && !file.isTruncated && (
            <span className="shrink-0 text-xs text-text-secondary">
              {lines.length.toLocaleString()} lines
            </span>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {!selected && (
            <EmptyState
              icon={<FileIcon className="h-10 w-10" />}
              title="Select a file"
              message="Choose a file from the tree to read its contents."
            />
          )}

          {isLoading && (
            <div
              className="flex flex-col items-center justify-center gap-3 py-20"
              aria-live="polite"
            >
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-neon-violet" />
              <p className="text-sm text-text-secondary">Loading file…</p>
            </div>
          )}

          {!isLoading && error && (
            <div className="p-4">
              <ErrorPanel title="Could not open this file" message={error} />
            </div>
          )}

          {!isLoading &&
            file &&
            (file.isTruncated ? (
              <p className="p-6 text-sm text-text-secondary">{file.text}</p>
            ) : (
              <table className="w-full border-collapse font-mono text-xs">
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i}>
                      <td className="w-14 select-none border-r border-white/[0.06] px-3 py-0.5 text-right align-top tabular-nums text-muted">
                        {i + 1}
                      </td>
                      <td className="whitespace-pre-wrap break-all px-3 py-0.5 text-text-secondary">
                        {line}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </div>
      </div>
    </div>
  );
}
