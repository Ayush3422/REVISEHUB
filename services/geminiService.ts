import { GoogleGenAI } from "@google/genai";
import type { CodeSuggestion, TreeNode } from '../types';
import { SuggestionCategory, SuggestionSeverity } from "../types";

// Correctly initialize the library with the API key from your .env.local file
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// This function generates chat responses
export async function generateChatResponse(fileTree: TreeNode[], userQuery: string): Promise<string> {
  const stringifyTree = (nodes: TreeNode[], indent = ''): string => {
    return nodes.map(node => {
      const name = indent + node.name;
      if (node.type === 'folder' && node.children) {
        return name + '/\n' + stringifyTree(node.children, indent + '  ');
      }
      return name;
    }).join('\n');
  };

  const repoContext = stringifyTree(fileTree);

  const prompt = `You are an AI assistant for a code review application. Your task is to answer questions about a GitHub repository.

  Here is the file structure of the repository:
  \`\`\`
  ${repoContext}
  \`\`\`

  Based on this file structure, please answer the following user question. Be concise and helpful.

  User Question: "${userQuery}"`;

  try {
    const result = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });
    return result.candidates[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    console.error("Error generating chat response:", error);
    return "Sorry, I encountered an error trying to generate a response.";
  }
}

const codeReviewPrompt = `
You are an expert senior software engineer performing a code review.
Analyze the following code diff and provide suggestions for improvement.
For each suggestion, provide:
1.  A category: ${Object.values(SuggestionCategory).join(', ')}.
2.  A severity: ${Object.values(SuggestionSeverity).join(', ')}.
3.  A concise description of the issue.
4.  A code snippet with the suggested fix.

Focus on identifying potential bugs, improving code style and readability, opportunities for optimization, and areas where documentation is lacking.
Do not comment on minor stylistic preferences unless they significantly impact readability.
Return your response as a JSON array of suggestions.
`;

export async function reviewCode(diff: string): Promise<CodeSuggestion[]> {
  try {
    const result = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: `${codeReviewPrompt}\n\nCode Diff:\n\`\`\`diff\n${diff}\n\`\`\``,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      }
    });
    const jsonStr = result.candidates[0]?.content?.parts?.[0]?.text || "";
    const suggestions: CodeSuggestion[] = JSON.parse(jsonStr);
    return suggestions;
  } catch (error) {
    console.error("DETAILED GEMINI API ERROR (Code Review):", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API Error: ${error.message}`);
    }
    throw new Error('An unknown error occurred during code review.');
  }
}

export async function analyzeProject(
    pullRequests: string,
    contributors: string,
    churn: string,
    velocity: string
): Promise<string> {
    const analysisPrompt = `
    You are a principal engineer and project manager analyzing the health of a software project.
    Based on the following data, provide a concise, high-level analysis (2-3 paragraphs).
    - Identify positive trends and potential risks.
    - Offer actionable advice for the team.
    - Format your response using markdown.
    
    Here is the data:
    - Recent Pull Requests Summary: ${pullRequests}
    - Contributor Statistics: ${contributors}
    - Code Churn Data: ${churn}
    - PR Velocity Data: ${velocity}
    `;

  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: analysisPrompt,
      config: {
        temperature: 0.5,
      },
    });
    return result.candidates[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    console.error("DETAILED GEMINI API ERROR (Project Analysis):", error);
    if (error instanceof Error) {
      throw new Error(`Gemini API Error: ${error.message}`);
    }
    throw new Error('An unknown error occurred during project analysis.');
  }
}