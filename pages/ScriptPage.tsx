import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { ScriptEditor } from '../components/ScriptEditor';
import { useGlobal } from '../context/GlobalContext';

const { useParams, useNavigate } = ReactRouterDOM as any;

export const ScriptPage = () => {
  const { lang } = useGlobal();
  // Fixed: Removed generic type argument from useParams call because it is extracted from an 'any' cast, and untyped function calls cannot accept type arguments in TS.
  const { projectId } = useParams();
  const navigate = useNavigate();

  return (
    <ScriptEditor 
        lang={lang} 
        projectId={projectId} 
        onBack={() => navigate('/projects')}
    />
  );
};