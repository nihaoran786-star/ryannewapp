

import React from 'react';
import { createRoot } from 'react-dom/client';
import * as ReactRouterDOM from 'react-router-dom';
import { GlobalProvider } from './context/GlobalContext';
import { Layout } from './components/Layout';

// Pages
import { DirectorPage } from './pages/DirectorPage';
import { ScriptPage } from './pages/ScriptPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { StoryboardPage } from './pages/StoryboardPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { ImageGenPage } from './pages/ImageGenPage'; // New Import

const { HashRouter: Router, Routes, Route, Navigate } = ReactRouterDOM as any;

const App = () => {
  return (
    <Router>
        <GlobalProvider>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/director" replace />} />
                    <Route path="director" element={<DirectorPage />} />
                    
                    {/* Project Management & Script Editor Routes */}
                    <Route path="projects" element={<ProjectsPage />} />
                    <Route path="projects/:projectId/storyboard" element={<StoryboardPage />} />
                    
                    <Route path="script/:projectId" element={<ScriptPage />} />
                    <Route path="script" element={<Navigate to="/projects" replace />} />
                    
                    {/* Storyboard Feature (Generic View or Redirect) */}
                    <Route path="storyboard" element={<StoryboardPage />} />
                    
                    <Route path="assets" element={<PlaceholderPage titleKey="assets" descKey="assetsDesc" />} />
                    <Route path="movie-recreation" element={<PlaceholderPage titleKey="movieRec" descKey="movieRecDesc" />} />
                    <Route path="digital-human" element={<PlaceholderPage titleKey="digitalHuman" descKey="digitalHumanDesc" />} />
                    
                    {/* New Image Gen Route */}
                    <Route path="images" element={<ImageGenPage />} />

                    <Route path="*" element={<Navigate to="/director" replace />} />
                </Route>
            </Routes>
        </GlobalProvider>
    </Router>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);