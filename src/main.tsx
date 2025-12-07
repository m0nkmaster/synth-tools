import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { DrumCreator } from './pages/DrumCreator';
import { SampleAnalyzer } from './pages/SampleAnalyzer';
import { SoundCreation } from './pages/SoundCreation';
import SynthTest from './pages/SynthTest';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/drum-creator" replace />} />
          <Route path="drum-creator" element={<DrumCreator />} />
          <Route path="sample-analyzer" element={<SampleAnalyzer />} />
          <Route path="sound-creation" element={<SoundCreation />} />
          <Route path="synth-test" element={<SynthTest />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
