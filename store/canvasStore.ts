
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  Connection, 
  Edge, 
  EdgeChange, 
  Node, 
  NodeChange, 
  addEdge, 
  OnNodesChange, 
  OnEdgesChange, 
  OnConnect, 
  applyNodeChanges, 
  applyEdgeChanges,
  updateEdge
} from 'reactflow';
import { createNanoBananaPro4KTask, createImageGenerationTask } from '../services/imageService';
import { createVideoTask, queryVideoTask } from '../services/soraService';
import { db } from '../services/dexieService';
import { GoogleGenAI, Type } from "@google/genai";
import { SoraModel, ImageModel } from '../types';

export type NodeType = 'llm' | 'image' | 'character' | 'video' | 'text';

export interface CanvasNodeData {
  label: string;
  type: NodeType;
  content?: string;
  imageUrl?: string;
  videoUrl?: string;
  result?: any;
  status?: 'idle' | 'busy' | 'done' | 'error' | 'queued';
  errorMessage?: string;
  progress?: number;
  config?: {
    aspectRatio: string;
    resolution: string;
    seed: number;
    characterRef?: string;
    orientation?: 'portrait' | 'landscape';
    duration?: string;
    isHD?: boolean;
    imageModel?: ImageModel;
    stylePrompt?: string; 
  };
  identityPrompt?: string; 
  apiId?: string;
}

interface CanvasSnapshot {
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
}

interface CanvasState {
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  hoveredEdgeId: string | null;
  
  // History State
  past: CanvasSnapshot[];
  future: CanvasSnapshot[];
  
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onEdgeUpdate: (oldEdge: Edge, newConnection: Connection) => void;
  addNode: (node: Node<CanvasNodeData>) => void;
  updateNodeData: (id: string, data: Partial<CanvasNodeData>) => void;
  setSelectedNodeId: (id: string | null) => void;
  setHoveredEdgeId: (id: string | null) => void;
  deleteNode: (id: string) => void;
  clearCanvas: () => void;
  autoLayout: () => void;
  setWorkflow: (nodes: Node<CanvasNodeData>[], edges: Edge[]) => void;
  processNode: (nodeId: string, channel: any, volcSettings: any) => Promise<void>;
  generateCharacterPack: (nodeId: string) => void;
  expandScriptNode: (nodeId: string) => Promise<void>;
  
  // History Actions
  takeSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const MAX_HISTORY = 30;

const mapToSoraId = (orientation: string, duration: string, isHD: boolean): SoraModel => {
  if (duration === '15s' && isHD) return orientation === 'portrait' ? SoraModel.SORA2_PRO_PORTRAIT_HD_15S : SoraModel.SORA2_PRO_LANDSCAPE_HD_15S;
  if (duration === '25s') return orientation === 'portrait' ? SoraModel.SORA2_PRO_PORTRAIT_25S : SoraModel.SORA2_PRO_LANDSCAPE_25S;
  if (duration === '15s') return orientation === 'portrait' ? SoraModel.SORA2_PORTRAIT_15S : SoraModel.SORA2_LANDSCAPE_15S;
  return orientation === 'portrait' ? SoraModel.SORA2_PORTRAIT : SoraModel.SORA2_LANDSCAPE;
};

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      hoveredEdgeId: null,
      past: [],
      future: [],

      canUndo: () => get().past.length > 0,
      canRedo: () => get().future.length > 0,

      takeSnapshot: () => {
        const { nodes, edges, past } = get();
        // [Logic]: Capture current state before an action is finalized.
        // Prevent storing redundant snapshots if nodes/edges haven't changed.
        const newSnapshot = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
        const updatedPast = [...past, newSnapshot].slice(-MAX_HISTORY);
        set({ past: updatedPast, future: [] });
      },

      undo: () => {
        const { past, future, nodes, edges } = get();
        if (past.length === 0) return;
        const previous = past[past.length - 1];
        const newPast = past.slice(0, past.length - 1);
        const current = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
        set({ 
          nodes: previous.nodes, 
          edges: previous.edges, 
          past: newPast, 
          future: [current, ...future].slice(0, MAX_HISTORY) 
        });
      },

      redo: () => {
        const { past, future, nodes, edges } = get();
        if (future.length === 0) return;
        const next = future[0];
        const newFuture = future.slice(1);
        const current = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
        set({ 
          nodes: next.nodes, 
          edges: next.edges, 
          past: [...past, current].slice(-MAX_HISTORY), 
          future: newFuture 
        });
      },

      onNodesChange: (changes: NodeChange[]) => {
        // [Logic]: Directly apply changes for smoothness. 
        // Discrete actions like 'remove' are handled via takeSnapshot separately or detected here.
        set({ nodes: applyNodeChanges(changes, get().nodes) });
      },

      onEdgesChange: (changes: EdgeChange[]) => {
        const hasRemoval = changes.some(c => c.type === 'remove');
        if (hasRemoval) get().takeSnapshot();
        set({ edges: applyEdgeChanges(changes, get().edges) });
      },

      setHoveredEdgeId: (id) => set({ hoveredEdgeId: id }),

      onConnect: (params: Connection) => {
        get().takeSnapshot();
        set((state) => {
          const sourceNode = state.nodes.find(n => n.id === params.source);
          const targetNode = state.nodes.find(n => n.id === params.target);

          let updatedNodes = [...state.nodes];
          if (sourceNode?.type === 'character' && (targetNode?.type === 'image' || targetNode?.type === 'video')) {
            updatedNodes = updatedNodes.map(n => 
              n.id === targetNode.id 
                ? { 
                    ...n, 
                    data: { 
                      ...n.data, 
                      config: { 
                        ...(n.data.config || { aspectRatio: '16:9', resolution: '1K', seed: 0 }), 
                        seed: sourceNode.data.config?.seed || 0,
                        characterRef: sourceNode.data.content
                      } 
                    } 
                  } 
                : n
            );
          }

          return {
            nodes: updatedNodes,
            edges: addEdge({ ...params, type: 'dismissible', animated: true }, state.edges)
          };
        });
      },

      onEdgeUpdate: (oldEdge, newConnection) => {
        get().takeSnapshot();
        set((state) => ({
          edges: updateEdge(oldEdge, newConnection, state.edges)
        }));
      },

      setSelectedNodeId: (id) => set({ selectedNodeId: id }),

      addNode: (node) => {
        get().takeSnapshot();
        set((state) => ({ nodes: [...state.nodes, node] }));
      },

      updateNodeData: (id, data) => set((state) => ({
        nodes: state.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n))
      })),

      deleteNode: (id) => {
        get().takeSnapshot();
        set({
          nodes: get().nodes.filter((n) => n.id !== id),
          edges: get().edges.filter((e) => e.source !== id && e.target !== id),
          selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId
        });
      },

      clearCanvas: () => {
        get().takeSnapshot();
        set({ nodes: [], edges: [], selectedNodeId: null });
      },

      autoLayout: () => {
        get().takeSnapshot();
        const { nodes } = get();
        const layoutNodes = nodes.map((node, index) => ({
          ...node,
          position: { x: (index % 4) * 450, y: Math.floor(index / 4) * 550 },
        }));
        set({ nodes: layoutNodes });
      },

      setWorkflow: (nodes, edges) => {
        get().takeSnapshot();
        set({ nodes, edges });
      },

      expandScriptNode: async (nodeId) => {
        const { nodes, updateNodeData, addNode, onConnect } = get();
        const scriptNode = nodes.find(n => n.id === nodeId);
        if (!scriptNode || !scriptNode.data.content) return;

        updateNodeData(nodeId, { status: 'busy', progress: 10 });
        get().takeSnapshot();

        try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const styleContext = scriptNode.data.config?.stylePrompt || 'Cinematic';

          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Break down this script for cinematic production. 
            Style Context: ${styleContext}. 
            Identify: 1. Main Characters. 2. Main Environments. 3. Storyboard Shots.
            For each shot, specify which characters and environments it contains.
            Script Content: ${scriptNode.data.content}`,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  characters: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: { id: { type: Type.STRING }, name: { type: Type.STRING }, description: { type: Type.STRING } },
                      required: ["id", "name"]
                    }
                  },
                  environments: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: { id: { type: Type.STRING }, name: { type: Type.STRING }, description: { type: Type.STRING } },
                      required: ["id", "name"]
                    }
                  },
                  shots: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        prompt: { type: Type.STRING },
                        refCharacterIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                        refEnvIds: { type: Type.ARRAY, items: { type: Type.STRING } }
                      },
                      required: ["id", "prompt"]
                    }
                  }
                }
              }
            }
          });

          const analysis = JSON.parse(response.text || '{}');
          const idMap: Record<string, string> = {};

          const styleNodeId = `style-${Date.now()}`;
          addNode({
            id: styleNodeId, type: 'text',
            position: { x: scriptNode.position.x + 450, y: scriptNode.position.y + 100 },
            data: { label: '文本提示词', type: 'text', content: styleContext, status: 'idle' }
          });
          onConnect({ source: nodeId, target: styleNodeId, sourceHandle: null, targetHandle: null });

          analysis.characters?.forEach((char: any, i: number) => {
            const newId = `char-${Date.now()}-${i}`;
            idMap[char.id] = newId;
            addNode({
              id: newId, type: 'character',
              position: { x: scriptNode.position.x + 450, y: scriptNode.position.y + (i * 350) - 400 },
              data: { label: char.name, type: 'character', content: char.name, status: 'idle' }
            });
            onConnect({ source: nodeId, target: newId, sourceHandle: null, targetHandle: null });
          });

          analysis.environments?.forEach((env: any, i: number) => {
            const newId = `env-${Date.now()}-${i}`;
            idMap[env.id] = newId;
            addNode({
              id: newId, type: 'image',
              position: { x: scriptNode.position.x + 950, y: scriptNode.position.y + (i * 350) - 200 },
              data: { label: env.name, type: 'image', content: `${env.description}`, status: 'idle', config: { aspectRatio: '16:9', resolution: '1K', seed: Math.floor(Math.random()*99999) } }
            });
            onConnect({ source: nodeId, target: newId, sourceHandle: null, targetHandle: null });
            onConnect({ source: styleNodeId, target: newId, sourceHandle: null, targetHandle: null });
          });

          analysis.shots?.forEach((shot: any, i: number) => {
            const newId = `shot-${Date.now()}-${i}`;
            addNode({
              id: newId, type: 'image',
              position: { x: scriptNode.position.x + 1450, y: scriptNode.position.y + (i * 450) },
              data: { label: `Shot ${i+1}`, type: 'image', content: `${shot.prompt}`, status: 'idle', config: { aspectRatio: '16:9', resolution: '1K', seed: Math.floor(Math.random()*99999) } }
            });
            shot.refCharacterIds?.forEach((cId: string) => { if (idMap[cId]) onConnect({ source: idMap[cId], target: newId, sourceHandle: null, targetHandle: null }); });
            shot.refEnvIds?.forEach((eId: string) => { if (idMap[eId]) onConnect({ source: idMap[eId], target: newId, sourceHandle: null, targetHandle: null }); });
            if (!shot.refCharacterIds?.length && !shot.refEnvIds?.length) { onConnect({ source: nodeId, target: newId, sourceHandle: null, targetHandle: null }); }
            onConnect({ source: styleNodeId, target: newId, sourceHandle: null, targetHandle: null });
          });

          updateNodeData(nodeId, { status: 'done' });
        } catch (e: any) {
          updateNodeData(nodeId, { status: 'error', errorMessage: e.message });
        }
      },

      processNode: async (nodeId, channel, volcSettings) => {
        const { nodes, edges, updateNodeData, expandScriptNode } = get();
        const node = nodes.find(n => n.id === nodeId);
        if (!node || node.data.status === 'busy' || node.type === 'text') return;

        if (node.type === 'llm') return expandScriptNode(nodeId);

        updateNodeData(nodeId, { status: 'busy', errorMessage: '', progress: 0 });

        try {
          const config = node.data.config || { aspectRatio: '1:1', resolution: '1K', seed: Math.floor(Math.random() * 9999999) };
          
          if (node.type === 'character') {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const aiRes = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: `Cinematic brief for: "${node.data.content}".`,
            });
            const results = await createNanoBananaPro4KTask(channel.baseUrl, channel.apiToken, `Portrait of ${aiRes.text}, cinematic`, [], { aspectRatio: '1:1', resolution: '1K' });
            await db.saveAsset(nodeId, 'image', results[0]);
            updateNodeData(nodeId, { status: 'done', imageUrl: results[0], identityPrompt: aiRes.text });

          } else if (node.type === 'image' || node.type === 'video') {
            const parentNodes = edges.filter(e => e.target === nodeId).map(e => nodes.find(n => n.id === e.source)).filter(Boolean);
            let combinedPrompt = node.data.content || "";
            let textSuffix = "";

            parentNodes.forEach(pn => { 
                if (pn?.type === 'character' && pn.data.identityPrompt) {
                    combinedPrompt = `Context: (${pn.data.identityPrompt}), ${combinedPrompt}`; 
                }
                if (pn?.type === 'text' && pn.data.content) {
                    textSuffix += `, ${pn.data.content}`;
                }
            });

            const finalPrompt = combinedPrompt + textSuffix;

            if (node.type === 'image') {
                const engine = config.imageModel || ImageModel.NANO_BANANA_2;
                if (engine === ImageModel.NANO_BANANA_PRO) {
                    const res = await createNanoBananaPro4KTask(channel.baseUrl, channel.apiToken, finalPrompt, [], { aspectRatio: config.aspectRatio, resolution: config.resolution });
                    await db.saveAsset(nodeId, 'image', res[0]);
                    updateNodeData(nodeId, { status: 'done', imageUrl: res[0] });
                } else {
                    const apiId = await createImageGenerationTask(channel.baseUrl, channel.apiToken, finalPrompt, engine, { aspectRatio: config.aspectRatio, resolution: config.resolution });
                    const poll = setInterval(async () => {
                        const res = await (await fetch(`${channel.baseUrl}/v1/images/tasks/${apiId}`, { headers: { 'Authorization': `Bearer ${channel.apiToken}` } })).json();
                        if (res.data?.status === 'success' || res.status === 'success') { clearInterval(poll); const url = res.data?.result_url || res.result_url; await db.saveAsset(nodeId, 'image', url); updateNodeData(nodeId, { status: 'done', imageUrl: url }); }
                    }, 3000);
                }
            } else {
                const modelId = mapToSoraId(config.orientation || 'landscape', config.duration || '15s', config.isHD || false);
                const apiId = await createVideoTask(channel.baseUrl, channel.apiToken, finalPrompt, modelId, { aspectRatio: config.orientation === 'portrait' ? '9:16' : '16:9' });
                const poll = setInterval(async () => {
                    const apiRes = await queryVideoTask(channel.baseUrl, channel.apiToken, apiId);
                    const isDone = apiRes.status === 'success' || !!apiRes.result_video_url;
                    updateNodeData(nodeId, { progress: isDone ? 100 : (apiRes.progress ? parseFloat(apiRes.progress) : 20), videoUrl: apiRes.result_video_url || node.data.videoUrl });
                    if (isDone) { clearInterval(poll); updateNodeData(nodeId, { status: 'done' }); }
                }, 5000);
            }
          }
        } catch (error: any) { updateNodeData(nodeId, { status: 'error', errorMessage: error.message }); }
      },

      generateCharacterPack: (nodeId) => {
        get().takeSnapshot();
        const { nodes, addNode, onConnect } = get();
        const sourceNode = nodes.find(n => n.id === nodeId);
        if (!sourceNode || sourceNode.type !== 'character') return;
        const variants = [
          { label: '特写', suffix: 'Close up detail', pos: { x: 450, y: -150 } },
          { label: '全身', suffix: 'Full body environment', pos: { x: 450, y: 150 } }
        ];
        variants.forEach(v => {
          const nid = `pack-${Date.now()}-${v.label}`;
          addNode({ id: nid, type: 'image', position: { x: sourceNode.position.x + v.pos.x, y: sourceNode.position.y + v.pos.y }, data: { label: v.label, type: 'image', content: v.suffix, status: 'idle' } });
          onConnect({ source: nodeId, target: nid, sourceHandle: null, targetHandle: null });
        });
      }
    }),
    {
      name: 'sora-canvas-v16',
      partialize: (state) => ({ nodes: state.nodes, edges: state.edges }),
    }
  )
);
