import React from 'react';

/**
 * Small markdown renderer for model output.
 *
 * It builds React elements directly and never touches `dangerouslySetInnerHTML`,
 * so model output cannot inject markup. It covers what the prompts actually ask
 * for: headings, lists, fenced code, bold, and inline code.
 */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Alternating split on `code` and **bold**.
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  const parts = text.split(pattern);

  parts.forEach((part, i) => {
    if (!part) return;
    const key = `${keyPrefix}-${i}`;

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      nodes.push(
        <code
          key={key}
          className="rounded border border-white/[0.07] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[0.85em] text-neon-cyan"
        >
          {part.slice(1, -1)}
        </code>,
      );
    } else if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      nodes.push(
        <strong key={key} className="font-semibold text-text-primary">
          {part.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(<React.Fragment key={key}>{part}</React.Fragment>);
    }
  });

  return nodes;
}

export function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split('\n');

  let listItems: string[] = [];
  let codeLines: string[] = [];
  let inCode = false;
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul
        key={`ul-${key++}`}
        className="my-3 list-disc space-y-1.5 pl-6 marker:text-neon-violet/60 text-text-secondary"
      >
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item, `li-${key}-${i}`)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  const flushCode = () => {
    if (codeLines.length === 0) return;
    blocks.push(
      <pre
        key={`pre-${key++}`}
        className="glass-inset my-3 overflow-x-auto rounded-xl p-4 font-mono text-sm text-text-secondary"
      >
        <code>{codeLines.join('\n')}</code>
      </pre>,
    );
    codeLines = [];
  };

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      listItems.push(bullet[1] ?? '');
      continue;
    }

    flushList();

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = (heading[1] ?? '#').length;
      const content = renderInline(heading[2] ?? '', `h-${key}`);
      const cls = [
        'mt-6 mb-3 text-2xl font-bold text-text-primary',
        'mt-6 mb-3 text-xl font-bold text-text-primary',
        'mt-5 mb-2 text-lg font-semibold text-text-primary',
        'mt-4 mb-2 font-semibold text-text-primary',
      ][level - 1];
      const Tag = (['h1', 'h2', 'h3', 'h4'] as const)[level - 1] ?? 'h4';
      blocks.push(
        <Tag key={`h-${key++}`} className={cls}>
          {content}
        </Tag>,
      );
      continue;
    }

    if (line.trim() === '') continue;

    blocks.push(
      <p key={`p-${key++}`} className="my-2 leading-relaxed text-text-secondary">
        {renderInline(line, `p-${key}`)}
      </p>,
    );
  }

  flushList();
  flushCode();

  return <div className="max-w-none">{blocks}</div>;
}
