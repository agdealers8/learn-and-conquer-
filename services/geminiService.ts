import { GoogleGenAI, Type } from "@google/genai";
import { Message, StudySettings, Flashcard, QuizQuestion, StudySession } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to construct system instructions based on settings
const getSystemInstruction = (settings: StudySettings): string => {
  return `You are Learn and Conquer, a world-class AI Study Assistant. 
  
  User Profile:
  - Location: ${settings.province}, ${settings.country}.
  - Class/Grade: ${settings.userLevel}.
  - Syllabus/Curriculum: ${settings.syllabus}.
  - Language: ${settings.language} (ALWAYS reply in this language unless asked otherwise).

  Your Goal:
  - Provide accurate, syllabus-compliant explanations.
  - IF the user is from Pakistan/Punjab and studying the Punjab Textbook Board, refer to specific concepts from those books where possible.
  - If the user asks for a summary, provide a structured summary.
  - Be encouraging and pedagogical.
  - If the language is Arabic or Urdu, ensure the text flows naturally for RTL reading.
  `;
};

export const streamChatResponse = async (
  history: Message[],
  newMessage: string,
  settings: StudySettings,
  onChunk: (text: string) => void
): Promise<string> => {
  const ai = getAI();
  
  // Convert internal Message format to SDK Content format
  const historyContents = history.map(h => ({
    role: h.role,
    parts: [{ text: h.text }]
  }));

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: getSystemInstruction(settings),
    },
    history: historyContents
  });

  const result = await chat.sendMessageStream({
    message: newMessage
  });

  let fullText = "";
  for await (const chunk of result) {
    const text = chunk.text;
    if (text) {
      fullText += text;
      onChunk(text);
    }
  }
  return fullText;
};

export const generateFlashcards = async (topic: string, settings: StudySettings): Promise<Flashcard[]> => {
  const ai = getAI();
  
  const prompt = `Generate 20 high-quality study flashcards about: "${topic}". 
  Context: ${settings.country}, ${settings.province}.
  Syllabus: ${settings.syllabus}.
  Grade: ${settings.userLevel}.
  Language: ${settings.language}.
  Also provide a single English keyword for each card that describes the concept visually (for searching an image).`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            front: { type: Type.STRING },
            back: { type: Type.STRING },
            imageKeyword: { type: Type.STRING },
          },
          required: ["front", "back", "imageKeyword"],
        },
      },
    },
  });

  if (response.text) {
    return JSON.parse(response.text);
  }
  return [];
};

export const generateQuiz = async (topic: string, requirements: string, settings: StudySettings): Promise<QuizQuestion[]> => {
  const ai = getAI();
  const prompt = `Generate a quiz about "${topic}". Requirements: ${requirements}.
  Context: ${settings.syllabus}, ${settings.userLevel}.
  Language: ${settings.language}.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswerIndex: { type: Type.INTEGER },
            explanation: { type: Type.STRING },
          },
          required: ["question", "options", "correctAnswerIndex", "explanation"],
        },
      },
    },
  });

  if (response.text) {
    return JSON.parse(response.text);
  }
  return [];
};

export const summarizeText = async (text: string, settings: StudySettings): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Summarize the following text for a student (${settings.userLevel}):\n\n${text}`,
    config: {
      systemInstruction: getSystemInstruction(settings),
    },
  });
  return response.text || "Unable to summarize.";
};

export const generateStudySchedule = async (input: string, settings: StudySettings): Promise<StudySession[]> => {
  const ai = getAI();
  const prompt = `Create a study schedule session list based on user input: "${input}".
  Format as structured data. Date should be relative or specific if mentioned.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            time: { type: Type.STRING },
            activity: { type: Type.STRING },
            duration: { type: Type.STRING },
            notes: { type: Type.STRING },
          },
          required: ["id", "time", "activity", "duration", "notes"],
        },
      },
    },
  });

  if (response.text) {
    return JSON.parse(response.text);
  }
  return [];
};

export const findExternalBookResource = async (query: string, settings: StudySettings): Promise<{found: boolean, title?: string, link?: string, description?: string}> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Find a specific high-quality free online textbook or educational resource for: "${query}".
    Provide the title and a short description.`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  let link: string | undefined;
  let title: string | undefined;

  if (chunks) {
    for (const chunk of chunks) {
      if (chunk.web?.uri) {
        link = chunk.web.uri;
        title = chunk.web.title;
        break;
      }
    }
  }

  return {
    found: !!link,
    title: title || query,
    link: link,
    description: response.text || "No description available.",
  };
};

export const generateIllustration = async (keyword: string): Promise<string | undefined> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `A clear, educational diagram or illustration of: ${keyword}. White background, simple lines.` }],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  } catch (e) {
    console.error("Image generation failed", e);
  }
  return undefined;
};

export const analyzeHandwriting = async (base64Image: string, settings: StudySettings): Promise<string> => {
  const ai = getAI();
  // Extract base64 data if it includes the prefix
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { 
          inlineData: { 
            data: base64Data, 
            mimeType: "image/png" 
          } 
        },
        { text: "Analyze this image (handwritten note or diagram). Solve any math problems found or explain the concept shown." }
      ]
    }
  });

  return response.text || "Could not analyze image.";
};