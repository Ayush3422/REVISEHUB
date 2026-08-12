import React from 'react';
import { parseDiff, type DiffFile } from '@/lib/diff';
import { EmptyState } from './ui/Panel';

const LINE_STYLES = {
  add: 'bg-emerald-500/10 text-emerald-200',
  del: 'bg-red-500/10 text-red-200',
  context: 'text-text-secondary',
} as const;

const MARKERS = { add: '+', del: '-', context: ' ' } as const;

function FileHeader({ file }: { file: DiffFile }) {
  const label = file.isRenamed ? `${file.oldPath} → ${file.newPath}` : file.newPath;
  const tag = file.isNew ? 'added' : file.isDeleted ? 'deleted' : file.isRenamed ? 'renamed' : null;

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-muted/50 bg-surface px-4 py-2.5">
      <code className="min-w-0 flex-1 truncate font-mono text-sm text-text-primary" title={label}>
        {label}
      </code>
      {tag && (
        <span className="rounded-full bg-muted/40 px-2 py-0.5 text-xs text-text-secondary">
          {tag}
        </span>
      )}
      <span className="font-mono text-xs tabular-nums text-emerald-400">+{file.additions}</span>
      <span className="font-mono text-xs tabular-nums text-red-400">-{file.deletions}</span>
    </div>
  );
}

export function DiffViewer({ diff }: { diff: string }) {
  const files = parseDiff(diff);

  if (files.length === 0) {
    return (
      <EmptyState
        title="No changes to show"
        message="This pull request has an empty diff, which usually means it only contains merge commits."
      />
    );
  }

  return (
    <div className="space-y-4">
      {files.map((file) => (
        <div
          key={`${file.oldPath}->${file.newPath}`}
          className="overflow-hidden rounded-lg border border-muted/40"
        >
          <FileHeader file={file} />

          {file.isBinary ? (
            <p className="px-4 py-6 text-center text-sm text-text-secondary">
              Binary file not shown.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse font-mono text-xs">
                <tbody>
                  {file.hunks.map((hunk, hi) => (
                    <React.Fragment key={hi}>
                      <tr>
                        <td colSpan={3} className="bg-primary/10 px-4 py-1 text-primary/80">
                          {hunk.header}
                        </td>
                      </tr>
                      {hunk.lines.map((line, li) => (
                        <tr key={`${hi}-${li}`} className={LINE_STYLES[line.type]}>
                          {/* Real line numbers, read from the hunk header. */}
                          <td className="w-12 select-none border-r border-muted/30 px-2 text-right tabular-nums text-muted">
                            {line.oldLine ?? ''}
                          </td>
                          <td className="w-12 select-none border-r border-muted/30 px-2 text-right tabular-nums text-muted">
                            {line.newLine ?? ''}
                          </td>
                          {/* The marker is rendered separately so the line's own
                              first character is never eaten. */}
                          <td className="whitespace-pre-wrap break-all px-3 py-0.5">
                            <span className="select-none text-muted">{MARKERS[line.type]} </span>
                            {line.content}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
