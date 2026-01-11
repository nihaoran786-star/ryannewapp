

import { ScriptLine, ScriptLineType, ScriptScene, ScriptCharacter, StoryboardData, StoryboardScene, StoryboardShot, StoryboardCharacter, VolcSettings, ScriptProject, LogicIssue, StoryboardProp, StoryboardSceneVisual } from '../types';
import { callVolcChatApi, PROMPTS } from './volcEngineService';

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
             characterIds: [],
             characterRefs: [],
             constructedPrompt: ""
         });
      }
    }
  });
  
  if (currentScene) sbScenes.push(currentScene);

  return {
    characters: sbCharacters,
    sceneVisuals: [],
    props: [],
    scenes: sbScenes,
    lastUpdated: Date.now(),
    globalStyle: 'Cinematic, Photorealistic, 8k, Film Grain' // Default style
  };
};

/**
 * Helper to safely parse JSON from LLM output (which might have markdown backticks)
 */
const safeParseJSON = (str: string) => {
    try {
        const jsonStr = str.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("JSON Parse Error:", e, str);
        return null;
    }
};

/**
 * PHASE 1-3: Multi-Stage Deep Script Analysis
 * Uses Volc Engine to perform Macro, Structural, and QC analysis.
 */
export const performDeepScriptAnalysis = async (
    scriptText: string, 
    volcSettings: VolcSettings,
    onProgress?: (stage: number, message: string) => void
): Promise<{ projectUpdates: Partial<ScriptProject>, storyboard: StoryboardData }> => {
    
    const baseData = generateStoryboardStructure(scriptText);
    const resultProject: Partial<ScriptProject> = {};
    let finalStoryboard = { ...baseData };

    if (!volcSettings || !volcSettings.apiKey) {
        return { projectUpdates: {}, storyboard: baseData };
    }

    try {
        // --- STAGE 1: MACRO ANALYSIS (Planner) ---
        onProgress?.(1, "Macro Analysis (Genre, Logline)...");
        const stage1Res = await callVolcChatApi(volcSettings, PROMPTS.ANALYSIS_STAGE_1, scriptText.slice(0, 10000));
        const stage1Data = safeParseJSON(stage1Res);
        
        if (stage1Data) {
            resultProject.title = stage1Data.title || undefined;
            resultProject.genre = stage1Data.genre || [];
            resultProject.logline = stage1Data.logline || "";
            resultProject.synopsis = stage1Data.synopsis || "";
        }

        // --- STAGE 2: STRUCTURE & VISUALS (Director) ---
        onProgress?.(2, "Structural Visual Extraction...");
        const stage2Res = await callVolcChatApi(volcSettings, PROMPTS.ANALYSIS_STAGE_2, scriptText.slice(0, 15000));
        const stage2Data = safeParseJSON(stage2Res);

        if (stage2Data) {
            // Update Characters
            if (stage2Data.characters && Array.isArray(stage2Data.characters)) {
                const newChars: StoryboardCharacter[] = stage2Data.characters.map((c: any) => ({
                    id: `char-${c.name.replace(/\s+/g, '_')}`,
                    name: c.name,
                    visualDescription: c.bio ? `${c.name}, ${c.bio}, ${c.tags?.join(', ')}, cinematic` : `${c.name}, cinematic character`,
                    status: 'queued'
                }));
                finalStoryboard.characters = newChars;
            }

            // Update Props
            if (stage2Data.props && Array.isArray(stage2Data.props)) {
                const newProps: StoryboardProp[] = stage2Data.props.map((p: any, idx: number) => ({
                    id: `prop-${idx}-${p.name.replace(/\s+/g, '_')}`,
                    name: p.name,
                    visualDescription: p.description || `${p.name}, product shot, cinematic lighting`,
                    status: 'queued'
                }));
                finalStoryboard.props = newProps;
            }

            // Update Scene Visuals
            if (stage2Data.environment_visuals && Array.isArray(stage2Data.environment_visuals)) {
                 const newSceneVisuals: StoryboardSceneVisual[] = stage2Data.environment_visuals.map((e: any, idx: number) => ({
                     id: `sv-${idx}-${e.name.replace(/\s+/g, '_')}`,
                     name: e.name,
                     visualDescription: e.description || `${e.name}, establishing shot, no people`,
                     status: 'queued'
                 }));
                 finalStoryboard.sceneVisuals = newSceneVisuals;
            }

            // Update Scenes & Shots
            if (stage2Data.scenes && Array.isArray(stage2Data.scenes)) {
                 const newScenes: StoryboardScene[] = stage2Data.scenes.map((s: any, idx: number) => {
                     // Create a KEY MASTER SHOT from the visual_prompt
                     const masterShot: StoryboardShot = {
                         id: `shot-${idx}-master`,
                         text: s.summary || "Scene establishing shot",
                         promptPreFill: "Establishing shot",
                         constructedPrompt: s.visual_prompt || "", 
                         customFullPrompt: s.visual_prompt || "", 
                         characterIds: [],
                         characterRefs: [],
                         sceneVisualIds: [],
                         propIds: []
                     };
                     
                     return {
                         id: `scene-${s.scene_id || idx}`,
                         number: s.scene_id || (idx + 1),
                         header: s.header || `SCENE ${idx+1}`,
                         atmosphere: s.visual_prompt ? s.visual_prompt.split(',').slice(0,3).join(',') : "Cinematic",
                         shots: [masterShot]
                     };
                 });
                 finalStoryboard.scenes = newScenes;
            }
        }

        // --- STAGE 3: DEEP QC (Analyst) ---
        onProgress?.(3, "Deep QC & Logic Check...");
        const stage3Res = await callVolcChatApi(volcSettings, PROMPTS.ANALYSIS_STAGE_3, scriptText.slice(0, 15000));
        const stage3Data = safeParseJSON(stage3Res);

        if (stage3Data) {
            // Merge Analytics into Scenes
            if (stage3Data.analytics && Array.isArray(stage3Data.analytics)) {
                const scriptScenesUpdate: ScriptScene[] = extractScenes(parseScript(scriptText)).map((s, idx) => {
                    const analysis = stage3Data.analytics.find((a: any) => a.scene_id === s.number || a.scene_id === (idx + 1));
                    return {
                        ...s,
                        sentiment: analysis ? analysis.emotion_score : 0,
                        pacing: analysis ? analysis.pacing : undefined
                    };
                });
                resultProject.scenes = scriptScenesUpdate;
            }

            // Store Logic Issues
            if (stage3Data.logic_issues) {
                resultProject.logicIssues = stage3Data.logic_issues as LogicIssue[];
            }
        }

    } catch (error) {
        console.error("Deep Analysis Pipeline Failed:", error);
    }

    return { 
        projectUpdates: resultProject, 
        storyboard: finalStoryboard 
    };
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