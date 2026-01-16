import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GlobalProvider } from './context/GlobalContext';
import { Layout } from './components/Layout';

// Pages
import { DirectorPage } from './pages/DirectorPage';
import { ScriptPage } from './pages/ScriptPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { StoryboardPage } from './pages/StoryboardPage';
import { ProjectWorkspace } from './pages/ProjectWorkspace';
import { DirectorConsolePage } from './pages/DirectorConsolePage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { ImageGenPage } from './pages/ImageGenPage';
import { InfiniteCanvasPage } from './pages/InfiniteCanvasPage';
import { AssetsPage } from './pages/AssetsPage';

const App = () => {
  return (
    <Router>
        <GlobalProvider>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/director" replace />} />
                    <Route path="director" element={<DirectorPage />} />
                    
                    {/* Project Management */}
                    <Route path="projects" element={<ProjectsPage />} />
                    
                    {/* Project Workspace Routes */}
                    <Route path="project/:projectId" element={<ProjectWorkspace />}>
                        <Route index element={<Navigate to="script" replace />} />
                        <Route path="script" element={<ScriptPage />} />
                        <Route path="storyboard" element={<StoryboardPage />} />
                        <Route path="director" element={<DirectorConsolePage />} />
                    </Route>
                    
                    {/* Media Assets Library */}
                    <Route path="assets" element={<AssetsPage />} />
                    
                    {/* Other Tools */}
                    <Route path="movie-recreation" element={<PlaceholderPage titleKey="movieRec" descKey="movieRecDesc" />} />
                    <Route path="digital-human" element={<PlaceholderPage titleKey="digitalHuman" descKey="digitalHumanDesc" />} />
                    <Route path="images" element={<ImageGenPage />} />
                    <Route path="infinite-canvas" element={<InfiniteCanvasPage />} />

                    <Route path="*" element={<Navigate to="/director" replace />} />
                </Route>
            </Routes>
        </GlobalProvider>
    </Router>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}