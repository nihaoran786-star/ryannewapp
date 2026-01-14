
import { VolcSettings, ShotAnalysis } from '../types';
import { callVolcChatApi, PROMPTS } from './volcEngineService';

const safeParseJSON = (str: string) => {
    try {
        const codeBlockMatch = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        let candidate = codeBlockMatch ? codeBlockMatch[1] : str;
        candidate = candidate.trim();
        return JSON.parse(candidate);
    } catch (e) {
        try {
            const firstOpen = str.indexOf('{');
            const lastClose = str.lastIndexOf('}');
            if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
                const jsonSubstring = str.substring(firstOpen, lastClose + 1);
                return JSON.parse(jsonSubstring);
            }
        } catch (e2) { }
        console.error("Director JSON extraction failed", e);
        return null;
    }
};

export const analyzeShotStorytelling = async (
    settings: VolcSettings,
    shotText: string,
    context: string // e.g. "Scene Header: INT. ROOM - DAY"
): Promise<ShotAnalysis | null> => {
    if (!settings.apiKey) throw new Error("Volc Engine API Key missing");

    const userPrompt = `Context: ${context}\nShot Action: ${shotText}\n\nProvide cinematic analysis.`;
    
    try {
        const response = await callVolcChatApi(settings, PROMPTS.SHOT_ANALYSIS, userPrompt);
        const data = safeParseJSON(response);
        
        if (data && data.recommended_angles) {
            return data as ShotAnalysis;
        }
        return null;
    } catch (e) {
        console.error("Shot analysis failed", e);
        throw e;
    }
};
