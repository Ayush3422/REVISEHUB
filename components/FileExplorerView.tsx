import React, { useState, useEffect } from 'react';
import type { Repo, TreeNode } from '../types';
import { getFileTree, getFileContent } from '../services/githubService';
import { FileTree } from './FileTree';
import { CodeEditor } from './CodeEditor';
import { Loader } from './Loader';

interface FileExplorerViewProps {
  repo: Repo;
}

export const FileExplorerView: React.FC<FileExplorerViewProps> = ({ repo }) => {
    const [tree, setTree] = useState<TreeNode[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const [isLoadingTree, setIsLoadingTree] = useState(true);
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    const [error, setError] = useState<string | null>(null); // State to hold error messages

    useEffect(() => {
        const fetchTree = async () => {
            setIsLoadingTree(true);
            setError(null); // Reset error state on new fetch
            try {
                const fileTree = await getFileTree(repo.url);
                setTree(fileTree);
            } catch (err) {
                console.error("Failed to fetch file tree:", err);
                // Set a user-friendly error message
                setError('Failed to load repository files. The repository might be private, empty, or you may have exceeded the GitHub API rate limit.');
            } finally {
                // This ensures loading is always set to false, even if an error occurs
                setIsLoadingTree(false);
            }
        };
        fetchTree();
    }, [repo.url]);

    const handleFileSelect = async (filePath: string) => {
        setSelectedFile(filePath);
        setIsLoadingFile(true);
        try {
            const content = await getFileContent(repo.url, filePath);
            setFileContent(content);
        } catch (err) {
            console.error("Failed to fetch file content:", err);
            setFileContent(`// Error: Could not load content for ${filePath}`);
        } finally {
            setIsLoadingFile(false);
        }
    };

    return (
        <div className="animate-fade-in h-full flex flex-col">
            <h2 className="text-3xl font-bold text-white mb-2">File Explorer</h2>
            <p className="text-text-secondary mb-6">Browse the repository structure for <span className="font-semibold text-primary">{repo.name}</span></p>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
                <div className="md:col-span-1 bg-surface/50 border border-muted/50 rounded-xl overflow-auto p-4">
                    {isLoadingTree ? (
                        <Loader text="Loading file tree..." />
                    ) : error ? (
                        <div className="text-red-400 bg-red-900/50 p-4 rounded-lg">{error}</div>
                    ) : (
                        <FileTree tree={tree} onFileSelect={handleFileSelect} />
                    )}
                </div>
                <div className="md:col-span-2 bg-surface/50 border border-muted/50 rounded-xl overflow-auto flex flex-col">
                    <div className="p-4 border-b border-muted/50">
                        <h3 className="text-lg font-semibold text-text-primary">{selectedFile || 'Select a file to view its content'}</h3>
                    </div>
                    <div className="flex-1">
                        {isLoadingFile ? <Loader text="Loading file..." /> : <CodeEditor content={fileContent} />}
                    </div>
                </div>
            </div>
        </div>
    );
};