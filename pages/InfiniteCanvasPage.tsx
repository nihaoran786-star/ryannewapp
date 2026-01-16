import React, { useCallback, useRef, useState, useEffect, useMemo, memo } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  Handle, 
  Position, 
  ReactFlowProvider,
  useReactFlow,
  Panel,
  BaseEdge,
  getSmoothStepPath,
  EdgeLabelRenderer,
  OnConnectStart,
  OnConnectEnd
} from 'reactflow';
import { GoogleGenAI } from "@google/genai";
import { useCanvasStore, NodeType, CanvasNodeData } from '../store/canvasStore';
import { useGlobal, StylePreset } from '../context/GlobalContext';
import { db } from '../services/dexieService';
import { 
  ImageIcon, Trash2, Sparkles, Play, 
  LayoutGrid, X, BrainCircuit, Loader2, User, 
  Wand2, Settings2, Activity, ChevronRight,
  Boxes, Fingerprint, Link as LinkIcon, Hash, Plus, FileJson,
  Video, MonitorPlay, Smartphone, Ratio, Maximize2, Send,
  Monitor, Palette, Layers, Sparkle, Zap, ChevronDown, Check, Clock,
  Type as TypeIcon, StickyNote, Quote, Undo2, Redo2, MousePointer2, Scissors
} from 'lucide-react';
import { ImageModel, IMAGE_MODEL_OPTIONS } from '../types';

/**
 * [Context]: 自定义可解绑连线 - 符合 Apple 极简美学
 */
const DismissibleEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}: any) => {
  const { setEdges } = useReactFlow();
  const hoveredEdgeId = useCanvasStore(s => s.hoveredEdgeId);
  const takeSnapshot = useCanvasStore(s => s.takeSnapshot);
  const isHovered = hoveredEdgeId === id;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeRemove = useCallback((evt: React.MouseEvent) => {
    evt.stopPropagation();
    takeSnapshot();
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  }, [id, setEdges, takeSnapshot]);

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <button
            className={`w-7 h-7 bg-white/90 backdrop-blur-md border border-black/5 rounded-full flex items-center justify-center shadow-apple-card transition-all duration-500 hover:bg-red-500 hover:text-white hover:scale-110 active:scale-90 ${selected || isHovered ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-50 translate-y-2 pointer-events-none'}`}
            onClick={onEdgeRemove}
          >
            <X size={14} strokeWidth={3} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

/**
 * [Context]: 苹果风格节点包装器
 */
const NodeWrapper = memo(({ children, status, selected, type, nodeId, progress, label }: any) => {
  const isBusy = status === 'busy' || status === 'queued';
  const processNode = useCanvasStore(s => s.processNode);
  const hoveredEdgeId = useCanvasStore(s => s.hoveredEdgeId);
  const edges = useCanvasStore(s => s.edges);
  const { activeChannel, volcSettings, lang } = useGlobal();

  const isResonating = useMemo(() => {
    if (!hoveredEdgeId) return false;
    const edge = edges.find(e => e.id === hoveredEdgeId);
    return edge?.source === nodeId || edge?.target === nodeId;
  }, [hoveredEdgeId, edges, nodeId]);

  const getStatusText = useCallback(() => {
    if (lang === 'zh') {
        switch(status) {
            case 'busy': return '处理中';
            case 'done': return '就绪';
            case 'error': return '错误';
            default: return '待命中';
        }
    }
    return status || 'Idle';
  }, [lang, status]);

  const hideFooter = type === 'text';

  return (
    <div className={`relative transition-all duration-500 rounded-[32px] overflow-visible ${selected ? 'scale-[1.02] z-50' : 'scale-100'}`}>
      <Handle type="target" position={Position.Left} className="!bg-white !border-2 !border-[#007AFF] !w-4 !h-4 shadow-md hover:!scale-150 transition-transform" />
      <Handle type="source" position={Position.Right} className="!bg-white !border-2 !border-[#007AFF] !w-4 !h-4 shadow-md hover:!scale-150 transition-transform" />

      <div className={`absolute inset-0 rounded-[32px] transition-all duration-700 ${selected ? 'shadow-[0_40px_80px_rgba(0,0,0,0.1)]' : 'shadow-[0_10px_30px_rgba(0,0,0,0.03)]'}`} />
      
      <div className={`relative bg-white/90 border-[1.5px] rounded-[32px] overflow-hidden backdrop-blur-2xl transition-all duration-300 ${selected || isResonating ? 'border-[#007AFF]' : 'border-black/5'} ${isResonating ? 'node-resonance' : ''} ${type === 'character' ? 'border-indigo-400 ring-8 ring-indigo-50' : ''} ${type === 'video' ? 'border-orange-400 ring-8 ring-orange-50' : ''} ${type === 'text' ? 'border-emerald-400 ring-8 ring-emerald-50' : ''}`}>
        {isBusy && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100 z-20 overflow-hidden">
                <div className="h-full bg-[#007AFF] transition-all duration-500" style={{ width: `${progress || 30}%` }} />
            </div>
        )}
        
        <div className="px-6 pt-5 pb-0 flex items-center justify-between">
           <span className="text-[10px] font-black uppercase tracking-widest text-[#1D1D1F] truncate max-w-[200px]">{label || type.toUpperCase()}</span>
           <div className={`w-1.5 h-1.5 rounded-full ${type === 'text' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-[#007AFF]/20'}`} />
        </div>

        <div className="relative min-h-[100px]">{children}</div>

        {!hideFooter && (
            <div className="px-6 py-4 bg-gray-50/50 flex items-center justify-between border-t border-black/[0.03]">
               <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${status === 'done' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : status === 'error' ? 'bg-red-500' : 'bg-gray-300'}`} />
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono">{getStatusText()}</span>
               </div>
               <button onClick={(e) => { e.stopPropagation(); processNode(nodeId, activeChannel, volcSettings); }} disabled={isBusy} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg hover:scale-110 ${type === 'character' ? 'bg-indigo-500 text-white' : type === 'video' ? 'bg-orange-500 text-white' : type === 'llm' ? 'bg-purple-600 text-white' : 'bg-[#007AFF] text-white'}`}>
                 {isBusy ? <Activity size={16} className="animate-pulse" /> : (type === 'llm' ? <Zap size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />)}
               </button>
            </div>
        )}
      </div>
    </div>
  );
});

/**
 * [Helper]: 用于在下游节点中提取并显示父级文本提示词
 */
const InheritedPromptHint = ({ nodeId }: { nodeId: string }) => {
    const nodes = useCanvasStore(s => s.nodes);
    const edges = useCanvasStore(s => s.edges);
    const { lang } = useGlobal();

    const inheritedContent = useMemo(() => {
        const parentIds = edges.filter(e => e.target === nodeId).map(e => e.source);
        return nodes
            .filter(n => parentIds.includes(n.id) && n.type === 'text')
            .map(n => n.data.content)
            .filter(Boolean)
            .join(', ');
    }, [nodes, edges, nodeId]);

    if (!inheritedContent) return null;

    return (
        <div className="mt-3 bg-emerald-50/40 border border-emerald-100/50 rounded-xl p-3 animate-in slide-in-from-top-1">
            <div className="flex items-center gap-2 mb-1.5 opacity-40">
                <Quote size={8} className="text-emerald-600" />
                <span className="text-[7px] font-black uppercase text-emerald-700 tracking-widest">{lang === 'zh' ? '继承后缀' : 'Inherited Suffix'}</span>
            </div>
            <p className="text-[9px] text-emerald-800 font-bold leading-relaxed italic line-clamp-2">
                {inheritedContent}
            </p>
        </div>
    );
};

/**
 * 剧本分析节点
 */
const ScriptAnalysisNode = memo(({ id, data, selected }: any) => {
  const { lang } = useGlobal();
  const [localContent, setLocalContent] = useState(data.content || '');
  const updateNodeData = useCanvasStore(s => s.updateNodeData);
  useEffect(() => { setLocalContent(data.content || ''); }, [data.content]);

  return (
    <NodeWrapper nodeId={id} status={data.status} selected={selected} type="llm" label={data.label}>
      <div className="w-[340px] px-6 pb-6 pt-2">
        <div className="flex items-center gap-3 text-purple-500 mb-6">
            <div className="w-10 h-10 rounded-[18px] bg-purple-50 flex items-center justify-center border border-purple-100 shadow-sm"><BrainCircuit size={20} /></div>
            <span className="text-[11px] font-black uppercase tracking-widest">{lang === 'zh' ? '剧本解析引擎' : 'Script Loom'}</span>
        </div>
        <textarea className="w-full bg-gray-50 border border-black/5 rounded-2xl p-5 text-[11px] text-[#1D1D1F] font-bold leading-relaxed outline-none min-h-[160px] focus:ring-2 focus:ring-purple-100 transition-all" placeholder={lang === 'zh' ? '粘贴剧本分析视觉属性...' : "Paste script content..."} value={localContent} onChange={(e) => setLocalContent(e.target.value)} onBlur={() => updateNodeData(id, { content: localContent })} />
      </div>
    </NodeWrapper>
  );
});

/**
 * 文本提示词节点 (Prompt Bridge)
 */
const TextBridgeNode = memo(({ id, data, selected }: any) => {
  const { lang } = useGlobal();
  const [localContent, setLocalContent] = useState(data.content || '');
  const updateNodeData = useCanvasStore(s => s.updateNodeData);
  useEffect(() => { setLocalContent(data.content || ''); }, [data.content]);

  return (
    <NodeWrapper nodeId={id} status={data.status} selected={selected} type="text" label={data.label}>
      <div className="w-[280px] px-6 pb-6 pt-2">
        <div className="flex items-center gap-3 text-emerald-500 mb-4">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100 shadow-sm"><TypeIcon size={16} /></div>
            <span className="text-[10px] font-black uppercase tracking-widest">{lang === 'zh' ? '文本提示词' : 'Text Prompt'}</span>
        </div>
        <textarea className="w-full bg-emerald-50/30 border border-emerald-100 rounded-2xl p-4 text-[10px] text-emerald-800 font-bold outline-none min-h-[100px] focus:ring-2 focus:ring-emerald-100 transition-all italic shadow-inner" placeholder={lang === 'zh' ? '输入全局提示词后缀...' : "Global prompt suffix..."} value={localContent} onChange={(e) => setLocalContent(e.target.value)} onBlur={() => updateNodeData(id, { content: localContent })} />
        <div className="mt-3 flex items-center gap-2">
            <LinkIcon size={10} className="text-emerald-400" />
            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Auto-Injected to downstream</span>
        </div>
      </div>
    </NodeWrapper>
  );
});

/**
 * Sora 视频节点
 */
const SoraVideoNode = memo(({ id, data, selected }: any) => {
  const updateNodeData = useCanvasStore(s => s.updateNodeData);
  const { lang } = useGlobal();
  const [localContent, setLocalContent] = useState(data.content || '');
  useEffect(() => { setLocalContent(data.content || ''); }, [data.content]);

  return (
    <NodeWrapper nodeId={id} status={data.status} selected={selected} type="video" progress={data.progress} label={data.label}>
      <div className="w-[380px]">
        <div className="relative aspect-video bg-gradient-to-br from-indigo-900 via-slate-900 to-black overflow-hidden border-b border-black/5 shadow-inner">
           {data.videoUrl ? (
             <video src={data.videoUrl} controls className="w-full h-full object-contain" />
           ) : (
             <div className="w-full h-full flex flex-col items-center justify-center text-white/10 group-hover:text-white/20 transition-colors">
                <div className="relative"><Video size={56} strokeWidth={1} /><div className="absolute inset-0 blur-2xl bg-indigo-500/20 rounded-full" /></div>
                <span className="mt-4 text-[8px] font-black uppercase tracking-[0.4em] opacity-40">Awaiting Cinematic Flux</span>
             </div>
           )}
           <div className="absolute top-4 left-4"><div className="bg-orange-500/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg ring-1 ring-white/20"><MonitorPlay size={10} /> SORA 2.0</div></div>
        </div>
        <div className="p-6">
           <textarea className="w-full bg-gray-50 border border-black/5 rounded-2xl p-4 text-[11px] text-[#1D1D1F] font-bold outline-none min-h-[80px] focus:ring-2 focus:ring-orange-100 transition-all" placeholder={lang === 'zh' ? '描述视频场景...' : "Describe scene..."} value={localContent} onChange={(e) => setLocalContent(e.target.value)} onBlur={() => updateNodeData(id, { content: localContent })} />
           
           <InheritedPromptHint nodeId={id} />

           <div className="mt-3 flex items-center gap-2">
                <div className="px-2 py-0.5 rounded-md bg-orange-50 border border-orange-100 text-[8px] font-black text-orange-400 uppercase tracking-widest">{data.config?.orientation || 'LANDSCAPE'}</div>
                <div className="px-2 py-0.5 rounded-md bg-gray-100 text-[8px] font-black text-gray-400 uppercase tracking-widest">{data.config?.duration || '15S'}</div>
           </div>
        </div>
      </div>
    </NodeWrapper>
  );
});

/**
 * 角色节点
 */
const CharacterNode = memo(({ id, data, selected }: any) => {
  const updateNodeData = useCanvasStore(s => s.updateNodeData);
  const { lang } = useGlobal();
  const [localContent, setLocalContent] = useState(data.content || '');
  const [localImage, setLocalImage] = useState<string | null>(data.imageUrl || null);
  useEffect(() => { setLocalContent(data.content || ''); }, [data.content]);
  useEffect(() => { if (!data.imageUrl) { db.getAsset(id).then(asset => asset && setLocalImage(asset.data)); } else { setLocalImage(data.imageUrl); } }, [data.imageUrl, id]);

  return (
    <NodeWrapper nodeId={id} status={data.status} selected={selected} type="character" label={data.label}>
      <div className="w-[280px] px-6 pb-6 pt-2">
        <div className="flex items-center gap-3 text-indigo-500 mb-6"><div className="w-10 h-10 rounded-[18px] bg-indigo-50 flex items-center justify-center border border-indigo-100"><Fingerprint size={20} /></div><span className="text-[11px] font-black uppercase tracking-widest">{lang === 'zh' ? '角色指纹库' : 'Identity Hub'}</span></div>
        <div className="aspect-square bg-gray-50 rounded-[32px] overflow-hidden border border-black/5">{localImage ? <img src={localImage} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-indigo-100"><User size={64} strokeWidth={1}/></div>}</div>
        <input className="w-full mt-6 bg-gray-50 border border-black/5 rounded-2xl px-5 py-4 text-xs font-black text-[#1D1D1F] outline-none text-center" placeholder={lang === 'zh' ? '角色代号...' : "ID..."} value={localContent} onChange={(e) => setLocalContent(e.target.value)} onBlur={() => updateNodeData(id, { content: localContent })} />
      </div>
    </NodeWrapper>
  );
});

/**
 * 渲染节点
 */
const AutoImageNode = memo(({ id, data, selected }: any) => {
  const updateNodeData = useCanvasStore(s => s.updateNodeData);
  const { lang } = useGlobal();
  const [localContent, setLocalContent] = useState(data.content || '');
  const [localImage, setLocalImage] = useState<string | null>(data.imageUrl || null);
  useEffect(() => { setLocalContent(data.content || ''); }, [data.content]);
  useEffect(() => { if (!data.imageUrl) { db.getAsset(id).then(asset => asset && setLocalImage(asset.data)); } else { setLocalImage(data.imageUrl); } }, [data.imageUrl, id]);

  return (
    <NodeWrapper nodeId={id} status={data.status} selected={selected} type="image" label={data.label}>
      <div className="w-[360px]">
        <div className="aspect-video relative bg-gray-50 border-b border-black/5 overflow-hidden">{localImage ? <img src={localImage} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center text-gray-200"><ImageIcon size={56} strokeWidth={1} /></div>}</div>
        <div className="p-6">
            <textarea className="w-full bg-gray-50 border border-black/5 rounded-2xl p-4 text-[11px] text-gray-700 font-bold outline-none min-h-[80px] focus:ring-2 focus:ring-blue-100 shadow-inner" placeholder={lang === 'zh' ? '渲染微调指令...' : "Render directives..."} value={localContent} onChange={(e) => setLocalContent(e.target.value)} onBlur={() => updateNodeData(id, { content: localContent })} />
            <InheritedPromptHint nodeId={id} />
        </div>
      </div>
    </NodeWrapper>
  );
});

/**
 * 属性面板
 */
const PropertyInspector = memo(({ nodeId }: { nodeId: string | null }) => {
  const node = useCanvasStore(useCallback(s => s.nodes.find(n => n.id === nodeId), [nodeId]));
  const updateNodeData = useCanvasStore(s => s.updateNodeData);
  const generateCharacterPack = useCanvasStore(s => s.generateCharacterPack);
  const deleteNode = useCanvasStore(s => s.deleteNode);
  const { lang, stylePresets, addStylePreset, deleteStylePreset, t } = useGlobal();

  const [isStyleFormOpen, setIsStyleFormOpen] = useState(false);
  const [newStyleName, setNewStyleName] = useState('');
  const [newStylePrompt, setNewStylePrompt] = useState('');

  if (!node) return null;
  const currentStylePrompt = node.data.config?.stylePrompt || '';

  const handleAddNewStyle = () => {
    if (!newStyleName || !newStylePrompt) return;
    addStylePreset(newStyleName, newStylePrompt);
    updateNodeData(node.id, { config: { ...(node.data.config || {}), stylePrompt: newStylePrompt } as any });
    setNewStyleName(''); setNewStylePrompt(''); setIsStyleFormOpen(false);
  };

  const SORA_CONFIGS = [
    { label: '10s 标准', value: '10s', isHD: false },
    { label: '15s 标准', value: '15s', isHD: false },
    { label: '15s 高清 Pro', value: '15s', isHD: true },
    { label: '25s 电影级', value: '25s', isHD: false },
  ];

  return (
    <div className="absolute right-8 top-32 w-80 bg-white/95 backdrop-blur-3xl border border-black/5 rounded-[40px] p-8 shadow-apple-card z-[110] animate-in slide-in-from-right-8 duration-500 max-h-[70vh] overflow-y-auto no-scrollbar">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{lang === 'zh' ? '节点属性' : 'Node Inspector'}</h3>
        <button onClick={() => deleteNode(node.id)} className="p-2.5 text-gray-300 hover:text-red-500 transition-colors hover:bg-red-50 rounded-full"><Trash2 size={18} /></button>
      </div>
      
      <div className="space-y-10">
        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{lang === 'zh' ? '节点标识' : 'Label'}</label>
          <input value={node.data.label} onChange={(e) => updateNodeData(node.id, { label: e.target.value })} className="w-full bg-gray-50 border border-black/5 rounded-2xl px-5 py-4 text-xs font-black outline-none focus:ring-2 focus:ring-blue-100 transition-all" />
        </div>

        {node.type === 'video' && (
          <div className="space-y-6">
             <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{lang === 'zh' ? '画面比例与方向' : 'Aspect & Orientation'}</label>
                <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
                    <button onClick={() => updateNodeData(node.id, { config: { ...(node.data.config || {}), orientation: 'landscape', aspectRatio: '16:9' } as any })} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${node.data.config?.orientation === 'landscape' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-400'}`}><Monitor size={14} /> <span className="text-[10px] font-black uppercase">Landscape</span></button>
                    <button onClick={() => updateNodeData(node.id, { config: { ...(node.data.config || {}), orientation: 'portrait', aspectRatio: '9:16' } as any })} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${node.data.config?.orientation === 'portrait' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-400'}`}><Smartphone size={14} /> <span className="text-[10px] font-black uppercase">Portrait</span></button>
                </div>
             </div>
             <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{lang === 'zh' ? '生成档位' : 'Duration Gear'}</label>
                <div className="grid grid-cols-1 gap-2">
                    {SORA_CONFIGS.map((cfg, i) => (
                        <button key={i} onClick={() => updateNodeData(node.id, { config: { ...(node.data.config || {}), duration: cfg.value, isHD: cfg.isHD } as any })} className={`px-5 py-4 rounded-2xl border text-left flex items-center justify-between transition-all ${node.data.config?.duration === cfg.value && node.data.config?.isHD === cfg.isHD ? 'border-orange-500 bg-orange-50' : 'border-gray-100 hover:border-gray-200'}`}><span className="text-[10px] font-black uppercase tracking-widest">{cfg.label}</span>{cfg.isHD && <Sparkle size={12} className="text-orange-500" />}</button>
                    ))}
                </div>
             </div>
          </div>
        )}

        {node.type === 'image' && (
           <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{lang === 'zh' ? '画面比例' : 'Aspect Ratio'}</label>
                <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 rounded-2xl">
                    {['1:1', '16:9', '9:16'].map(ratio => (<button key={ratio} onClick={() => updateNodeData(node.id, { config: { ...(node.data.config || {}), aspectRatio: ratio } as any })} className={`py-3 rounded-xl text-[10px] font-black transition-all ${node.data.config?.aspectRatio === ratio ? 'bg-white text-[#007AFF] shadow-sm' : 'text-gray-400'}`}>{ratio}</button>))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{lang === 'zh' ? '渲染引擎' : 'Render Engine'}</label>
                <select value={node.data.config?.imageModel} onChange={e => updateNodeData(node.id, { config: { ...(node.data.config || {}), imageModel: e.target.value as ImageModel } as any })} className="w-full bg-gray-50 border border-black/5 rounded-2xl px-5 py-4 text-xs font-black appearance-none outline-none shadow-sm">
                  {IMAGE_MODEL_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
           </div>
        )}

        {node.type === 'llm' && (
          <div className="space-y-4">
              <div className="flex items-center justify-between px-1"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{lang === 'zh' ? '剧本全局风格' : 'Script Master Style'}</label><button onClick={() => setIsStyleFormOpen(!isStyleFormOpen)} className="p-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-600 hover:text-white transition-all shadow-sm"><Plus size={14}/></button></div>
              {isStyleFormOpen && (
                  <div className="p-5 bg-gray-50 rounded-2xl space-y-3 border border-black/5 animate-in zoom-in-95">
                      <input value={newStyleName} onChange={e => setNewStyleName(e.target.value)} placeholder="风格名称..." className="w-full bg-white px-4 py-2 rounded-xl text-[10px] font-bold outline-none border border-black/5" />
                      <textarea value={newStylePrompt} onChange={e => setNewStylePrompt(e.target.value)} placeholder="提示词后缀..." className="w-full bg-white px-4 py-2 rounded-xl text-[10px] font-medium outline-none min-h-[60px] border border-black/5" />
                      <button onClick={handleAddNewStyle} className="w-full py-2 bg-purple-600 text-white rounded-xl text-[10px] font-black">保存风格</button>
                  </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {stylePresets.map(style => (
                    <div key={style.id} onClick={() => updateNodeData(node.id, { config: { ...(node.data.config || {}), stylePrompt: style.prompt } as any })} className={`group relative p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1 ${currentStylePrompt === style.prompt ? 'border-purple-500 bg-purple-50' : 'border-gray-100 hover:border-gray-200'}`}><span className="text-[9px] font-black uppercase truncate">{style.isCustom ? style.customName : t(style.nameKey)}</span>{currentStylePrompt === style.prompt && <Check size={10} className="absolute top-2 right-2 text-purple-500" />}{style.isCustom && (<button onClick={(e) => { e.stopPropagation(); deleteStylePreset(style.id); }} className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={10} className="text-red-300" /></button>)}</div>
                ))}
              </div>
          </div>
        )}

        {node.type === 'character' && (
          <button onClick={() => generateCharacterPack(node.id)} className="w-full py-5 bg-indigo-500 text-white rounded-[22px] text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-indigo-600 active:scale-95 transition-all"><Boxes size={18} /> {lang === 'zh' ? '生成角色扩展包' : 'Generate Pack'}</button>
        )}
      </div>
    </div>
  );
});

const NODE_TYPES = { llm: ScriptAnalysisNode, image: AutoImageNode, character: CharacterNode, video: SoraVideoNode, text: TextBridgeNode };
const EDGE_TYPES = { dismissible: DismissibleEdge };

/**
 * [Context]: 历史记录控制面板
 */
const HistoryControls = memo(() => {
    const undo = useCanvasStore(s => s.undo);
    const redo = useCanvasStore(s => s.redo);
    const canUndo = useCanvasStore(s => s.canUndo());
    const canRedo = useCanvasStore(s => s.canRedo());

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMod = e.metaKey || e.ctrlKey;
            if (isMod && e.key === 'z') {
                if (e.shiftKey) redo(); else undo();
            } else if (isMod && e.key === 'y') {
                redo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    return (
        <div className="flex bg-white/80 backdrop-blur-xl border border-black/5 rounded-full p-1.5 shadow-2xl items-center gap-1">
            <button 
                onClick={undo} 
                disabled={!canUndo}
                className={`p-2.5 rounded-full transition-all ${canUndo ? 'text-[#1D1D1F] hover:bg-black/5 hover:scale-110 active:scale-90' : 'text-gray-200'}`}
                title="Undo (Cmd+Z)"
            >
                <Undo2 size={18} strokeWidth={2.5} />
            </button>
            <div className="w-px h-4 bg-black/5" />
            <button 
                onClick={redo} 
                disabled={!canRedo}
                className={`p-2.5 rounded-full transition-all ${canRedo ? 'text-[#1D1D1F] hover:bg-black/5 hover:scale-110 active:scale-90' : 'text-gray-200'}`}
                title="Redo (Cmd+Shift+Z)"
            >
                <Redo2 size={18} strokeWidth={2.5} />
            </button>
        </div>
    );
});

/**
 * [Context]: 快速添加菜单 - 当用户拖拽线头到空白处松开时显示
 */
const QuickAddMenu = ({ position, onSelect, onClose }: { position: { x: number, y: number }, onSelect: (type: NodeType) => void, onClose: () => void }) => {
    const { lang } = useGlobal();
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const clickOutside = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose(); };
        document.addEventListener('mousedown', clickOutside);
        return () => document.removeEventListener('mousedown', clickOutside);
    }, [onClose]);

    const items = [
        { type: 'video' as NodeType, icon: <Video size={14}/>, label: lang === 'zh' ? 'SORA 视频' : 'Sora Video', color: 'text-orange-500', bg: 'bg-orange-50' },
        { type: 'image' as NodeType, icon: <ImageIcon size={14}/>, label: lang === 'zh' ? '视觉渲染' : 'Neural Render', color: 'text-blue-500', bg: 'bg-blue-50' },
        { type: 'character' as NodeType, icon: <Fingerprint size={14}/>, label: lang === 'zh' ? '角色指纹' : 'Identity Hub', color: 'text-indigo-500', bg: 'bg-indigo-50' },
        { type: 'text' as NodeType, icon: <TypeIcon size={14}/>, label: lang === 'zh' ? '文本提示' : 'Text Prompt', color: 'text-emerald-500', bg: 'bg-emerald-50' },
    ];

    return (
        <div 
            ref={menuRef}
            className="fixed z-[200] bg-white/80 backdrop-blur-2xl border border-black/5 rounded-[32px] p-2 shadow-[0_30px_60px_rgba(0,0,0,0.15)] animate-in zoom-in-95 fade-in duration-200 ring-1 ring-black/5"
            style={{ top: position.y, left: position.x }}
        >
            <div className="flex flex-col gap-1 w-44">
                {items.map(item => (
                    <button 
                        key={item.type}
                        onClick={() => { onSelect(item.type); onClose(); }}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-black/5 transition-all group"
                    >
                        <div className={`w-8 h-8 rounded-xl ${item.bg} ${item.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>{item.icon}</div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-700">{item.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

/**
 * 画布主容器
 */
const CanvasInner = () => {
  const [orchestratorInput, setOrchestratorInput] = useState('');
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{x: number, y: number} | null>(null);
  
  // [Logic]: 跟踪连接拖拽状态
  const lastConnectStart = useRef<any>(null);

  const { screenToFlowPosition, setEdges } = useReactFlow();
  
  const nodes = useCanvasStore(s => s.nodes);
  const edges = useCanvasStore(s => s.edges);
  const onNodesChange = useCanvasStore(s => s.onNodesChange);
  const onEdgesChange = useCanvasStore(s => s.onEdgesChange);
  const onEdgeUpdate = useCanvasStore(s => s.onEdgeUpdate);
  const onConnect = useCanvasStore(s => s.onConnect);
  const addNode = useCanvasStore(s => s.addNode);
  const clearCanvas = useCanvasStore(s => s.clearCanvas);
  const autoLayout = useCanvasStore(s => s.autoLayout);
  const setWorkflow = useCanvasStore(s => s.setWorkflow);
  const selectedNodeId = useCanvasStore(s => s.selectedNodeId);
  const setSelectedNodeId = useCanvasStore(s => s.setSelectedNodeId);
  const setHoveredEdgeId = useCanvasStore(s => s.setHoveredEdgeId);
  const takeSnapshot = useCanvasStore(s => s.takeSnapshot);

  const { lang } = useGlobal();
  const { fitView } = useReactFlow();

  // [Helper]: 兼容鼠标和触摸事件的坐标提取
  const getEventCoords = (event: MouseEvent | TouchEvent) => {
    if ('changedTouches' in event && event.changedTouches.length > 0) {
        return { clientX: event.changedTouches[0].clientX, clientY: event.changedTouches[0].clientY };
    }
    const mouseEvent = event as MouseEvent;
    return { clientX: mouseEvent.clientX, clientY: mouseEvent.clientY };
  };

  /**
   * [Context]: 全局 MouseUp 判定逻辑
   * [Logic]: 监听全局释放事件。如果此时正在拖拽连接线，且释放点在“非节点/非手柄”区域，则弹出菜单。
   */
  useEffect(() => {
    const handleGlobalMouseUp = (event: MouseEvent | TouchEvent) => {
        if (!lastConnectStart.current) return;

        const coords = getEventCoords(event);
        const target = document.elementFromPoint(coords.clientX, coords.clientY) as Element;

        // [Robust Check]: 排除节点和手柄干扰，判定是否在空白处释放
        const isNode = target?.closest('.react-flow__node');
        const isHandle = target?.closest('.react-flow__handle');

        if (!isNode && !isHandle) {
            setMenuPosition({ x: coords.clientX, y: coords.clientY });
        } else {
            // 如果落在节点上，由 React Flow 的 onConnect 处理，此处仅清理状态
            lastConnectStart.current = null;
        }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);
    return () => {
        window.removeEventListener('mouseup', handleGlobalMouseUp);
        window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, []);

  const handleOrchestrate = async () => {
    if (!orchestratorInput.trim() || isOrchestrating) return;
    setIsOrchestrating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Architect a Sora Workflow for: "${orchestratorInput}". Output JSON ONLY: { "nodes": [...], "edges": [...] }. Node types: llm, image, character, video, text.`,
        config: { responseMimeType: "application/json" }
      });
      const result = JSON.parse(response.text || '{}');
      const stabilizedNodes = (result.nodes || []).map((n: any, idx: number) => ({
          ...n,
          position: n.position || { x: idx * 450, y: 100 },
          data: { ...n.data, status: 'idle', config: n.data.config || { aspectRatio: '16:9', resolution: '1K', seed: Math.floor(Math.random()*999999), orientation: 'landscape' } }
      }));
      setWorkflow(stabilizedNodes, result.edges || []);
      setOrchestratorInput('');
      setTimeout(() => fitView({ duration: 1200 }), 500);
    } catch (e) { console.error(e); } finally { setIsOrchestrating(false); }
  };

  const addManualNode = useCallback((type: NodeType, position?: {x: number, y: number}) => {
      const id = `${type}-${Date.now()}`;
      const finalPos = position || { x: window.innerWidth / 3, y: window.innerHeight / 3 };
      
      addNode({
          id, type, position: finalPos,
          data: { 
            label: type === 'character' ? '角色库' : type === 'image' ? '渲染平面' : type === 'video' ? 'Sora 视频' : type === 'text' ? '文本提示词' : '剧本引擎', 
            type, content: '', status: 'idle', 
            config: { aspectRatio: '16:9', resolution: '1K', seed: Math.floor(Math.random()*999999), orientation: 'landscape', imageModel: ImageModel.NANO_BANANA_PRO } 
          }
      });
      return id;
  }, [addNode]);

  // [Logic]: 记录连接起始点
  const onConnectStart: OnConnectStart = useCallback((event, params) => {
    lastConnectStart.current = params;
  }, []);

  // [Logic]: 成功连接时清理状态
  const handleConnect = useCallback((params: any) => {
    lastConnectStart.current = null; // 清理状态，防止 mouseup 逻辑触发菜单
    onConnect(params);
  }, [onConnect]);

  const handleQuickAdd = useCallback((type: NodeType) => {
    if (!menuPosition || !lastConnectStart.current) return;
    
    const flowPos = screenToFlowPosition({ x: menuPosition.x, y: menuPosition.y });
    const newNodeId = addManualNode(type, flowPos);
    
    // [Logic]: 创建连接
    handleConnect({
        source: lastConnectStart.current.nodeId,
        sourceHandle: lastConnectStart.current.handleId,
        target: newNodeId,
        targetHandle: null
    });

    setMenuPosition(null);
  }, [menuPosition, addManualNode, handleConnect, screenToFlowPosition]);

  // [Logic]: 处理连线更新结束 (核心的全域解绑逻辑)
  const onEdgeUpdateEnd = useCallback((event: any, edge: any) => {
    // [Logic]: 使用 closest 判定提高容错率
    const target = event.target as Element;
    const isOverHandle = !!target.closest('.react-flow__handle');
    
    if (!isOverHandle) {
      takeSnapshot();
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    }
  }, [setEdges, takeSnapshot]);

  return (
    <div className="flex h-full w-full bg-[#F5F5F7] relative overflow-hidden font-sans">
      <Panel position="top-center" className="z-[100] mt-10 w-full max-w-2xl px-4">
          <div className="relative bg-white/80 backdrop-blur-2xl border border-black/5 rounded-[40px] p-2.5 flex items-center shadow-2xl ring-1 ring-black/5">
             <div className="pl-6 text-[#007AFF]"><Wand2 size={24} className={isOrchestrating ? 'animate-spin' : ''} /></div>
             <input value={orchestratorInput} onChange={(e) => setOrchestratorInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleOrchestrate()} placeholder={lang === 'zh' ? '构建宏观叙事蓝图...' : "Architect cinematic blueprint..."} className="flex-1 bg-transparent border-none text-[#1D1D1F] text-sm font-bold px-5 py-4 outline-none placeholder:text-gray-300" />
             <button onClick={handleOrchestrate} disabled={isOrchestrating || !orchestratorInput.trim()} className="bg-[#007AFF] text-white px-8 py-4 rounded-[28px] text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 disabled:opacity-20 transition-all flex items-center gap-2 shadow-xl shadow-blue-500/20">{isOrchestrating ? '...' : <Send size={18} />}</button>
          </div>
      </Panel>

      <PropertyInspector nodeId={selectedNodeId} />

      {/* 快速添加菜单浮窗 */}
      {menuPosition && (
          <QuickAddMenu 
            position={menuPosition} 
            onSelect={handleQuickAdd} 
            onClose={() => { setMenuPosition(null); lastConnectStart.current = null; }} 
          />
      )}

      <aside className="w-[320px] border-r border-black/5 bg-white/70 backdrop-blur-3xl z-30 flex flex-col p-10 shrink-0">
        <div className="flex items-center gap-4 mb-16"><div className="p-3.5 bg-indigo-600 rounded-[20px] text-white shadow-2xl"><BrainCircuit size={28} /></div><div><h2 className="text-xl font-black text-[#1D1D1F] uppercase tracking-tight">Architect</h2><span className="text-indigo-500 text-[9px] font-black uppercase tracking-[0.2em]">Flow Engine V14</span></div></div>
        <div className="space-y-4 flex-1 overflow-y-auto no-scrollbar">
           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{lang === 'zh' ? '原子资产' : 'Atomic Nodes'}</label>
           <button onClick={() => addManualNode('llm')} className="w-full p-6 bg-purple-50 border border-purple-100 rounded-[28px] text-[11px] font-black text-purple-600 hover:bg-purple-500 hover:text-white transition-all flex items-center gap-4 group shadow-sm"><BrainCircuit size={20} /> {lang === 'zh' ? '剧本引擎节点' : 'Loom Master'}</button>
           <button onClick={() => addManualNode('video')} className="w-full p-6 bg-orange-50 border border-orange-100 rounded-[28px] text-[11px] font-black text-orange-600 hover:bg-orange-500 hover:text-white transition-all flex items-center gap-4 group shadow-sm"><Video size={20} /> {lang === 'zh' ? 'SORA 视频节点' : 'Sora Video'}</button>
           <button onClick={() => addManualNode('character')} className="w-full p-6 bg-indigo-50 border border-indigo-100 rounded-[28px] text-[11px] font-black text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all flex items-center gap-4 group shadow-sm"><Fingerprint size={20} /> {lang === 'zh' ? '角色指纹节点' : 'Identity Node'}</button>
           <button onClick={() => addManualNode('image')} className="w-full p-6 bg-blue-50 border border-blue-100 rounded-[28px] text-[11px] font-black text-blue-500 hover:bg-blue-500 hover:text-white transition-all flex items-center gap-4 group shadow-sm"><ImageIcon size={20} /> {lang === 'zh' ? '视觉渲染节点' : 'Neural Render'}</button>
           <button onClick={() => addManualNode('text')} className="w-full p-6 bg-emerald-50 border border-emerald-100 rounded-[28px] text-[11px] font-black text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-4 group shadow-sm"><TypeIcon size={20} /> {lang === 'zh' ? '文本提示词' : 'Text Prompt'}</button>
           <div className="h-px bg-black/5 my-6" /><button onClick={() => clearCanvas()} className="w-full p-4 bg-red-50 border border-red-100 rounded-2xl text-[10px] font-black text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-3"><Trash2 size={16} /> {lang === 'zh' ? '清空所有' : 'Purge All'}</button>
        </div>
        <button onClick={autoLayout} className="w-full py-5 bg-[#1D1D1F] text-white rounded-[28px] text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl hover:bg-black transition-all mt-6"><LayoutGrid size={20}/> {lang === 'zh' ? '网格对齐' : 'Align Assets'}</button>
      </aside>

      <div className="flex-1 h-full relative">
        <ReactFlow 
            nodes={nodes} 
            edges={edges} 
            onNodesChange={onNodesChange} 
            onEdgesChange={onEdgesChange} 
            onConnect={handleConnect} 
            onEdgeUpdate={onEdgeUpdate} 
            onEdgeUpdateEnd={onEdgeUpdateEnd}
            onConnectStart={onConnectStart}
            nodeTypes={NODE_TYPES} 
            edgeTypes={EDGE_TYPES}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)} 
            onPaneClick={() => { setSelectedNodeId(null); setMenuPosition(null); }} 
            onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)} 
            onEdgeMouseLeave={() => setHoveredEdgeId(null)} 
            onNodeDragStop={() => takeSnapshot()}
            onSelectionDragStop={() => takeSnapshot()}
            fitView 
            snapToGrid 
            snapGrid={[20, 20]} 
            edgesUpdatable={true} 
            defaultEdgeOptions={{ 
                type: 'dismissible', 
                animated: true,
                style: { strokeWidth: 3 },
                selected: false
            }}
        >
          <Background color="#000" gap={32} size={1} style={{ opacity: 0.02 }} />
          <Controls className="!bg-white !border-black/5 !rounded-[24px] !p-2 !shadow-2xl" />
          <Panel position="bottom-left" className="ml-16 mb-4">
              <HistoryControls />
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
};

export const InfiniteCanvasPage = memo(() => (<ReactFlowProvider><CanvasInner /></ReactFlowProvider>));
