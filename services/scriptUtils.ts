

import { ScriptLine, ScriptLineType, ScriptScene, ScriptCharacter, StoryboardData, StoryboardScene, StoryboardShot, StoryboardCharacter } from '../types';

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
    // Simple heuristic: if previous was empty, current is uppercase, and next is not empty (assumed dialogue)
    // For robust fountain, we'd check margins, but for text editor:
    const isUppercase = trimLine === trimLine.toUpperCase() && /[A-Z]/.test(trimLine);
    if (lastLineWasEmpty && isUppercase && !trimLine.endsWith(':')) { // Exclude transitions like CUT TO:
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

    // DIALOGUE: If previous was Character or Parenthetical
    const prevType = result[result.length - 1]?.type;
    if (prevType === 'character' || prevType === 'parenthetical') {
      result.push({ id, type: 'dialogue', text: trimLine });
      lastLineWasEmpty = false;
      return;
    }

    // TRANSITION: Ends in TO:
    if (trimLine.endsWith('TO:') && isUppercase) {
        result.push({ id, type: 'transition', text: trimLine });
        lastLineWasEmpty = false;
        return;
    }

    // ACTION: Default fallback
    result.push({ id, type: 'action', text: trimLine });
    lastLineWasEmpty = false;
  });

  return result;
};

/**
 * Extracts scenes from parsed lines for navigation.
 */
export const extractScenes = (lines: ScriptLine[]): ScriptScene[] => {
  const scenes: ScriptScene[] = [];
  let count = 1;

  lines.forEach((line, idx) => {
    if (line.type === 'scene') {
        // Mock AI Logline generation based on scene content (random for now)
        const mockLoglines = [
            "A tense confrontation reveals hidden loyalties.",
            "Quiet reflection before the storm.",
            "A chase sequence through crowded streets.",
            "An unexpected discovery changes everything.",
            "Bitter arguments over past mistakes."
        ];
        
        scenes.push({
            id: line.id,
            number: count++,
            header: line.text,
            lineIndex: idx,
            logline: mockLoglines[Math.floor(Math.random() * mockLoglines.length)],
            sentiment: (Math.random() * 2) - 1 // Random float between -1 and 1
        });
    }
  });

  return scenes;
};

/**
 * Extracts characters and generates mock profiles.
 */
export const extractCharacters = (lines: ScriptLine[]): ScriptCharacter[] => {
  const charMap = new Map<string, number>();

  lines.forEach(line => {
    if (line.type === 'character') {
        const name = line.text.trim();
        // Remove extensions like (V.O.) or (CONT'D)
        const cleanName = name.replace(/\s*\(.*\)$/, '');
        charMap.set(cleanName, (charMap.get(cleanName) || 0) + 1);
    }
  });

  const characters: ScriptCharacter[] = [];
  let colorIdx = 0;

  // Mock data for AI generation
  const motivations = ["Seek revenge", "Find true love", "Survive the night", "Protect the secret", "Gain power"];
  const tagsPool = ["Brave", "Cunning", "Loyal", "Reckless", "Stoic", "Funny", "Dark"];

  charMap.forEach((count, name) => {
      // Filter out noise
      if (count < 1 || name.length > 20) return;

      const seed = name.length;
      characters.push({
          id: `char-${name}`,
          name: name,
          dialogueCount: count,
          color: CHAR_COLORS[colorIdx % CHAR_COLORS.length],
          motivation: motivations[seed % motivations.length],
          tags: [tagsPool[seed % tagsPool.length], tagsPool[(seed + 1) % tagsPool.length]],
          bio: `An enigmatic figure essential to the plot. ${name} appears in ${count} scenes.`
      });
      colorIdx++;
  });

  return characters.sort((a, b) => b.dialogueCount - a.dialogueCount);
};

// V3.0 Feature: Mock Phase 1 Deep Analysis
export const generateStoryboardStructure = (scriptText: string): StoryboardData => {
  const lines = parseScript(scriptText);
  const baseCharacters = extractCharacters(lines);
  
  // 1. Generate Storyboard Characters
  const sbCharacters: StoryboardCharacter[] = baseCharacters.map(c => ({
    id: c.id,
    name: c.name,
    visualDescription: `Cinematic portrait of ${c.name}, ${c.tags.join(', ')} style, detailed face, movie character concept art, 8k resolution, photorealistic lighting.`,
  }));

  // 2. Generate Storyboard Scenes and Shots
  const sbScenes: StoryboardScene[] = [];
  let currentScene: StoryboardScene | null = null;
  let sceneShotCounter = 1;

  lines.forEach((line, idx) => {
    if (line.type === 'scene') {
      if (currentScene) {
        sbScenes.push(currentScene);
      }
      currentScene = {
        id: `sb-scene-${idx}`,
        number: sbScenes.length + 1,
        header: line.text,
        atmosphere: 'Cinematic, dramatic lighting, 8k, film grain',
        shots: []
      };
      sceneShotCounter = 1;
    } else if (line.type === 'action' && currentScene) {
      // Treat action lines as shots
      if (line.text.length > 10) { // Filter short noise
         currentScene.shots.push({
             id: `shot-${currentScene.id}-${sceneShotCounter++}`,
             text: line.text,
             promptPreFill: `Movie shot, ${currentScene.header}, ${line.text}`,
             characterIds: [] // AI would detect this in real backend
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
  I've got it! The missing piece!

He runs into traffic. Cars HONK.

INT. APARTMENT - NIGHT

Dark. Messy. papers everywhere.

             ALEX (V.O.)
  It wasn't just a story anymore. It was
  a warning.`;