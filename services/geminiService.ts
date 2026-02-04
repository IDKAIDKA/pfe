
import { GoogleGenAI, Type } from "@google/genai";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const cleanJson = (str: string) => {
  return str.replace(/```json\n?|```/g, "").trim();
};

export const humanizeText = async (text: string, promptInstruction: string) => {
  const ai = getAIClient();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `أنت خبير لغوي ومحرر نصوص عربي محترف. مهمتك هي إعادة صياغة النص ليصبح بشرياً تماماً ويصعب اكتشافه بواسطة أدوات كشف الذكاء الاصطناعي (ZeroGPT).
      
      التعليمات المحددة: ${promptInstruction}
      
      النص المراد تعديله:
      "${text}"
      
      القواعد:
      1. حافظ على المعنى الأصلي بدقة.
      2. إذا كان النص عنواناً، اجعله جذاباً وبشرياً.
      3. لا تضف أي تعليقات خارج النص المعدل.
      4. اجعل النتيجة في كائن JSON يحتوي على: "text" (النص المعدل) و "humanScore" (تقدير نسبة البشرية من 0-100).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            humanScore: { type: Type.NUMBER }
          },
          required: ["text", "humanScore"]
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("No response text returned from Gemini");
    }
    const cleanedText = cleanJson(responseText);
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Gemini Error:", error);
    return { text, humanScore: 45 }; 
  }
};

export const suggestPromptStyles = async (): Promise<{ name: string; text: string }[]> => {
  const ai = getAIClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `اقترح 7 قوالب تعليمات (Prompts) احترافية ومختلفة للذكاء الاصطناعي لإعادة صياغة النصوص العربية بأسلوب أكاديمي جامعي بليغ (لغة عربية فصحى، ليست لهجة). 
      يجب أن تكون التعليمات مصممة خصيصاً لتجاوز أدوات الكشف (ZeroGPT) عبر التركيز على تنوع البنية النحوية، السلاسة البشرية، والعمق المعرفي، والابتعاد عن الأنماط الآلية.
      أعطني النتيجة في مصفوفة JSON تحتوي على 7 كائنات، كل كائن يحتوي على: "name" (اسم الأسلوب) و "text" (التعليمات المفصلة للذكاء الاصطناعي).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              text: { type: Type.STRING }
            },
            required: ["name", "text"]
          }
        }
      }
    });
    return JSON.parse(cleanJson(response.text));
  } catch (error) {
    console.error("Gemini Suggest Error:", error);
    return [
      { name: "أسلوب أكاديمي مقترح", text: "أعد صياغة النص بأسلوب جامعي بليغ وتجنب القوالب النمطية." }
    ];
  }
};
