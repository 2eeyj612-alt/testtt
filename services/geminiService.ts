import { GoogleGenAI, Type } from "@google/genai";
import { CategoryMapping } from '../types';

export const categorizeProductsWithAI = async (productNames: string[]): Promise<CategoryMapping[]> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    console.warn("API Key missing, skipping AI categorization");
    return productNames.map(name => ({ productName: name, major: '미분류', minor: '기타' }));
  }

  // Initialize inside the function to prevent top-level script errors
  const ai = new GoogleGenAI({ apiKey });

  // Deduplicate names to save tokens
  const uniqueNames = Array.from(new Set(productNames));
  
  // Chunking to avoid massive prompts (limit to 300 items for stability)
  const chunk = uniqueNames.slice(0, 300); 

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a professional merchandising expert.
      Classify the following product names into 'Major Category' (대분류) and 'Minor Category' (소분류).
      Examples of Major Categories: 패션, 식품, 가전, 뷰티, 생활용품, etc.
      Examples of Minor Categories: 티셔츠, 과일, 청소기, 스킨케어, 세제, etc.
      
      Product List: ${JSON.stringify(chunk)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              productName: { type: Type.STRING },
              major: { type: Type.STRING, description: "Major category in Korean" },
              minor: { type: Type.STRING, description: "Minor category in Korean" }
            },
            required: ["productName", "major", "minor"]
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) return [];
    
    const mappings = JSON.parse(jsonText) as CategoryMapping[];
    return mappings;

  } catch (error) {
    console.error("AI Categorization failed:", error);
    // Fallback to unclassified
    return uniqueNames.map(name => ({ productName: name, major: '미분류', minor: '기타' }));
  }
};