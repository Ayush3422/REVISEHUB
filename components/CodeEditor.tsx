
import React from 'react';

interface CodeEditorProps {
  content: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ content }) => {
  if (!content) {
    return (
      <div className="h-full flex items-center justify-center text-text-secondary">
        <p>No file selected.</p>
      </div>
    );
  }

  const lines = content.split('\n');

  return (
    <div className="p-4 font-mono text-sm h-full overflow-auto">
        {lines.map((line, index) => (
             <div key={index} className="flex">
                <span className="w-12 text-right pr-4 select-none text-muted">{index + 1}</span>
                <pre className="flex-1 whitespace-pre-wrap">{line}</pre>
            </div>
        ))}
    </div>
  );
};
