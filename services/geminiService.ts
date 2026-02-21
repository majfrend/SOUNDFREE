
import { GoogleGenAI, Type } from "@google/genai";

// Inizializzazione del client Google GenAI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Verifica l'originalità di una traccia utilizzando Gemini.
 * Utilizziamo gemini-3-flash-preview per garantire una risposta veloce e minori problemi di quota.
 */
export const checkTrackOriginality = async (title: string, artist: string): Promise<{ isOriginal: boolean; reason?: string }> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analizza se questa traccia musicale sembra un'opera protetta da copyright esistente o un'opera originale/inedita.
      Titolo: "${title}"
      Artista: "${artist}"
      
      Rispondi esclusivamente in formato JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isOriginal: { type: Type.BOOLEAN },
            reason: { type: Type.STRING }
          },
          required: ["isOriginal", "reason"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Risposta vuota dall'AI");
    
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (error: any) {
    console.warn("Originality check error:", error);
    // Se la quota è esaurita (429), permettiamo il caricamento con un avviso
    if (error?.message?.includes('429') || error?.status === 429) {
      return { isOriginal: true, reason: "Verifica automatica momentaneamente non disponibile (Quota esaurita). Si prega di procedere solo se si possiedono i diritti." };
    }
    return { isOriginal: true, reason: "Errore durante la verifica. Assicurati di caricare contenuti originali." };
  }
};
