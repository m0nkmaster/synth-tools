/**
 * SynthesizerUI - Teenage Engineering Inspired Design with JSON Editor
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Collapse } from '@mui/material';
import { JSONEditor } from '../components/JSONEditor';
import { ValidationDisplay } from '../components/ValidationDisplay';
import { useDefaultPreset } from '../hooks/useDefaultPreset';
import { synthesizeSound } from '../audio/synthesizer';
import { validateSoundConfigJSON, type ValidationError } from '../utils/validation';
import type { SoundConfig } from '../types/soundConfig';

// ═══════════════════════════════════════════════════════════════════════════════
// TE-INSPIRED DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

const TE = {
  bg: '#f4f2ef',
  surface: '#eae7e3',
  panel: '#ffffff',
  black: '#1a1a1a',
  dark: '#3a3a3a',
  grey: '#888888',
  light: '#c0c0c0',
  orange: '#ff5500',
  yellow: '#ffd500',
  cyan: '#00c8ff',
  green: '#00cc66',
  pink: '#ff3399',
  border: '#d0d0d0',
  borderDark: '#a0a0a0',
};

type LayerType = SoundConfig['synthesis']['layers'][0];

// ═══════════════════════════════════════════════════════════════════════════════
// MINI KNOB
// ═══════════════════════════════════════════════════════════════════════════════

interface MiniKnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
  color?: string;
  logarithmic?: boolean;
  disabled?: boolean;
}

function MiniKnob({ value, min, max, onChange, label, color = TE.orange, logarithmic, disabled }: MiniKnobProps) {
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ y: 0, value: 0 });

  const normalized = logarithmic
    ? Math.log(Math.max(min, value) / min) / Math.log(max / min)
    : (value - min) / (max - min);
  const rotation = normalized * 270 - 135;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { y: e.clientY, value };
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      const delta = dragStart.current.y - e.clientY;
      const sensitivity = (max - min) / 100;
      let newVal: number;
      if (logarithmic) {
        const logMin = Math.log(min);
        const logMax = Math.log(max);
        const logCurr = Math.log(Math.max(min, dragStart.current.value));
        const logSens = (logMax - logMin) / 100;
        newVal = Math.exp(Math.max(logMin, Math.min(logMax, logCurr + delta * logSens)));
      } else {
        newVal = dragStart.current.value + delta * sensitivity;
      }
      onChange(Math.max(min, Math.min(max, newVal)));
    };
    const up = () => setDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [dragging, min, max, onChange, logarithmic]);

  const display = value >= 1000 ? `${(value/1000).toFixed(1)}k` : value >= 100 ? value.toFixed(0) : value >= 1 ? value.toFixed(1) : value.toFixed(2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, userSelect: 'none', opacity: disabled ? 0.4 : 1 }}>
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: 24, height: 24, borderRadius: '50%',
          background: TE.surface, border: `2px solid ${TE.borderDark}`,
          position: 'relative', cursor: disabled ? 'default' : dragging ? 'grabbing' : 'grab',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{
          position: 'absolute', width: 3, height: 3, background: color, borderRadius: '50%',
          top: 3, left: '50%', transformOrigin: '0 9px', transform: `translateX(-50%) rotate(${rotation}deg)`,
        }} />
      </div>
      <span style={{ fontSize: 7, color: TE.grey, fontWeight: 700, letterSpacing: 0.3 }}>{label}</span>
      <span style={{ fontSize: 8, color: TE.black, fontWeight: 700 }}>{display}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function LED({ on, color = TE.orange }: { on: boolean; color?: string }) {
  return <div style={{ width: 5, height: 5, borderRadius: '50%', background: on ? color : TE.light, boxShadow: on ? `0 0 4px ${color}` : 'none' }} />;
}

function Toggle({ on, onChange, color = TE.orange }: { on: boolean; onChange: () => void; color?: string }) {
  return (
    <button onClick={onChange} style={{
      width: 28, height: 14, borderRadius: 7, border: 'none',
      background: on ? color : TE.surface, cursor: 'pointer', position: 'relative',
    }}>
      <div style={{
        width: 10, height: 10, background: '#fff', borderRadius: '50%',
        position: 'absolute', top: 2, left: on ? 15 : 2, transition: 'left 0.15s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

function Btn({ children, active, onClick, color = TE.orange, small }: { children: React.ReactNode; active?: boolean; onClick: () => void; color?: string; small?: boolean }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? '3px 6px' : '4px 8px',
      background: active ? color : TE.panel, border: `1px solid ${active ? color : TE.border}`,
      borderRadius: 2, color: active ? '#fff' : TE.dark,
      fontSize: small ? 8 : 9, fontWeight: 700, cursor: 'pointer',
    }}>{children}</button>
  );
}

function Section({ title, children, color }: { title: string; children: React.ReactNode; color?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 8, color: color || TE.grey, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCOPE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

function ScopeDisplay({ audioBuffer }: { audioBuffer: AudioBuffer | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = 60;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, h / 2 + 0.5); ctx.lineTo(w, h / 2 + 0.5); ctx.stroke();

    if (audioBuffer) {
      const data = audioBuffer.getChannelData(0);
      const step = Math.ceil(data.length / w);
      ctx.strokeStyle = TE.orange;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const y = (1 - (data[x * step] + 1) / 2) * h;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [audioBuffer]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: 60 }}>
      <canvas ref={canvasRef} style={{ borderRadius: 4, display: 'block' }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENVELOPE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

function EnvelopeDisplay({ attack, decay, sustain, release, color = TE.green }: { attack: number; decay: number; sustain: number; release: number; color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = 60;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2 + 0.5);
    ctx.lineTo(w, h / 2 + 0.5);
    ctx.stroke();

    const total = attack + decay + release + 0.3;
    const scale = w / total;
    const pad = 4;

    ctx.fillStyle = `${color}20`;
    ctx.beginPath();
    ctx.moveTo(0, h - pad);
    ctx.lineTo(attack * scale, pad);
    ctx.lineTo((attack + decay) * scale, pad + (1 - sustain) * (h - pad * 2));
    ctx.lineTo((attack + decay + 0.3) * scale, pad + (1 - sustain) * (h - pad * 2));
    ctx.lineTo(w, h - pad);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, h - pad);
    ctx.lineTo(attack * scale, pad);
    ctx.lineTo((attack + decay) * scale, pad + (1 - sustain) * (h - pad * 2));
    ctx.lineTo((attack + decay + 0.3) * scale, pad + (1 - sustain) * (h - pad * 2));
    ctx.lineTo(w, h - pad);
    ctx.stroke();

    ctx.fillStyle = color;
    [[attack * scale, pad], [(attack + decay) * scale, pad + (1 - sustain) * (h - pad * 2)]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [attack, decay, sustain, release, color]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: 60 }}>
      <canvas ref={canvasRef} style={{ borderRadius: 4, display: 'block' }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const LAYER_CFG: Record<string, { icon: string; color: string; label: string }> = {
  oscillator: { icon: '◐', color: TE.orange, label: 'OSC' },
  noise: { icon: '▒', color: TE.pink, label: 'NSE' },
  fm: { icon: '◎', color: TE.cyan, label: 'FM' },
  'karplus-strong': { icon: '◉', color: TE.green, label: 'KS' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE & LAYER PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function Module({ label, color, on, onToggle, children }: { label: string; color: string; on?: boolean; onToggle?: () => void; children: React.ReactNode }) {
  const isToggleable = onToggle !== undefined;
  const isActive = on !== false;
  return (
    <div style={{
      background: isActive ? `${color}08` : TE.surface,
      border: `1px solid ${isActive ? `${color}40` : TE.border}`,
      borderRadius: 3, padding: '6px 8px', opacity: isActive ? 1 : 0.5, minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isActive ? 6 : 0 }}>
        <span style={{ fontSize: 7, fontWeight: 800, color: isActive ? color : TE.grey, letterSpacing: 0.5 }}>{label}</span>
        {isToggleable && <Toggle on={!!on} onChange={onToggle} color={color} />}
      </div>
      {isActive && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>{children}</div>}
    </div>
  );
}

interface LayerPanelProps {
  layer: LayerType;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (l: LayerType) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function LayerPanel({ layer, index, selected, onSelect, onUpdate, onRemove, canRemove }: LayerPanelProps) {
  const cfg = LAYER_CFG[layer.type] || LAYER_CFG.oscillator;
  const updateOsc = (patch: Partial<NonNullable<LayerType['oscillator']>>) => {
    onUpdate({ ...layer, oscillator: { ...layer.oscillator!, ...patch } });
  };

  return (
    <div onClick={onSelect} style={{
      background: selected ? TE.panel : TE.surface,
      border: `1px solid ${selected ? cfg.color : TE.border}`,
      borderRadius: 4, cursor: 'pointer',
      boxShadow: selected ? '0 2px 8px rgba(0,0,0,0.08)' : 'none', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px',
        background: selected ? `linear-gradient(90deg, ${cfg.color}20, transparent)` : 'transparent',
        borderBottom: selected ? `1px solid ${TE.border}` : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 3, background: cfg.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{index + 1}</div>
          <span style={{ fontSize: 10, fontWeight: 700, color: TE.black }}>{cfg.label}</span>
          <span style={{ fontSize: 11, color: cfg.color }}>{cfg.icon}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
          <input type="range" min={0} max={1} step={0.01} value={layer.gain} onChange={e => onUpdate({ ...layer, gain: parseFloat(e.target.value) })} style={{ width: 50, height: 3, accentColor: cfg.color }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: TE.dark, width: 28, textAlign: 'right' }}>{(layer.gain * 100).toFixed(0)}%</span>
          {canRemove && <button onClick={onRemove} style={{ width: 16, height: 16, border: 'none', background: `${TE.pink}20`, borderRadius: 2, fontSize: 10, color: TE.pink, cursor: 'pointer', fontWeight: 700 }}>×</button>}
        </div>
      </div>

      {selected && (
        <div style={{ padding: 10 }}>
          {layer.type === 'oscillator' && layer.oscillator && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              <Module label="OSCILLATOR" color={cfg.color}>
                <div style={{ display: 'flex', gap: 2, marginRight: 8 }}>
                  {['sine', 'square', 'sawtooth', 'triangle'].map(wf => (
                    <Btn key={wf} active={layer.oscillator!.waveform === wf} onClick={() => updateOsc({ waveform: wf as any })} color={cfg.color} small>
                      {wf === 'sine' ? '∿' : wf === 'square' ? '⊓' : wf === 'sawtooth' ? '⋰' : '△'}
                    </Btn>
                  ))}
                </div>
                <MiniKnob value={layer.oscillator.frequency} min={20} max={20000} onChange={v => updateOsc({ frequency: v })} label="FREQ" color={cfg.color} logarithmic />
                <MiniKnob value={layer.oscillator.detune} min={-100} max={100} onChange={v => updateOsc({ detune: v })} label="DET" color={cfg.color} />
              </Module>
              <Module label="UNISON" color={cfg.color}>
                <MiniKnob value={layer.oscillator.unison?.voices || 1} min={1} max={8} onChange={v => updateOsc({ unison: { voices: Math.round(v), detune: layer.oscillator!.unison?.detune || 0, spread: layer.oscillator!.unison?.spread || 0 } })} label="VOX" color={cfg.color} />
                <MiniKnob value={layer.oscillator.unison?.detune || 0} min={0} max={100} onChange={v => updateOsc({ unison: { voices: layer.oscillator!.unison?.voices || 1, detune: v, spread: layer.oscillator!.unison?.spread || 0 } })} label="DET" color={cfg.color} />
                <MiniKnob value={layer.oscillator.unison?.spread || 0} min={0} max={1} onChange={v => updateOsc({ unison: { voices: layer.oscillator!.unison?.voices || 1, detune: layer.oscillator!.unison?.detune || 0, spread: v } })} label="WID" color={cfg.color} />
              </Module>
              <Module label="SUB" color={TE.pink} on={!!layer.oscillator.sub} onToggle={() => updateOsc({ sub: layer.oscillator!.sub ? undefined : { level: 0.5, octave: -1, waveform: 'sine' } })}>
                {layer.oscillator.sub && <>
                  <MiniKnob value={layer.oscillator.sub.level} min={0} max={1} onChange={v => updateOsc({ sub: { ...layer.oscillator!.sub!, level: v } })} label="LVL" color={TE.pink} />
                  <div style={{ display: 'flex', gap: 2 }}>
                    <Btn active={layer.oscillator.sub.octave === -1} onClick={() => updateOsc({ sub: { ...layer.oscillator!.sub!, octave: -1 } })} color={TE.pink} small>-1</Btn>
                    <Btn active={layer.oscillator.sub.octave === -2} onClick={() => updateOsc({ sub: { ...layer.oscillator!.sub!, octave: -2 } })} color={TE.pink} small>-2</Btn>
                  </div>
                </>}
              </Module>
              <Module label="ENVELOPE" color={TE.green} on={!!layer.envelope} onToggle={() => onUpdate({ ...layer, envelope: layer.envelope ? undefined : { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 } })}>
                {layer.envelope && <>
                  <MiniKnob value={layer.envelope.attack * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, attack: v / 1000 } })} label="A" color={TE.green} />
                  <MiniKnob value={layer.envelope.decay * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, decay: v / 1000 } })} label="D" color={TE.green} />
                  <MiniKnob value={layer.envelope.sustain} min={0} max={1} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, sustain: v } })} label="S" color={TE.green} />
                  <MiniKnob value={layer.envelope.release * 1000} min={1} max={5000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, release: v / 1000 } })} label="R" color={TE.green} />
                </>}
              </Module>
              <Module label="FILTER" color={TE.cyan} on={!!layer.filter} onToggle={() => onUpdate({ ...layer, filter: layer.filter ? undefined : { type: 'lowpass', frequency: 2000, q: 1 } })}>
                {layer.filter && <>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {['lowpass', 'highpass', 'bandpass'].map(t => (
                      <Btn key={t} active={layer.filter!.type === t} onClick={() => onUpdate({ ...layer, filter: { ...layer.filter!, type: t as any } })} color={TE.cyan} small>{t.slice(0, 2).toUpperCase()}</Btn>
                    ))}
                  </div>
                  <MiniKnob value={layer.filter.frequency} min={20} max={20000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, frequency: v } })} label="FRQ" color={TE.cyan} logarithmic />
                  <MiniKnob value={layer.filter.q} min={0.1} max={20} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, q: v } })} label="Q" color={TE.cyan} />
                </>}
              </Module>
              <Module label="SATURATION" color={TE.yellow} on={!!layer.saturation} onToggle={() => onUpdate({ ...layer, saturation: layer.saturation ? undefined : { type: 'soft', drive: 2, mix: 0.5 } })}>
                {layer.saturation && <>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {['soft', 'hard', 'tube', 'tape'].map(t => (
                      <Btn key={t} active={layer.saturation!.type === t} onClick={() => onUpdate({ ...layer, saturation: { ...layer.saturation!, type: t as any } })} color={TE.yellow} small>{t.slice(0, 2).toUpperCase()}</Btn>
                    ))}
                  </div>
                  <MiniKnob value={layer.saturation.drive} min={0} max={10} onChange={v => onUpdate({ ...layer, saturation: { ...layer.saturation!, drive: v } })} label="DRV" color={TE.yellow} />
                  <MiniKnob value={layer.saturation.mix} min={0} max={1} onChange={v => onUpdate({ ...layer, saturation: { ...layer.saturation!, mix: v } })} label="MIX" color={TE.yellow} />
                </>}
              </Module>
            </div>
          )}

          {layer.type === 'fm' && layer.fm && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              <Module label="FM SYNTHESIS" color={cfg.color}>
                <MiniKnob value={layer.fm.carrier} min={20} max={20000} onChange={v => onUpdate({ ...layer, fm: { ...layer.fm!, carrier: v } })} label="CAR" color={cfg.color} logarithmic />
                <MiniKnob value={layer.fm.modulator} min={20} max={20000} onChange={v => onUpdate({ ...layer, fm: { ...layer.fm!, modulator: v } })} label="MOD" color={cfg.color} logarithmic />
                <MiniKnob value={layer.fm.modulationIndex} min={0} max={1000} onChange={v => onUpdate({ ...layer, fm: { ...layer.fm!, modulationIndex: v } })} label="IDX" color={cfg.color} />
              </Module>
              <Module label="ENVELOPE" color={TE.green} on={!!layer.envelope} onToggle={() => onUpdate({ ...layer, envelope: layer.envelope ? undefined : { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 } })}>
                {layer.envelope && <>
                  <MiniKnob value={layer.envelope.attack * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, attack: v / 1000 } })} label="A" color={TE.green} />
                  <MiniKnob value={layer.envelope.decay * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, decay: v / 1000 } })} label="D" color={TE.green} />
                  <MiniKnob value={layer.envelope.sustain} min={0} max={1} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, sustain: v } })} label="S" color={TE.green} />
                  <MiniKnob value={layer.envelope.release * 1000} min={1} max={5000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, release: v / 1000 } })} label="R" color={TE.green} />
                </>}
              </Module>
              <Module label="FILTER" color={TE.cyan} on={!!layer.filter} onToggle={() => onUpdate({ ...layer, filter: layer.filter ? undefined : { type: 'lowpass', frequency: 2000, q: 1 } })}>
                {layer.filter && <>
                  <MiniKnob value={layer.filter.frequency} min={20} max={20000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, frequency: v } })} label="FRQ" color={TE.cyan} logarithmic />
                  <MiniKnob value={layer.filter.q} min={0.1} max={20} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, q: v } })} label="Q" color={TE.cyan} />
                </>}
              </Module>
            </div>
          )}

          {layer.type === 'karplus-strong' && layer.karplus && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              <Module label="STRING" color={cfg.color}>
                <MiniKnob value={layer.karplus.frequency} min={20} max={20000} onChange={v => onUpdate({ ...layer, karplus: { ...layer.karplus!, frequency: v } })} label="FRQ" color={cfg.color} logarithmic />
                <MiniKnob value={layer.karplus.damping} min={0} max={1} onChange={v => onUpdate({ ...layer, karplus: { ...layer.karplus!, damping: v } })} label="DMP" color={cfg.color} />
                <MiniKnob value={layer.karplus.pluckLocation || 0.5} min={0} max={1} onChange={v => onUpdate({ ...layer, karplus: { ...layer.karplus!, pluckLocation: v } })} label="PLK" color={cfg.color} />
              </Module>
              <Module label="ENVELOPE" color={TE.green} on={!!layer.envelope} onToggle={() => onUpdate({ ...layer, envelope: layer.envelope ? undefined : { attack: 0.001, decay: 0.1, sustain: 0.5, release: 0.5 } })}>
                {layer.envelope && <>
                  <MiniKnob value={layer.envelope.attack * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, attack: v / 1000 } })} label="A" color={TE.green} />
                  <MiniKnob value={layer.envelope.decay * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, decay: v / 1000 } })} label="D" color={TE.green} />
                  <MiniKnob value={layer.envelope.sustain} min={0} max={1} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, sustain: v } })} label="S" color={TE.green} />
                  <MiniKnob value={layer.envelope.release * 1000} min={1} max={5000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, release: v / 1000 } })} label="R" color={TE.green} />
                </>}
              </Module>
            </div>
          )}

          {layer.type === 'noise' && layer.noise && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              <Module label="NOISE TYPE" color={cfg.color}>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[{ k: 'white', l: 'WHITE' }, { k: 'pink', l: 'PINK' }, { k: 'brown', l: 'BROWN' }].map(t => (
                    <Btn key={t.k} active={layer.noise!.type === t.k} onClick={() => onUpdate({ ...layer, noise: { type: t.k as any } })} color={cfg.color}>{t.l}</Btn>
                  ))}
                </div>
              </Module>
              <Module label="ENVELOPE" color={TE.green} on={!!layer.envelope} onToggle={() => onUpdate({ ...layer, envelope: layer.envelope ? undefined : { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 } })}>
                {layer.envelope && <>
                  <MiniKnob value={layer.envelope.attack * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, attack: v / 1000 } })} label="A" color={TE.green} />
                  <MiniKnob value={layer.envelope.decay * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, decay: v / 1000 } })} label="D" color={TE.green} />
                  <MiniKnob value={layer.envelope.sustain} min={0} max={1} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, sustain: v } })} label="S" color={TE.green} />
                  <MiniKnob value={layer.envelope.release * 1000} min={1} max={5000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, release: v / 1000 } })} label="R" color={TE.green} />
                </>}
              </Module>
              <Module label="FILTER" color={TE.cyan} on={!!layer.filter} onToggle={() => onUpdate({ ...layer, filter: layer.filter ? undefined : { type: 'lowpass', frequency: 2000, q: 1 } })}>
                {layer.filter && <>
                  <MiniKnob value={layer.filter.frequency} min={20} max={20000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, frequency: v } })} label="FRQ" color={TE.cyan} logarithmic />
                  <MiniKnob value={layer.filter.q} min={0.1} max={20} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, q: v } })} label="Q" color={TE.cyan} />
                </>}
              </Module>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EFFECT PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function Effect({ name, on, onToggle, color, children }: { name: string; on: boolean; onToggle: () => void; color: string; children: React.ReactNode }) {
  return (
    <div style={{ background: TE.panel, border: `1px solid ${on ? color : TE.border}`, borderRadius: 4, padding: 8, opacity: on ? 1 : 0.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: on ? 8 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <LED on={on} color={color} />
          <span style={{ fontSize: 8, fontWeight: 700, color: on ? TE.black : TE.grey }}>{name}</span>
        </div>
        <Toggle on={on} onChange={onToggle} color={color} />
      </div>
      {on && <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>{children}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WAV EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const data = new Float32Array(buffer.length * numChannels);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < buffer.length; i++) {
      data[i * numChannels + channel] = channelData[i];
    }
  }

  const dataLength = data.length * bytesPerSample;
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, bufferLength - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < data.length; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return arrayBuffer;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function SynthesizerUI() {
  const defaultPreset = useDefaultPreset();
  const [config, setConfig] = useState<SoundConfig>(defaultPreset);
  const [jsonValue, setJsonValue] = useState<string>('');
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<ValidationError[]>([]);
  const [showJSONEditor, setShowJSONEditor] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState(0);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const isUpdatingFromUI = useRef(false);
  const isUpdatingFromJSON = useRef(false);

  // Dynamics state
  const [velocity, setVelocity] = useState(config.dynamics?.velocity ?? 0.8);
  const [normalize, setNormalize] = useState(config.dynamics?.normalize ?? true);

  // Initialize JSON value from config
  useEffect(() => {
    setJsonValue(JSON.stringify(config, null, 2));
  }, []);

  // Sync JSON when config changes
  useEffect(() => {
    if (!isUpdatingFromJSON.current) {
      isUpdatingFromUI.current = true;
      setJsonValue(JSON.stringify(config, null, 2));
      setTimeout(() => { isUpdatingFromUI.current = false; }, 0);
    }
  }, [config]);

  // Preview buffer generation
  useEffect(() => {
    const gen = async () => { try { setAudioBuffer(await synthesizeSound(config)); } catch {} };
    const t = setTimeout(gen, 200);
    return () => clearTimeout(t);
  }, [config]);

  // JSON change handler
  const handleJSONChange = useCallback((newJsonValue: string) => {
    setJsonValue(newJsonValue);
    const validationResult = validateSoundConfigJSON(newJsonValue);
    setValidationErrors(validationResult.errors);
    setValidationWarnings(validationResult.warnings);

    if (validationResult.valid && !isUpdatingFromUI.current) {
      try {
        const parsedConfig = JSON.parse(newJsonValue) as SoundConfig;
        isUpdatingFromJSON.current = true;
        setConfig(parsedConfig);
        setError(null);
        setTimeout(() => { isUpdatingFromJSON.current = false; }, 0);
      } catch {}
    }
  }, []);

  // Update helpers
  const updateLayer = (index: number, layer: LayerType) => {
    const newLayers = [...config.synthesis.layers];
    newLayers[index] = layer;
    setConfig({ ...config, synthesis: { ...config.synthesis, layers: newLayers } });
  };

  const addLayer = (type: LayerType['type']) => {
    const base = { gain: 0.5 };
    let newLayer: LayerType;
    if (type === 'oscillator') newLayer = { ...base, type, oscillator: { waveform: 'sine', frequency: 440, detune: 0 } };
    else if (type === 'noise') newLayer = { ...base, type, noise: { type: 'white' } };
    else if (type === 'fm') newLayer = { ...base, type, fm: { carrier: 440, modulator: 880, modulationIndex: 100 } };
    else newLayer = { ...base, type, karplus: { frequency: 440, damping: 0.5 } };
    setConfig({ ...config, synthesis: { ...config.synthesis, layers: [...config.synthesis.layers, newLayer] } });
  };

  const removeLayer = (index: number) => {
    const newLayers = config.synthesis.layers.filter((_, i) => i !== index);
    setConfig({ ...config, synthesis: { ...config.synthesis, layers: newLayers } });
    if (selectedLayer >= newLayers.length) setSelectedLayer(Math.max(0, newLayers.length - 1));
  };

  const updateEnvelope = (envelope: SoundConfig['envelope']) => setConfig({ ...config, envelope });
  const updateFilter = (filter: SoundConfig['filter']) => setConfig({ ...config, filter });
  const updateLFO = (lfo: SoundConfig['lfo']) => setConfig({ ...config, lfo });
  const updateEffects = (effects: SoundConfig['effects']) => setConfig({ ...config, effects });
  const updateDuration = (duration: number) => setConfig({ ...config, timing: { ...config.timing, duration } });

  // Play sound
  const handlePlay = async () => {
    setPlaying(true);
    setError(null);
    try {
      const buffer = await synthesizeSound(config);
      const ctx = new AudioContext();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
      source.onended = () => setPlaying(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Synthesis failed');
      setPlaying(false);
    }
  };

  // Export sound
  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const buffer = await synthesizeSound(config);
      const wav = audioBufferToWav(buffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.metadata.name || 'sound'}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif' }}>
      {/* HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: TE.panel, borderBottom: `1px solid ${TE.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: TE.orange, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 12 }}>SE</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: TE.black, letterSpacing: 1 }}>SYNTH ENGINE</div>
            <div style={{ fontSize: 8, color: TE.grey }}>full featured</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setShowJSONEditor(!showJSONEditor)}
            style={{
              padding: '6px 10px', border: `1px solid ${showJSONEditor ? TE.orange : TE.border}`,
              borderRadius: 3, background: showJSONEditor ? `${TE.orange}20` : TE.panel,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 600, color: showJSONEditor ? TE.orange : TE.grey,
            }}
          >
            {'</>'}
          </button>
          <button onClick={handlePlay} disabled={playing} style={{ padding: '6px 24px', background: playing ? TE.surface : TE.orange, border: 'none', borderRadius: 3, color: playing ? TE.grey : '#fff', fontSize: 10, fontWeight: 800, cursor: playing ? 'not-allowed' : 'pointer', letterSpacing: 0.5 }}>
            {playing ? '■ PLAYING' : '▶ PLAY'}
          </button>
          <button onClick={handleExport} disabled={exporting} style={{ padding: '6px 12px', background: TE.panel, border: `1px solid ${TE.green}`, borderRadius: 3, color: TE.green, fontSize: 9, fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.5 : 1 }}>↓ EXPORT</button>
        </div>
      </header>

      {error && <div style={{ padding: '6px 16px', background: '#fff3f3', borderBottom: `1px solid #ffcccc`, color: '#cc0000', fontSize: 9 }}>{error}</div>}

      {/* JSON EDITOR */}
      <Collapse in={showJSONEditor}>
        <div style={{ background: TE.panel, borderBottom: `1px solid ${TE.border}`, padding: 16 }}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ fontSize: 8, color: TE.grey, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>JSON CONFIGURATION</div>
            <ValidationDisplay errors={validationErrors} warnings={validationWarnings} />
            <div style={{ marginTop: validationErrors.length > 0 || validationWarnings.length > 0 ? 8 : 0 }}>
              <JSONEditor value={jsonValue} onChange={handleJSONChange} height="300px" />
            </div>
          </div>
        </div>
      </Collapse>

      {/* MAIN */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 12, padding: 12, maxWidth: 1000, margin: '0 auto' }}>
        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* WAVEFORM */}
          <div style={{ background: TE.panel, borderRadius: 4, padding: 10, border: `1px solid ${TE.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 8, color: TE.grey, fontWeight: 700, letterSpacing: 1 }}>WAVEFORM</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 8, color: TE.grey }}>DUR</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: TE.orange }}>{config.timing.duration.toFixed(2)}s</span>
              </div>
            </div>
            <ScopeDisplay audioBuffer={audioBuffer} />
            <input type="range" min={0.1} max={10} step={0.1} value={config.timing.duration} onChange={e => updateDuration(parseFloat(e.target.value))} style={{ width: '100%', height: 3, marginTop: 6, accentColor: TE.orange }} />
          </div>

          {/* LAYERS */}
          <div style={{ background: TE.panel, borderRadius: 4, padding: 10, border: `1px solid ${TE.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 8, color: TE.grey, fontWeight: 700, letterSpacing: 1 }}>LAYERS</span>
              {config.synthesis.layers.length < 8 && (
                <div style={{ display: 'flex', gap: 3 }}>
                  {Object.entries(LAYER_CFG).map(([type, c]) => (
                    <button key={type} onClick={() => addLayer(type as any)} style={{ width: 18, height: 18, background: TE.surface, border: `1px solid ${c.color}40`, borderRadius: 2, color: c.color, fontSize: 10, cursor: 'pointer' }}>+</button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {config.synthesis.layers.map((layer, i) => (
                <LayerPanel key={i} layer={layer} index={i} selected={selectedLayer === i} onSelect={() => setSelectedLayer(i)} onUpdate={l => updateLayer(i, l)} onRemove={() => removeLayer(i)} canRemove={config.synthesis.layers.length > 1} />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* ENVELOPE */}
          <div style={{ background: TE.panel, borderRadius: 4, padding: 10, border: `1px solid ${TE.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 8, color: TE.grey, fontWeight: 700, letterSpacing: 1 }}>ENVELOPE</span>
            </div>
            <EnvelopeDisplay {...config.envelope} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <MiniKnob value={config.envelope.attack * 1000} min={1} max={2000} onChange={v => updateEnvelope({ ...config.envelope, attack: v / 1000 })} label="ATK" color={TE.green} />
              <MiniKnob value={config.envelope.decay * 1000} min={1} max={2000} onChange={v => updateEnvelope({ ...config.envelope, decay: v / 1000 })} label="DEC" color={TE.green} />
              <MiniKnob value={config.envelope.sustain} min={0} max={1} onChange={v => updateEnvelope({ ...config.envelope, sustain: v })} label="SUS" color={TE.green} />
              <MiniKnob value={config.envelope.release * 1000} min={1} max={5000} onChange={v => updateEnvelope({ ...config.envelope, release: v / 1000 })} label="REL" color={TE.green} />
            </div>
          </div>

          {/* LFO */}
          <div style={{ background: TE.panel, borderRadius: 4, padding: 10, border: `1px solid ${config.lfo ? TE.yellow : TE.border}`, opacity: config.lfo ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: config.lfo ? 8 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <LED on={!!config.lfo} color={TE.yellow} />
                <span style={{ fontSize: 8, color: TE.grey, fontWeight: 700, letterSpacing: 1 }}>LFO</span>
              </div>
              <Toggle on={!!config.lfo} onChange={() => config.lfo ? updateLFO(undefined) : updateLFO({ waveform: 'sine', frequency: 5, depth: 0.5, target: 'pitch' })} color={TE.yellow} />
            </div>
            {config.lfo && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {['sine', 'square', 'sawtooth', 'triangle', 'random'].map(w => (
                    <Btn key={w} active={config.lfo!.waveform === w} onClick={() => updateLFO({ ...config.lfo!, waveform: w as any })} color={TE.yellow} small>{w.slice(0, 3).toUpperCase()}</Btn>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {['pitch', 'filter', 'amplitude', 'pan'].map(t => (
                    <Btn key={t} active={config.lfo!.target === t} onClick={() => updateLFO({ ...config.lfo!, target: t as any })} color={TE.yellow} small>{t.slice(0, 3).toUpperCase()}</Btn>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <MiniKnob value={config.lfo.frequency} min={0.1} max={20} onChange={v => updateLFO({ ...config.lfo!, frequency: v })} label="RATE" color={TE.yellow} />
                  <MiniKnob value={config.lfo.depth} min={0} max={1} onChange={v => updateLFO({ ...config.lfo!, depth: v })} label="DEPTH" color={TE.yellow} />
                  <MiniKnob value={config.lfo.delay || 0} min={0} max={2} onChange={v => updateLFO({ ...config.lfo!, delay: v })} label="DELAY" color={TE.yellow} />
                  <MiniKnob value={config.lfo.fade || 0} min={0} max={2} onChange={v => updateLFO({ ...config.lfo!, fade: v })} label="FADE" color={TE.yellow} />
                </div>
              </div>
            )}
          </div>

          {/* FILTER */}
          <div style={{ background: TE.panel, borderRadius: 4, padding: 10, border: `1px solid ${config.filter ? TE.cyan : TE.border}`, opacity: config.filter ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: config.filter ? 8 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <LED on={!!config.filter} color={TE.cyan} />
                <span style={{ fontSize: 8, color: TE.grey, fontWeight: 700, letterSpacing: 1 }}>FILTER</span>
              </div>
              <Toggle on={!!config.filter} onChange={() => config.filter ? updateFilter(undefined) : updateFilter({ type: 'lowpass', frequency: 2000, q: 1 })} color={TE.cyan} />
            </div>
            {config.filter && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {['lowpass', 'highpass', 'bandpass', 'notch'].map(t => (
                    <Btn key={t} active={config.filter!.type === t} onClick={() => updateFilter({ ...config.filter!, type: t as any })} color={TE.cyan} small>{t.slice(0, 2).toUpperCase()}</Btn>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <MiniKnob value={config.filter.frequency} min={20} max={20000} onChange={v => updateFilter({ ...config.filter!, frequency: v })} label="FREQ" color={TE.cyan} logarithmic />
                  <MiniKnob value={config.filter.q} min={0.1} max={20} onChange={v => updateFilter({ ...config.filter!, q: v })} label="RES" color={TE.cyan} />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 7, color: TE.grey, fontWeight: 700 }}>ENV</span>
                  <Toggle on={!!config.filter.envelope} onChange={() => updateFilter({ ...config.filter!, envelope: config.filter!.envelope ? undefined : { amount: 2000, attack: 0.01, decay: 0.2, sustain: 0, release: 0.3 } })} color={TE.cyan} />
                  {config.filter.envelope && (
                    <>
                      <MiniKnob value={config.filter.envelope.amount} min={-10000} max={10000} onChange={v => updateFilter({ ...config.filter!, envelope: { ...config.filter!.envelope!, amount: v } })} label="AMT" color={TE.cyan} />
                      <MiniKnob value={config.filter.envelope.attack * 1000} min={1} max={2000} onChange={v => updateFilter({ ...config.filter!, envelope: { ...config.filter!.envelope!, attack: v / 1000 } })} label="A" color={TE.cyan} />
                      <MiniKnob value={config.filter.envelope.decay * 1000} min={1} max={2000} onChange={v => updateFilter({ ...config.filter!, envelope: { ...config.filter!.envelope!, decay: v / 1000 } })} label="D" color={TE.cyan} />
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* DYNAMICS */}
          <div style={{ background: TE.panel, borderRadius: 4, padding: 10, border: `1px solid ${TE.border}` }}>
            <span style={{ fontSize: 8, color: TE.grey, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 8 }}>DYNAMICS</span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <MiniKnob value={velocity} min={0} max={1} onChange={setVelocity} label="VELOCITY" color={TE.orange} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 7, color: TE.grey, fontWeight: 700 }}>NORM</span>
                <Toggle on={normalize} onChange={() => setNormalize(!normalize)} color={TE.orange} />
              </div>
            </div>
          </div>

          {/* EFFECTS */}
          <Section title="EFFECTS">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Effect name="DISTORT" on={!!config.effects.distortion} onToggle={() => config.effects.distortion ? updateEffects({ ...config.effects, distortion: undefined }) : updateEffects({ ...config.effects, distortion: { type: 'soft', amount: 0.5, mix: 0.5 } })} color={TE.orange}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {['soft', 'hard', 'fuzz'].map(t => (
                    <Btn key={t} active={config.effects.distortion?.type === t} onClick={() => updateEffects({ ...config.effects, distortion: { ...config.effects.distortion!, type: t as any } })} color={TE.orange} small>{t.slice(0, 2).toUpperCase()}</Btn>
                  ))}
                </div>
                <MiniKnob value={config.effects.distortion?.amount || 0.5} min={0} max={1} onChange={v => updateEffects({ ...config.effects, distortion: { ...config.effects.distortion!, amount: v } })} label="AMT" color={TE.orange} />
                <MiniKnob value={config.effects.distortion?.mix || 0.5} min={0} max={1} onChange={v => updateEffects({ ...config.effects, distortion: { ...config.effects.distortion!, mix: v } })} label="MIX" color={TE.orange} />
              </Effect>

              <Effect name="REVERB" on={!!config.effects.reverb} onToggle={() => config.effects.reverb ? updateEffects({ ...config.effects, reverb: undefined }) : updateEffects({ ...config.effects, reverb: { decay: 2, damping: 0.5, mix: 0.3 } })} color={TE.pink}>
                <MiniKnob value={config.effects.reverb?.decay || 2} min={0.1} max={10} onChange={v => updateEffects({ ...config.effects, reverb: { ...config.effects.reverb!, decay: v } })} label="DECAY" color={TE.pink} />
                <MiniKnob value={config.effects.reverb?.damping || 0.5} min={0} max={1} onChange={v => updateEffects({ ...config.effects, reverb: { ...config.effects.reverb!, damping: v } })} label="DAMP" color={TE.pink} />
                <MiniKnob value={config.effects.reverb?.mix || 0.3} min={0} max={1} onChange={v => updateEffects({ ...config.effects, reverb: { ...config.effects.reverb!, mix: v } })} label="MIX" color={TE.pink} />
              </Effect>

              <Effect name="DELAY" on={!!config.effects.delay} onToggle={() => config.effects.delay ? updateEffects({ ...config.effects, delay: undefined }) : updateEffects({ ...config.effects, delay: { time: 0.25, feedback: 0.5, mix: 0.3 } })} color={TE.cyan}>
                <MiniKnob value={(config.effects.delay?.time || 0.25) * 1000} min={10} max={2000} onChange={v => updateEffects({ ...config.effects, delay: { ...config.effects.delay!, time: v / 1000 } })} label="TIME" color={TE.cyan} />
                <MiniKnob value={config.effects.delay?.feedback || 0.5} min={0} max={0.95} onChange={v => updateEffects({ ...config.effects, delay: { ...config.effects.delay!, feedback: v } })} label="FB" color={TE.cyan} />
                <MiniKnob value={config.effects.delay?.mix || 0.3} min={0} max={1} onChange={v => updateEffects({ ...config.effects, delay: { ...config.effects.delay!, mix: v } })} label="MIX" color={TE.cyan} />
              </Effect>

              <Effect name="COMPRESS" on={!!config.effects.compressor} onToggle={() => config.effects.compressor ? updateEffects({ ...config.effects, compressor: undefined }) : updateEffects({ ...config.effects, compressor: { threshold: -20, ratio: 4, attack: 0.003, release: 0.25, knee: 30 } })} color={TE.yellow}>
                <MiniKnob value={config.effects.compressor?.threshold || -20} min={-60} max={0} onChange={v => updateEffects({ ...config.effects, compressor: { ...config.effects.compressor!, threshold: v } })} label="THRS" color={TE.yellow} />
                <MiniKnob value={config.effects.compressor?.ratio || 4} min={1} max={20} onChange={v => updateEffects({ ...config.effects, compressor: { ...config.effects.compressor!, ratio: v } })} label="RATIO" color={TE.yellow} />
                <MiniKnob value={(config.effects.compressor?.attack || 0.003) * 1000} min={0.1} max={100} onChange={v => updateEffects({ ...config.effects, compressor: { ...config.effects.compressor!, attack: v / 1000 } })} label="ATK" color={TE.yellow} />
                <MiniKnob value={(config.effects.compressor?.release || 0.25) * 1000} min={10} max={1000} onChange={v => updateEffects({ ...config.effects, compressor: { ...config.effects.compressor!, release: v / 1000 } })} label="REL" color={TE.yellow} />
              </Effect>

              <Effect name="GATE" on={!!config.effects.gate} onToggle={() => config.effects.gate ? updateEffects({ ...config.effects, gate: undefined }) : updateEffects({ ...config.effects, gate: { attack: 0.001, hold: 0.2, release: 0.05 } })} color={TE.green}>
                <MiniKnob value={(config.effects.gate?.attack || 0.001) * 1000} min={0.1} max={50} onChange={v => updateEffects({ ...config.effects, gate: { ...config.effects.gate!, attack: v / 1000 } })} label="ATK" color={TE.green} />
                <MiniKnob value={(config.effects.gate?.hold || 0.2) * 1000} min={10} max={1000} onChange={v => updateEffects({ ...config.effects, gate: { ...config.effects.gate!, hold: v / 1000 } })} label="HOLD" color={TE.green} />
                <MiniKnob value={(config.effects.gate?.release || 0.05) * 1000} min={5} max={500} onChange={v => updateEffects({ ...config.effects, gate: { ...config.effects.gate!, release: v / 1000 } })} label="REL" color={TE.green} />
              </Effect>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
