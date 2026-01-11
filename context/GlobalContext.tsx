

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Channel, VolcSettings } from '../types';

export type Lang = 'zh' | 'en';

// --- LOCALIZATION DATA ---
const locales = {
  zh: {
    title: '星光叙事引擎',
    enterprise: 'S² Studio',
    mainNav: '资源管理',
    creationTools: '创作中心',
    postProd: '专业工具',
    projects: '项目管理',
    storyboard: '分镜管理',
    script: '剧本分析',
    videoCreation: '视频创作',
    assets: '资产库',
    movieRec: '风格化重绘',
    digitalHuman: '数字人合成',
    images: '图像创作',
    infiniteCanvas: '无限画布',
    noChannel: '选择节点',
    logout: '登出',
    channelSettings: '节点设置',
    activeChannels: '视频生成节点',
    addChannel: '添加新节点',
    label: '名称',
    endpoint: '接口地址 (Base URL)',
    apiKey: '密钥 (API Key)',
    saveChannel: '保存配置',
    current: '当前使用',
    select: '切换',
    verified: '已连接',
    channelModalTitle: '系统设置',
    channelModalDesc: '配置视频生成节点与文本智能引擎。',
    missingToken: '未配置 API 密钥',
    projectsDesc: '集中管理您的创意项目与资源备份。',
    storyboardDesc: '可视化管理分镜脚本与镜头语言。',
    scriptDesc: 'AI 驱动的剧本拆解与分镜工具。',
    assetsDesc: '管理生成的高清视频与图像素材。',
    movieRecDesc: '专业的风格迁移与画面重构工具。',
    digitalHumanDesc: '高保真数字人驱动与合成系统处理。',
    imagesDesc: '使用 Banana 系列模型进行文生图与图生图创作。',
    infiniteCanvasDesc: '基于节点流的非线性叙事创作空间。',
    comingSoon: '即将推出',
    genConsole: '创意工作台',
    model: '生成模型',
    storyPrompt: '输入提示词...',
    promptPlaceholder: '描述你想要生成的画面内容...',
    submit: '发送',
    submitting: '生成中...',
    castLib: '角色库',
    castEmpty: '暂无角色资产',
    history: '创作时间轴',
    clearHistory: '清除历史',
    historyEmpty: '开启新灵感',
    historyEmptyDesc: '在这里输入想法，开始你的视觉之旅',
    charCreatePrompt: '角色提取',
    wait: '排队中',
    done: '完成',
    fail: '失败',
    gen: '处理中',
    progress: '进度',
    clearHistoryConfirm: '确定要清除所有记录吗？',
    volcSettingsTitle: '文本智能引擎 (Volc Engine)',
    volcModelPlaceholder: '例如: doubao-pro-32k',
    volcApiKeyPlaceholder: '输入 API Key',
    textAiConfig: '剧本 AI 配置',
    volcEngine: '火山引擎',
    // Script Editor
    scenes: '场景',
    back: '返回',
    saved: '已保存',
    aiAnalysis: 'AI 分析',
    scriptPlaceholder: 'INT. SCENE - DAY...',
    formatPreviewHint: '预览模式',
    scriptMindsTitle: '剧本智能',
    emotionalArc: '情感弧线',
    charactersTitle: '角色',
    volcCopilotTitle: 'AI 助手',
    volcCopilotDesc: '选择文本以使用 AI 功能。',
    expand: '扩写',
    shorten: '缩写',
    fixFormat: '修格式',
    selectTextAlert: '请先选择文本',
    configureVolcAlert: '请先配置火山引擎',
    lines: '行台词',
    projectTitlePlaceholder: '项目标题',
    aiError: 'AI 错误',
    pleaseSelectProject: '请选择一个项目',
    // Terminology Update
    horizontal: '横屏',
    vertical: '竖屏',
    square: '方形',
    // Image Gen
    textToImage: '文字生成图像',
    imageToImage: '垫图生成图像',
    uploadImage: '上传参考',
    dragDrop: '拖拽图片',
    aspectRatio: '画面比例',
    imageSize: '分辨率',
    noImageSelected: '请上传图片',
    download: '保存',
    imageGenPlaceholder: '输入提示词生成图像...',
    dropFeedback: '松开设置'
  },
  en: {
    title: 'StarNarrator',
    enterprise: 'S² Studio',
    mainNav: 'RESOURCES',
    creationTools: 'CREATION',
    postProd: 'TOOLS',
    projects: 'Projects',
    storyboard: 'Storyboards',
    script: 'Script AI',
    videoCreation: 'Video Studio',
    assets: 'Assets',
    movieRec: 'Remix',
    digitalHuman: 'Digital Human',
    images: 'Image Studio',
    infiniteCanvas: 'Infinite Canvas',
    noChannel: 'Select Node',
    logout: 'Log Out',
    channelSettings: 'Settings',
    activeChannels: 'Nodes',
    addChannel: 'Add Node',
    label: 'Label',
    endpoint: 'Endpoint',
    apiKey: 'API Key',
    saveChannel: 'Save',
    current: 'Active',
    select: 'Use',
    verified: 'Live',
    channelModalTitle: 'System Settings',
    channelModalDesc: 'Configure nodes and AI engines.',
    missingToken: 'Missing API Token',
    projectsDesc: 'Manage movie scenes and storylines.',
    storyboardDesc: 'Visualize shot lists.',
    scriptDesc: 'AI breakdown and prompting.',
    assetsDesc: 'Manage media assets.',
    movieRecDesc: 'Style migration tools.',
    digitalHumanDesc: 'Digital human synthesis.',
    imagesDesc: 'Banana series image generation.',
    infiniteCanvasDesc: 'Node-based non-linear storytelling.',
    comingSoon: 'Soon',
    genConsole: 'Creative Hub',
    model: 'Model',
    storyPrompt: 'Enter prompt...',
    promptPlaceholder: 'Describe your visual idea...',
    submit: 'Send',
    submitting: 'Generating...',
    castLib: 'Cast',
    castEmpty: 'No characters',
    history: 'Timeline',
    clearHistory: 'Clear',
    historyEmpty: 'Start Creating',
    historyEmptyDesc: 'Input your thoughts and let AI do the rest',
    charCreatePrompt: 'Extraction',
    wait: 'Queued',
    done: 'Ready',
    fail: 'Failed',
    gen: 'Processing',
    progress: 'Progress',
    clearHistoryConfirm: 'Clear history?',
    volcSettingsTitle: 'Text Engine (Volc)',
    volcModelPlaceholder: 'e.g., doubao-pro-32k',
    volcApiKeyPlaceholder: 'API Key',
    textAiConfig: 'AI Config',
    volcEngine: 'Volc Engine',
    // Script Editor
    scenes: 'Scenes',
    back: 'Back',
    saved: 'Saved',
    aiAnalysis: 'AI Analysis',
    scriptPlaceholder: 'INT. SCENE...',
    formatPreviewHint: 'Preview',
    scriptMindsTitle: 'Script Minds',
    emotionalArc: 'Emotion Arc',
    charactersTitle: 'Cast',
    volcCopilotTitle: 'AI Copilot',
    volcCopilotDesc: 'Select text to activate.',
    expand: 'Expand',
    shorten: 'Shorten',
    fixFormat: 'Format',
    selectTextAlert: 'Select text first',
    configureVolcAlert: 'Config Volc first',
    lines: 'lines',
    projectTitlePlaceholder: 'Title',
    aiError: 'AI Error',
    pleaseSelectProject: 'Select a project',
    // Terminology Update
    horizontal: 'Landscape',
    vertical: 'Portrait',
    square: 'Square',
    // Image Gen
    textToImage: 'Text to Image',
    imageToImage: 'Image to Image',
    uploadImage: 'Reference',
    dragDrop: 'Drag Image',
    aspectRatio: 'Ratio',
    imageSize: 'Resolution',
    noImageSelected: 'Upload image first',
    download: 'Save',
    imageGenPlaceholder: 'Describe the image...',
    dropFeedback: 'Drop Here'
  }
};

interface GlobalContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: keyof typeof locales['zh']) => string;
  channels: Channel[];
  activeChannelId: string;
  activeChannel: Channel | undefined;
  setActiveChannelId: (id: string) => void;
  addChannel: (channel: Channel) => void;
  updateChannel: (id: string, updates: Partial<Channel>) => void;
  deleteChannel: (id: string) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  volcSettings: VolcSettings;
  setVolcSettings: (settings: VolcSettings) => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const useGlobal = () => {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('useGlobal must be used within a GlobalProvider');
  }
  return context;
};

export const GlobalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('sora_lang') as Lang) || 'zh');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [volcSettings, setVolcSettings] = useState<VolcSettings>(() => {
      const saved = localStorage.getItem('sora_volc_settings');
      return saved ? JSON.parse(saved) : { apiKey: '', model: '', maxTokens: 8192 };
  });

  const t = (key: keyof typeof locales['zh']) => locales[lang][key] || key;

  useEffect(() => { localStorage.setItem('sora_lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('sora_volc_settings', JSON.stringify(volcSettings)); }, [volcSettings]);

  useEffect(() => {
    const savedChannels = localStorage.getItem('sora_channels');
    const savedActiveId = localStorage.getItem('sora_active_channel_id');
    if (savedChannels) {
      const parsed = JSON.parse(savedChannels);
      setChannels(parsed);
      if (savedActiveId && parsed.find((p: Channel) => p.id === savedActiveId)) setActiveChannelId(savedActiveId);
      else if (parsed.length > 0) setActiveChannelId(parsed[0].id);
    } else {
      const defaultChannel: Channel = { id: 'default', name: 'Relay Alpha', baseUrl: 'https://newapi.dkyx.cc', apiToken: '' };
      setChannels([defaultChannel]); setActiveChannelId(defaultChannel.id);
    }
  }, []);

  useEffect(() => {
    if (channels.length > 0) localStorage.setItem('sora_channels', JSON.stringify(channels));
    if (activeChannelId) localStorage.setItem('sora_active_channel_id', activeChannelId);
  }, [channels, activeChannelId]);

  const activeChannel = useMemo(() => channels.find(c => c.id === activeChannelId), [channels, activeChannelId]);

  const addChannel = (channel: Channel) => { setChannels(prev => [...prev, channel]); setActiveChannelId(channel.id); };
  const updateChannel = (id: string, updates: Partial<Channel>) => { setChannels(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c)); };
  const deleteChannel = (id: string) => { if (channels.length <= 1) return; const updated = channels.filter(c => c.id !== id); setChannels(updated); if (activeChannelId === id) setActiveChannelId(updated[0].id); };

  return (
    <GlobalContext.Provider value={{
      lang, setLang, t,
      channels, activeChannelId, activeChannel,
      setActiveChannelId, addChannel, updateChannel, deleteChannel,
      showSettings, setShowSettings,
      volcSettings, setVolcSettings
    }}>
      {children}
    </GlobalContext.Provider>
  );
};
