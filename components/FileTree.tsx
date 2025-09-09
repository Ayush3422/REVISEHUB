
import React, { useState } from 'react';
import type { TreeNode } from '../types';
import { FolderIcon } from './icons/FolderIcon';
import { FileIcon } from './icons/FileIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';

interface FileTreeProps {
  tree: TreeNode[];
  onFileSelect: (path: string) => void;
}

const TreeItem: React.FC<{ item: TreeNode; onFileSelect: (path: string) => void; depth: number }> = ({ item, onFileSelect, depth }) => {
  const [isOpen, setIsOpen] = useState(depth < 2); // Auto-expand first few levels
  const isFolder = item.type === 'folder';

  const handleToggle = () => {
    if (isFolder) {
      setIsOpen(!isOpen);
    } else {
      onFileSelect(item.path);
    }
  };

  return (
    <div>
      <div 
        onClick={handleToggle} 
        className="flex items-center p-1.5 rounded-md hover:bg-surface cursor-pointer text-text-secondary"
        style={{ paddingLeft: `${depth * 1.5}rem` }}
      >
        {isFolder ? (
            <>
              {isOpen ? <ChevronDownIcon className="w-4 h-4 mr-2 flex-shrink-0" /> : <ChevronRightIcon className="w-4 h-4 mr-2 flex-shrink-0" />}
              <FolderIcon className="w-5 h-5 mr-2 text-primary flex-shrink-0" />
            </>
        ) : (
            <FileIcon className="w-5 h-5 mr-2 ml-6 text-muted flex-shrink-0" />
        )}
        <span className="truncate">{item.name}</span>
      </div>
      {isFolder && isOpen && (
        <div>
          {item.children?.map(child => <TreeItem key={child.path} item={child} onFileSelect={onFileSelect} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
};

export const FileTree: React.FC<FileTreeProps> = ({ tree, onFileSelect }) => {
  return (
    <div>
      {tree.map(item => <TreeItem key={item.path} item={item} onFileSelect={onFileSelect} depth={0} />)}
    </div>
  );
};
