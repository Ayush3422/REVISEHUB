import { GoogleGenAI } from "@google/genai";
import type { CodeSuggestion } from '../types';
import { SuggestionCategory, SuggestionSeverity } from "../types";

// Correctly initialize GoogleGenAI with the API key from the environment variable
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

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
    // Generate content using the new SDK method
    const result = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: `${codeReviewPrompt}\n\nCode Diff:\n\`\`\`diff\n${diff}\n\`\`\``,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      }
    });
  const jsonStr = result.candidates[0]?.content?.parts?.[0]?.text || '';
  // Parse the JSON string into an array of CodeSuggestion objects
  const suggestions: CodeSuggestion[] = JSON.parse(jsonStr);
  return suggestions;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
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
  return result.candidates[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
        console.error("Error calling Gemini API for project analysis:", error);
        if (error instanceof Error) {
            throw new Error(`Gemini API Error: ${error.message}`);
        }
        throw new Error('An unknown error occurred during project analysis.');
    }
}