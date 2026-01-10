
import { ScriptLine, ScriptLineType, ScriptScene, ScriptCharacter, StoryboardData, StoryboardScene, StoryboardShot, StoryboardCharacter, VolcSettings } from '../types';
import { callVolcChatApi } from './volcEngineService';

// Simple colors for character highlighting
const CHAR_COLORS = [
  '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55'
];

/**
 * Parses raw text into structured screenplay lines (Fountain-lite logic).
 */
export const parseScript = (text: string): ScriptLine[] => {
  const lines = text.split('\n');
  const result: ScriptLine[] = [];
  
  let lastLineWasEmpty = true;

  lines.forEach((line, index) => {
    const trimLine = line.trim();
    const id = `line-${index}`;
    
    if (!trimLine) {
      result.push({ id, type: 'empty', text: '' });
      lastLineWasEmpty = true;
      return;
    }

    // SCENE HEADING: Starts with INT., EXT., EST., I/E.
    if (/^(INT\.|EXT\.|EST\.|I\/E\.|INT\/EXT\.)/i.test(trimLine)) {
      result.push({ id, type: 'scene', text: trimLine.toUpperCase() });
      lastLineWasEmpty = false;
      return;
    }

    // CHARACTER: All caps, preceded by empty line, not a scene header
    const isUppercase = trimLine === trimLine.toUpperCase() && /[A-Z]/.test(trimLine);
    if (lastLineWasEmpty && isUppercase && !trimLine.endsWith(':')) { 
       result.push({ id, type: 'character', text: trimLine });
       lastLineWasEmpty = false;
       return;
    }

    // PARENTHETICAL: Wrapped in (...)
    if (/^\(.*\)$/.test(trimLine)) {
      result.push({ id, type: 'parenthetical', text: trimLine });
      lastLineWasEmpty = false;
      return;
    }

    // DIALOGUE
    const prevType = result[result.length - 1]?.type;
    if (prevType === 'character' || prevType === 'parenthetical') {
      result.push({ id, type: 'dialogue', text: trimLine });
      lastLineWasEmpty = false;
      return;
    }

    // TRANSITION
    if (trimLine.endsWith('TO:') && isUppercase) {
        result.push({ id, type: 'transition', text: trimLine });
        lastLineWasEmpty = false;
        return;
    }

    // ACTION
    result.push({ id, type: 'action', text: trimLine });
    lastLineWasEmpty = false;
  });

  return result;
};

export const extractScenes = (lines: ScriptLine[]): ScriptScene[] => {
  const scenes: ScriptScene[] = [];
  let count = 1;

  lines.forEach((line, idx) => {
    if (line.type === 'scene') {
        scenes.push({
            id: line.id,
            number: count++,
            header: line.text,
            lineIndex: idx,
            logline: "Pending analysis...",
            sentiment: 0
        });
    }
  });

  return scenes;
};

export const extractCharacters = (lines: ScriptLine[]): ScriptCharacter[] => {
  const charMap = new Map<string, number>();

  lines.forEach(line => {
    if (line.type === 'character') {
        const name = line.text.trim().replace(/\s*\(.*\)$/, '');
        charMap.set(name, (charMap.get(name) || 0) + 1);
    }
  });

  const characters: ScriptCharacter[] = [];
  let colorIdx = 0;

  charMap.forEach((count, name) => {
      if (count < 1 || name.length > 20) return;
      characters.push({
          id: `char-${name.replace(/\s+/g, '_')}`,
          name: name,
          dialogueCount: count,
          color: CHAR_COLORS[colorIdx % CHAR_COLORS.length],
          motivation: "Unknown",
          tags: [],
          bio: ""
      });
      colorIdx++;
  });

  return characters.sort((a, b) => b.dialogueCount - a.dialogueCount);
};

// Base deterministic structure generation
export const generateStoryboardStructure = (scriptText: string): StoryboardData => {
  const lines = parseScript(scriptText);
  const baseCharacters = extractCharacters(lines);
  
  const sbCharacters: StoryboardCharacter[] = baseCharacters.map(c => ({
    id: c.id,
    name: c.name,
    visualDescription: `${c.name}, cinematic movie character, detailed face, photorealistic lighting.`,
  }));

  const sbScenes: StoryboardScene[] = [];
  let currentScene: StoryboardScene | null = null;
  let sceneShotCounter = 1;

  lines.forEach((line, idx) => {
    if (line.type === 'scene') {
      if (currentScene) sbScenes.push(currentScene);
      currentScene = {
        id: `sb-scene-${idx}`,
        number: sbScenes.length + 1,
        header: line.text,
        atmosphere: 'Cinematic lighting, movie scene',
        shots: []
      };
      sceneShotCounter = 1;
    } else if (line.type === 'action' && currentScene) {
      if (line.text.length > 5) {
         currentScene.shots.push({
             id: `shot-${currentScene.id}-${sceneShotCounter++}`,
             text: line.text,
             promptPreFill: line.text,
             characterIds: [] 
         });
      }
    }
  });
  
  if (currentScene) sbScenes.push(currentScene);

  return {
    characters: sbCharacters,
    scenes: sbScenes,
    lastUpdated: Date.now()
  };
};

/**
 * PHASE 1: Deep Script Analysis
 * Uses Volc Engine (if configured) to semantically enrich the storyboard data.
 */
export const performDeepScriptAnalysis = async (
    scriptText: string, 
    volcSettings?: VolcSettings
): Promise<StoryboardData> => {
    // 1. Generate skeleton structure
    const baseData = generateStoryboardStructure(scriptText);
    
    // If no AI configured, return skeleton
    if (!volcSettings || !volcSettings.apiKey) {
        return baseData;
    }

    try {
        // 2. AI Character Analysis (Extraction of Visual Traits)
        const charNames = baseData.characters.map(c => c.name);
        if (charNames.length > 0) {
             const charSystemPrompt = "You are a Casting Director. Extract detailed visual descriptions for the characters. Output STRICT JSON: {\"CharacterName\": \"Visual Description (Age, Clothes, Face, Vibe)\"}.";
             const charUserPrompt = `Characters: ${charNames.join(', ')}.\n\nScript Segment:\n${scriptText.slice(0, 3500)}`;
             
             const charRes = await callVolcChatApi(volcSettings, charSystemPrompt, charUserPrompt);
             
             try {
                 const jsonStr = charRes.replace(/```json/g, '').replace(/```/g, '').trim();
                 const visualMap = JSON.parse(jsonStr);
                 
                 baseData.characters = baseData.characters.map(c => ({
                     ...c,
                     visualDescription: visualMap[c.name] 
                        ? `${visualMap[c.name]}, cinematic, 8k, detailed` 
                        : c.visualDescription
                 }));
             } catch (e) { console.warn("Character JSON parse failed", e); }
        }

        // 3. AI Scene Analysis (Atmosphere Extraction)
        if (baseData.scenes.length > 0) {
            const sceneHeaders = baseData.scenes.map(s => s.header).join('\n');
            const sceneSystemPrompt = "You are a Cinematographer. Define the visual atmosphere/lighting for these scenes. Output STRICT JSON: {\"SCENE HEADER\": \"Atmosphere Keywords (e.g. Dark, Neon, Foggy, Warm)\"}.";
            
            const sceneRes = await callVolcChatApi(volcSettings, sceneSystemPrompt, `Scenes:\n${sceneHeaders}\n\nContext:\n${scriptText.slice(0, 2000)}`);
            
            try {
                const jsonStr = sceneRes.replace(/```json/g, '').replace(/```/g, '').trim();
                const moodMap = JSON.parse(jsonStr);
                
                baseData.scenes = baseData.scenes.map(s => ({
                    ...s,
                    atmosphere: moodMap[s.header] || s.atmosphere
                }));
            } catch (e) { console.warn("Scene JSON parse failed", e); }
        }

    } catch (error) {
        console.error("Deep Analysis Failed:", error);
        // Fail gracefully, return base data
    }

    return baseData;
};

export const MOCK_INITIAL_SCRIPT = `INT. COFFEE SHOP - DAY

A quaint, hipster cafe. Sunlight streams through dirty windows.

ALEX (30s, disheveled) sits at a corner table, typing furiously on a laptop.

             ALEX
    (muttering)
  Come on... just one good line.

SARAH (20s, barista) approaches with a pot of coffee.

             SARAH
  Refill? You look like you need it.

Alex looks up, startled. He knocks his spoon off the table.

             ALEX
  Oh, uh, yes. Please. I've been awake
  since Tuesday.

             SARAH
  Tuesday was three days ago, Alex.

EXT. STREET - MOMENTS LATER

Alex bursts out of the shop, manic energy radiating off him.

             ALEX
  I've got it! The missing piece!`;
