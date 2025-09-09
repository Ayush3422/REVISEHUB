import { GoogleGenAI, Type } from "@google/genai";
import type { CodeSuggestion } from '../types';
import { SuggestionCategory, SuggestionSeverity } from "../types";

// The API key must be obtained exclusively from the environment variable `process.env.API_KEY`.
// Fix: Correctly initialize GoogleGenAI with a named apiKey parameter.
const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

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

const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        category: {
          type: Type.STRING,
          enum: Object.values(SuggestionCategory),
          description: 'The category of the suggestion.'
        },
        severity: {
          type: Type.STRING,
          enum: Object.values(SuggestionSeverity),
          description: 'The severity of the issue.'
        },
        description: {
          type: Type.STRING,
          description: 'A concise description of the issue and why the suggestion is an improvement.'
        },
        suggestion: {
          type: Type.STRING,
          description: 'A code snippet showing the suggested fix. Use markdown for code blocks.'
        }
      },
      required: ['category', 'severity', 'description', 'suggestion']
    }
};


export async function reviewCode(diff: string): Promise<CodeSuggestion[]> {
  try {
    // Fix: Use ai.models.generateContent with the correct model 'gemini-2.5-flash' and parameters.
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${codeReviewPrompt}\n\nCode Diff:\n\`\`\`diff\n${diff}\n\`\`\``,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2, // Lower temperature for more deterministic and focused reviews
      },
    });

    // Fix: Directly access the .text property from the response to get the generated content.
    const jsonStr = response.text.trim();
    const suggestions: CodeSuggestion[] = JSON.parse(jsonStr);
    return suggestions;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    // Add more robust error handling
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
        // Fix: Use ai.models.generateContent with the correct model 'gemini-2.5-flash' and parameters.
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: analysisPrompt,
            config: {
                temperature: 0.5,
            },
        });
        // Fix: Directly access the .text property for the response.
        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API for project analysis:", error);
        if (error instanceof Error) {
            throw new Error(`Gemini API Error: ${error.message}`);
        }
        throw new Error('An unknown error occurred during project analysis.');
    }
}
