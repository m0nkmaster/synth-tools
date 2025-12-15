import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { DrumCreator } from './pages/DrumCreator';
import { SampleAnalyzer } from './pages/SampleAnalyzer';
import { SynthesizerUI } from './pages/SynthesizerUI';
import { USBBrowser } from './pages/USBBrowser';
import VisualNodeSynth from './pages/VisualNodeSynth';
import AIKitGenerator from './pages/AIKitGenerator';
import { ErrorBoundary } from './components/ErrorBoundary';

const basename = import.meta.env.PROD ? '/synthtools' : '/';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/synthesizer" replace />} />
          <Route path="drum-creator" element={<DrumCreator />} />
          <Route path="sample-analyzer" element={<SampleAnalyzer />} />
          <Route path="synthesizer" element={<ErrorBoundary><SynthesizerUI /></ErrorBoundary>} />
          <Route path="usb-browser" element={<USBBrowser />} />
          <Route path="visual-node-synth" element={<ErrorBoundary><VisualNodeSynth /></ErrorBoundary>} />
          <Route path="ai-kit-generator" element={<ErrorBoundary><AIKitGenerator /></ErrorBoundary>} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
