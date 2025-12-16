/**
 * SynthesizerUI - Teenage Engineering Inspired Design with JSON Editor
 * Fully Responsive - Mobile, Tablet, Desktop
 * Supports MIDI input for live playing
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Collapse, Container, Paper, Stack, useMediaQuery } from '@mui/material';
import { JSONEditor } from '../components/JSONEditor';
import { ValidationDisplay } from '../components/ValidationDisplay';
import { useDefaultPreset } from '../hooks/useDefaultPreset';
import { synthesizeSound } from '../audio/synthesizer';
import { validateSoundConfigJSON, type ValidationResult } from '../utils/validation';
import { generateSoundConfig, type AIProvider } from '../services/ai';
import { useThemeMode } from '../context/ThemeContext';
import { TE_COLORS } from '../theme';
import type { SoundConfig } from '../types/soundConfig';
import { useMidi, midiNoteToName, type MidiNote } from '../hooks/useMidi';
import { RealtimeSynth } from '../audio/realtimeSynth';

// ═══════════════════════════════════════════════════════════════════════════════
// THEME-AWARE DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

const createThemeTokens = (isDark: boolean) => ({
  // Backgrounds
  bg: isDark ? TE_COLORS.dark.bg : '#f4f2ef',
  surface: isDark ? TE_COLORS.dark.surface : '#eae7e3',
  panel: isDark ? TE_COLORS.dark.panel : '#ffffff',
  panelAlt: isDark ? TE_COLORS.dark.panelAlt : '#f8f8f8',
  
  // Text
  black: isDark ? TE_COLORS.dark.text : '#1a1a1a',
  dark: isDark ? TE_COLORS.dark.textSecondary : '#3a3a3a',
  grey: isDark ? TE_COLORS.dark.textMuted : '#888888',
  light: isDark ? '#505060' : '#c0c0c0',
  
  // Accent colors
  orange: TE_COLORS.orange,
  yellow: TE_COLORS.yellow,
  cyan: TE_COLORS.cyan,
  green: TE_COLORS.green,
  pink: TE_COLORS.pink,
  
  // Borders
  border: isDark ? TE_COLORS.dark.border : '#d0d0d0',
  borderDark: isDark ? TE_COLORS.dark.borderLight : '#a0a0a0',
  
  // Special
  scopeBg: isDark ? '#0f0f12' : '#1a1a1a',
  scopeGrid: isDark ? '#252530' : '#333',
  inputBg: isDark ? TE_COLORS.dark.surface : '#fff',
  knobBg: isDark ? TE_COLORS.dark.surfaceAlt : '#eae7e3',
  knobShadow: isDark ? 'inset 0 2px 4px rgba(0,0,0,0.3)' : 'inset 0 1px 2px rgba(0,0,0,0.1)',
  toggleBg: isDark ? TE_COLORS.dark.surface : '#eae7e3',
  headerGradient: isDark 
    ? `linear-gradient(180deg, ${TE_COLORS.dark.panel}f0 0%, ${TE_COLORS.dark.panel}e0 100%)`
    : TE_COLORS.light.panel,
  moduleBg: (color: string, active: boolean) => isDark
    ? active ? `${color}10` : TE_COLORS.dark.surface
    : active ? `${color}08` : '#eae7e3',
  errorBg: isDark ? '#ff475715' : '#fff3f3',
  errorBorder: isDark ? '#ff475740' : '#ffcccc',
  errorText: isDark ? '#ff6b7a' : '#cc0000',
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSIVE BREAKPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

const BREAKPOINTS = {
  mobile: 600,
  tablet: 800,
  desktop: 1024,
};

// Breakpoints are used inline in useMediaQuery calls

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
  size?: 'small' | 'medium' | 'large';
  TE: ReturnType<typeof createThemeTokens>;
}

function MiniKnob({ value, min, max, onChange, label, color, logarithmic, disabled, size = 'small', TE }: MiniKnobProps) {
  const knobColor = color || TE.orange;
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const dragStart = useRef({ y: 0, value: 0 });
  const hasDragged = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalized = logarithmic
    ? Math.log(Math.max(min, value) / min) / Math.log(max / min)
    : (value - min) / (max - min);
  const rotation = normalized * 270 - 135;

  // Size configurations for responsive knobs
  // Note: valueSize must be 16px+ on mobile to prevent iOS zoom on focus
  const sizes = {
    small: { knob: 24, indicator: 3, indicatorTop: 3, origin: 9, labelSize: 6, valueSize: 9 },
    medium: { knob: 32, indicator: 4, indicatorTop: 4, origin: 12, labelSize: 7, valueSize: 11 },
    large: { knob: 44, indicator: 5, indicatorTop: 6, origin: 16, labelSize: 9, valueSize: 16 },
  };
  const s = sizes[size];

  const handleStart = (clientY: number) => {
    if (disabled || editing) return;
    setDragging(true);
    hasDragged.current = false;
    dragStart.current = { y: clientY, value };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    handleStart(e.touches[0].clientY);
  };

  const handleInputSubmit = () => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      onChange(Math.max(min, Math.min(max, parsed)));
    }
    setEditing(false);
  };

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (clientY: number) => {
      const delta = dragStart.current.y - clientY;
      // Mark as dragged if moved more than 3 pixels
      if (Math.abs(delta) > 3) {
        hasDragged.current = true;
      }
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

    const moveHandler = (e: MouseEvent) => handleMove(e.clientY);
    const touchMoveHandler = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientY);
    };
    const up = () => {
      // If we didn't drag, treat as click and enter edit mode
      if (!hasDragged.current) {
        setEditing(true);
        setInputValue(value.toString());
      }
      setDragging(false);
    };

    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', touchMoveHandler, { passive: false });
    window.addEventListener('touchend', up);

    return () => {
      window.removeEventListener('mousemove', moveHandler);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', touchMoveHandler);
      window.removeEventListener('touchend', up);
    };
  }, [dragging, min, max, onChange, logarithmic, value]);

  const display = value >= 1000 ? `${(value/1000).toFixed(1)}k` : value >= 100 ? value.toFixed(0) : value >= 1 ? value.toFixed(1) : value.toFixed(2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, userSelect: 'none', opacity: disabled ? 0.4 : 1, touchAction: 'none' }}>
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{
          width: s.knob, height: s.knob, borderRadius: '50%',
          background: TE.knobBg, border: `2px solid ${TE.borderDark}`,
          position: 'relative', cursor: disabled ? 'default' : dragging ? 'grabbing' : 'grab',
          boxShadow: TE.knobShadow,
        }}
      >
        <div style={{
          position: 'absolute', width: s.indicator, height: s.indicator, background: knobColor, borderRadius: '50%',
          top: s.indicatorTop, left: '50%', transformOrigin: `0 ${s.origin}px`, transform: `translateX(-50%) rotate(${rotation}deg)`,
          boxShadow: `0 0 4px ${knobColor}60`,
        }} />
      </div>
      <span style={{ fontSize: s.labelSize, color: TE.grey, fontWeight: 700, letterSpacing: 0.3 }}>{label}</span>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleInputSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleInputSubmit();
            else if (e.key === 'Escape') setEditing(false);
          }}
          style={{
            width: s.knob + 16,
            fontSize: s.valueSize,
            fontWeight: 700,
            textAlign: 'center',
            border: `1px solid ${knobColor}`,
            borderRadius: 3,
            padding: '1px 2px',
            outline: 'none',
            background: TE.surface,
            color: TE.black,
          }}
          step="any"
        />
      ) : (
        <span
          style={{ fontSize: s.valueSize, color: TE.black, fontWeight: 700, cursor: 'pointer' }}
          onClick={() => {
            setEditing(true);
            setInputValue(value.toString());
          }}
        >
          {display}
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function LED({ on, color, size = 'small', TE }: { on: boolean; color?: string; size?: 'small' | 'medium'; TE: ReturnType<typeof createThemeTokens> }) {
  const s = size === 'small' ? 5 : 8;
  const ledColor = color || TE.orange;
  return <div style={{ width: s, height: s, borderRadius: '50%', background: on ? ledColor : TE.light, boxShadow: on ? `0 0 6px ${ledColor}` : 'none', transition: 'all 0.2s ease' }} />;
}

function Toggle({ on, onChange, color, size = 'small', TE }: { on: boolean; onChange: () => void; color?: string; size?: 'small' | 'medium' | 'large'; TE: ReturnType<typeof createThemeTokens> }) {
  const toggleColor = color || TE.orange;
  const sizes = {
    small: { width: 28, height: 14, thumb: 10, thumbTop: 2, thumbOn: 15, thumbOff: 2 },
    medium: { width: 36, height: 18, thumb: 14, thumbTop: 2, thumbOn: 19, thumbOff: 2 },
    large: { width: 44, height: 24, thumb: 20, thumbTop: 2, thumbOn: 22, thumbOff: 2 },
  };
  const s = sizes[size];
  return (
    <button onClick={onChange} style={{
      width: s.width, height: s.height, borderRadius: s.height / 2, border: 'none',
      background: on ? toggleColor : TE.toggleBg, cursor: 'pointer', position: 'relative',
      touchAction: 'manipulation',
      boxShadow: on ? `0 0 8px ${toggleColor}40` : 'inset 0 1px 2px rgba(0,0,0,0.15)',
      transition: 'all 0.2s ease',
    }}>
      <div style={{
        width: s.thumb, height: s.thumb, background: '#fff', borderRadius: '50%',
        position: 'absolute', top: s.thumbTop, left: on ? s.thumbOn : s.thumbOff, transition: 'left 0.15s ease-out',
        boxShadow: on ? `0 1px 3px rgba(0,0,0,0.3)` : '0 1px 2px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

function Btn({ children, active, onClick, color, small, size = 'small', TE }: { children: React.ReactNode; active?: boolean; onClick: () => void; color?: string; small?: boolean; size?: 'small' | 'medium' | 'large'; TE: ReturnType<typeof createThemeTokens> }) {
  const btnColor = color || TE.orange;
  const sizes = {
    small: { padding: small ? '3px 6px' : '4px 8px', fontSize: small ? 8 : 9 },
    medium: { padding: '6px 10px', fontSize: 10 },
    large: { padding: '8px 14px', fontSize: 11 },
  };
  const s = sizes[size];
  return (
    <button onClick={onClick} style={{
      padding: s.padding,
      background: active ? btnColor : TE.panel, 
      border: `1px solid ${active ? btnColor : TE.border}`,
      borderRadius: 3, 
      color: active ? '#fff' : TE.dark,
      fontSize: s.fontSize, fontWeight: 700, cursor: 'pointer',
      touchAction: 'manipulation',
      minHeight: size === 'large' ? 36 : size === 'medium' ? 28 : undefined,
      boxShadow: active ? `0 0 8px ${btnColor}30` : 'none',
      transition: 'all 0.15s ease',
    }}>{children}</button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCOPE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

function ScopeDisplay({ audioBuffer, TE }: { audioBuffer: AudioBuffer | null; TE: ReturnType<typeof createThemeTokens> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // ResizeObserver to track container width changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw waveform when container size or audio changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || containerWidth === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = containerWidth;
    const h = 60;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = TE.scopeBg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = TE.scopeGrid;
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, h / 2 + 0.5); ctx.lineTo(w, h / 2 + 0.5); ctx.stroke();

    if (audioBuffer) {
      const data = audioBuffer.getChannelData(0);
      const step = Math.ceil(data.length / w);
      
      // Glow effect
      ctx.shadowColor = TE.orange;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = TE.orange;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const y = (1 - (data[x * step] + 1) / 2) * h;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [audioBuffer, TE, containerWidth]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: 60 }}>
      <canvas ref={canvasRef} style={{ borderRadius: 4, display: 'block' }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENVELOPE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

function EnvelopeDisplay({ attack, decay, sustain, release, color, TE }: { attack: number; decay: number; sustain: number; release: number; color?: string; TE: ReturnType<typeof createThemeTokens> }) {
  const envColor = color || TE.green;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // ResizeObserver to track container width changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw envelope when container size or params change
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || containerWidth === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = containerWidth;
    const h = 60;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = TE.scopeBg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = TE.scopeGrid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2 + 0.5);
    ctx.lineTo(w, h / 2 + 0.5);
    ctx.stroke();

    const total = attack + decay + release + 0.3;
    const scale = w / total;
    const pad = 4;

    ctx.fillStyle = `${envColor}20`;
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

    // Glow effect
    ctx.shadowColor = envColor;
    ctx.shadowBlur = 6;
    ctx.strokeStyle = envColor;
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
    ctx.shadowBlur = 0;

    ctx.fillStyle = envColor;
    [[attack * scale, pad], [(attack + decay) * scale, pad + (1 - sustain) * (h - pad * 2)]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [attack, decay, sustain, release, envColor, TE, containerWidth]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: 60 }}>
      <canvas ref={canvasRef} style={{ borderRadius: 4, display: 'block' }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER CONFIG - moved inside LayerPanel for theme-awareness
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE & LAYER PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function Module({ label, color, on, onToggle, children, isMobile = false, toggleSize = 'small' as const, TE }: { label: string; color: string; on?: boolean; onToggle?: () => void; children: React.ReactNode; isMobile?: boolean; toggleSize?: 'small' | 'medium' | 'large'; TE: ReturnType<typeof createThemeTokens> }) {
  const isToggleable = onToggle !== undefined;
  const isActive = on !== false;
  return (
    <div style={{
      background: TE.moduleBg(color, isActive),
      border: `1px solid ${isActive ? `${color}40` : TE.border}`,
      borderRadius: 4,
      padding: isMobile ? '10px 12px' : '6px 8px',
      opacity: isActive ? 1 : 0.5,
      minWidth: 0,
      transition: 'all 0.2s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isActive ? (isMobile ? 10 : 6) : 0 }}>
        <span style={{ fontSize: isMobile ? 9 : 7, fontWeight: 800, color: isActive ? color : TE.grey, letterSpacing: 0.5 }}>{label}</span>
        {isToggleable && <Toggle on={!!on} onChange={onToggle} color={color} size={toggleSize} TE={TE} />}
      </div>
      {isActive && <div style={{ display: 'flex', gap: isMobile ? 10 : 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>{children}</div>}
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
  isMobile?: boolean;
  isTablet?: boolean;
  knobSize?: 'small' | 'medium' | 'large';
  btnSize?: 'small' | 'medium' | 'large';
  toggleSize?: 'small' | 'medium' | 'large';
  TE: ReturnType<typeof createThemeTokens>;
}

function LayerPanel({ layer, index, selected, onSelect, onUpdate, onRemove, canRemove, isMobile = false, isTablet = false, knobSize = 'small', btnSize = 'small', toggleSize = 'small', TE }: LayerPanelProps) {
  const LAYER_CFG: Record<string, { icon: string; color: string; label: string }> = {
    oscillator: { icon: '◐', color: TE.orange, label: 'OSC' },
    noise: { icon: '▒', color: TE.pink, label: 'NSE' },
    fm: { icon: '◎', color: TE.cyan, label: 'FM' },
    'karplus-strong': { icon: '◉', color: TE.green, label: 'KS' },
  };
  const cfg = LAYER_CFG[layer.type] || LAYER_CFG.oscillator;
  const updateOsc = (patch: Partial<NonNullable<LayerType['oscillator']>>) => {
    onUpdate({ ...layer, oscillator: { ...layer.oscillator!, ...patch } });
  };

  return (
    <div style={{
      background: selected ? TE.panel : TE.surface,
      border: `1px solid ${selected ? cfg.color : TE.border}`,
      borderRadius: 6,
      boxShadow: selected ? `0 4px 16px ${cfg.color}15` : 'none', 
      overflow: 'hidden',
      transition: 'all 0.2s ease',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '10px 12px' : '6px 10px',
        background: selected ? `linear-gradient(90deg, ${cfg.color}15, transparent)` : 'transparent',
        borderBottom: selected ? `1px solid ${TE.border}` : 'none',
        flexWrap: 'wrap',
        gap: 8,
        minWidth: 0,
      }}>
        <div onClick={onSelect} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 8, minWidth: 0, flexShrink: 0, cursor: 'pointer' }}>
          <div style={{
            width: isMobile ? 28 : 20,
            height: isMobile ? 28 : 20,
            borderRadius: 3,
            background: cfg.color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isMobile ? 13 : 11,
            fontWeight: 700,
            flexShrink: 0,
          }}>{index + 1}</div>
          <span style={{ fontSize: isMobile ? 12 : 10, fontWeight: 700, color: TE.black }}>{cfg.label}</span>
          <span style={{ fontSize: isMobile ? 14 : 11, color: cfg.color }}>{cfg.icon}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 6, flex: '1 1 auto', minWidth: 100 }} onClick={e => e.stopPropagation()}>
          <input type="range" min={0} max={1} step={0.01} value={layer.gain} onChange={e => onUpdate({ ...layer, gain: parseFloat(e.target.value) })} style={{ flex: 1, minWidth: 60, height: isMobile ? 8 : 4, accentColor: cfg.color }} />
          <span style={{ fontSize: isMobile ? 11 : 9, fontWeight: 700, color: TE.dark, minWidth: 32, textAlign: 'right', flexShrink: 0 }}>{(layer.gain * 100).toFixed(0)}%</span>
          {canRemove && <button onClick={onRemove} style={{ width: isMobile ? 32 : 20, height: isMobile ? 32 : 20, border: 'none', background: `${TE.pink}20`, borderRadius: 2, fontSize: isMobile ? 14 : 10, color: TE.pink, cursor: 'pointer', fontWeight: 700, touchAction: 'manipulation', flexShrink: 0 }}>×</button>}
        </div>
      </div>

      {selected && (
        <div style={{ padding: isMobile ? 12 : 10, overflow: 'hidden' }}>
          {layer.type === 'oscillator' && layer.oscillator && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: isMobile ? 10 : 8 }}>
              <Module label="OSCILLATOR" color={cfg.color} isMobile={isMobile} TE={TE}>
                <div style={{ display: 'flex', gap: isMobile ? 6 : 2, marginRight: 8, flexWrap: 'wrap' }}>
                  {['sine', 'square', 'sawtooth', 'triangle'].map(wf => (
                    <Btn key={wf} active={layer.oscillator!.waveform === wf} onClick={() => updateOsc({ waveform: wf as any })} color={cfg.color} small size={btnSize} TE={TE}>
                      {wf === 'sine' ? '∿' : wf === 'square' ? '⊓' : wf === 'sawtooth' ? '⋰' : '△'}
                    </Btn>
                  ))}
                </div>
                <MiniKnob value={layer.oscillator.frequency} min={20} max={20000} onChange={v => updateOsc({ frequency: v })} label="FREQ" color={cfg.color} logarithmic size={knobSize} TE={TE} />
                <MiniKnob value={layer.oscillator.detune} min={-100} max={100} onChange={v => updateOsc({ detune: v })} label="DET" color={cfg.color} size={knobSize} TE={TE} />
              </Module>
              <Module label="UNISON" color={cfg.color} isMobile={isMobile} TE={TE}>
                <MiniKnob value={layer.oscillator.unison?.voices || 1} min={1} max={8} onChange={v => updateOsc({ unison: { voices: Math.round(v), detune: layer.oscillator!.unison?.detune || 0, spread: layer.oscillator!.unison?.spread || 0 } })} label="VOX" color={cfg.color} size={knobSize} TE={TE} />
                <MiniKnob value={layer.oscillator.unison?.detune || 0} min={0} max={100} onChange={v => updateOsc({ unison: { voices: layer.oscillator!.unison?.voices || 1, detune: v, spread: layer.oscillator!.unison?.spread || 0 } })} label="DET" color={cfg.color} size={knobSize} TE={TE} />
                <MiniKnob value={layer.oscillator.unison?.spread || 0} min={0} max={1} onChange={v => updateOsc({ unison: { voices: layer.oscillator!.unison?.voices || 1, detune: layer.oscillator!.unison?.detune || 0, spread: v } })} label="WID" color={cfg.color} size={knobSize} TE={TE} />
              </Module>
              <Module label="SUB" color={TE.pink} on={!!layer.oscillator.sub} onToggle={() => updateOsc({ sub: layer.oscillator!.sub ? undefined : { level: 0.5, octave: -1, waveform: 'sine' } })} isMobile={isMobile} TE={TE}>
                {layer.oscillator.sub && <>
                  <MiniKnob value={layer.oscillator.sub.level} min={0} max={1} onChange={v => updateOsc({ sub: { ...layer.oscillator!.sub!, level: v } })} label="LVL" color={TE.pink} size={knobSize} TE={TE} />
                  <div style={{ display: 'flex', gap: isMobile ? 6 : 2, flexWrap: 'wrap' }}>
                    {(['sine', 'square', 'triangle'] as const).map(wf => (
                      <Btn key={wf} active={(layer.oscillator!.sub!.waveform || 'sine') === wf} onClick={() => updateOsc({ sub: { ...layer.oscillator!.sub!, waveform: wf } })} color={TE.pink} small size={btnSize} TE={TE}>
                        {wf === 'sine' ? '∿' : wf === 'square' ? '⊓' : '△'}
                      </Btn>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: isMobile ? 6 : 2 }}>
                    <Btn active={layer.oscillator.sub.octave === -1} onClick={() => updateOsc({ sub: { ...layer.oscillator!.sub!, octave: -1 } })} color={TE.pink} small size={btnSize} TE={TE}>-1</Btn>
                    <Btn active={layer.oscillator.sub.octave === -2} onClick={() => updateOsc({ sub: { ...layer.oscillator!.sub!, octave: -2 } })} color={TE.pink} small size={btnSize} TE={TE}>-2</Btn>
                  </div>
                </>}
              </Module>
              <Module label="ENVELOPE" color={TE.green} on={!!layer.envelope} onToggle={() => onUpdate({ ...layer, envelope: layer.envelope ? undefined : { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 } })} isMobile={isMobile} TE={TE}>
                {layer.envelope && <>
                  <MiniKnob value={layer.envelope.attack * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, attack: v / 1000 } })} label="A" color={TE.green} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.envelope.decay * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, decay: v / 1000 } })} label="D" color={TE.green} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.envelope.sustain} min={0} max={1} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, sustain: v } })} label="S" color={TE.green} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.envelope.release * 1000} min={1} max={5000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, release: v / 1000 } })} label="R" color={TE.green} size={knobSize} TE={TE} />
                </>}
              </Module>
              <Module label="FILTER" color={TE.cyan} on={!!layer.filter} onToggle={() => onUpdate({ ...layer, filter: layer.filter ? undefined : { type: 'lowpass', frequency: 2000, q: 1 } })} isMobile={isMobile} TE={TE}>
                {layer.filter && <>
                  <div style={{ display: 'flex', gap: isMobile ? 6 : 2, flexWrap: 'wrap' }}>
                    {['lowpass', 'highpass', 'bandpass', 'notch'].map(t => (
                      <Btn key={t} active={layer.filter!.type === t} onClick={() => onUpdate({ ...layer, filter: { ...layer.filter!, type: t as any } })} color={TE.cyan} small size={btnSize} TE={TE}>{t.slice(0, 2).toUpperCase()}</Btn>
                    ))}
                  </div>
                  <MiniKnob value={layer.filter.frequency} min={20} max={20000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, frequency: v } })} label="FRQ" color={TE.cyan} logarithmic size={knobSize} TE={TE} />
                  <MiniKnob value={layer.filter.q} min={0.1} max={20} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, q: v } })} label="Q" color={TE.cyan} size={knobSize} TE={TE} />
                  <div style={{ display: 'flex', gap: isMobile ? 10 : 6, alignItems: 'center', flexWrap: 'wrap', marginTop: isMobile ? 8 : 4 }}>
                    <span style={{ fontSize: isMobile ? 9 : 7, color: TE.grey, fontWeight: 700 }}>ENV</span>
                    <Toggle on={!!layer.filter.envelope} onChange={() => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: layer.filter!.envelope ? undefined : { amount: 2000, attack: 0.01, decay: 0.2, sustain: 0, release: 0.3 } } })} color={TE.cyan} size={toggleSize} TE={TE} />
                    {layer.filter.envelope && <>
                      <MiniKnob value={layer.filter.envelope.amount} min={-10000} max={10000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, amount: v } } })} label="AMT" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={layer.filter.envelope.attack * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, attack: v / 1000 } } })} label="A" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={layer.filter.envelope.decay * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, decay: v / 1000 } } })} label="D" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={layer.filter.envelope.sustain} min={0} max={1} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, sustain: v } } })} label="S" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={layer.filter.envelope.release * 1000} min={1} max={5000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, release: v / 1000 } } })} label="R" color={TE.cyan} size={knobSize} TE={TE} />
                    </>}
                  </div>
                </>}
              </Module>
              <Module label="SATURATION" color={TE.yellow} on={!!layer.saturation} onToggle={() => onUpdate({ ...layer, saturation: layer.saturation ? undefined : { type: 'soft', drive: 2, mix: 0.5 } })} isMobile={isMobile} TE={TE}>
                {layer.saturation && <>
                  <div style={{ display: 'flex', gap: isMobile ? 6 : 2, flexWrap: 'wrap' }}>
                    {['soft', 'hard', 'tube', 'tape'].map(t => (
                      <Btn key={t} active={layer.saturation!.type === t} onClick={() => onUpdate({ ...layer, saturation: { ...layer.saturation!, type: t as any } })} color={TE.yellow} small size={btnSize} TE={TE}>{t.slice(0, 2).toUpperCase()}</Btn>
                    ))}
                  </div>
                  <MiniKnob value={layer.saturation.drive} min={0} max={10} onChange={v => onUpdate({ ...layer, saturation: { ...layer.saturation!, drive: v } })} label="DRV" color={TE.yellow} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.saturation.mix} min={0} max={1} onChange={v => onUpdate({ ...layer, saturation: { ...layer.saturation!, mix: v } })} label="MIX" color={TE.yellow} size={knobSize} TE={TE} />
                </>}
              </Module>
              <Module label="PITCH ENV" color={cfg.color} on={!!layer.oscillator?.pitchEnvelope} onToggle={() => updateOsc({ pitchEnvelope: layer.oscillator!.pitchEnvelope ? undefined : { amount: 1200, attack: 0, decay: 0.1, sustain: 0, release: 0.1 } })} isMobile={isMobile} toggleSize={toggleSize} TE={TE}>
                {layer.oscillator?.pitchEnvelope && <>
                  <MiniKnob value={layer.oscillator.pitchEnvelope.amount} min={-4800} max={4800} onChange={v => updateOsc({ pitchEnvelope: { ...layer.oscillator!.pitchEnvelope!, amount: v } })} label="AMT" color={cfg.color} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.oscillator.pitchEnvelope.attack * 1000} min={0} max={500} onChange={v => updateOsc({ pitchEnvelope: { ...layer.oscillator!.pitchEnvelope!, attack: v / 1000 } })} label="A" color={cfg.color} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.oscillator.pitchEnvelope.decay * 1000} min={1} max={2000} onChange={v => updateOsc({ pitchEnvelope: { ...layer.oscillator!.pitchEnvelope!, decay: v / 1000 } })} label="D" color={cfg.color} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.oscillator.pitchEnvelope.sustain} min={-2400} max={2400} onChange={v => updateOsc({ pitchEnvelope: { ...layer.oscillator!.pitchEnvelope!, sustain: v } })} label="S" color={cfg.color} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.oscillator.pitchEnvelope.release * 1000} min={1} max={2000} onChange={v => updateOsc({ pitchEnvelope: { ...layer.oscillator!.pitchEnvelope!, release: v / 1000 } })} label="R" color={cfg.color} size={knobSize} TE={TE} />
                </>}
              </Module>
            </div>
          )}

          {layer.type === 'fm' && layer.fm && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: isMobile ? 10 : 8 }}>
              <Module label="FM SYNTHESIS" color={cfg.color} isMobile={isMobile} TE={TE}>
                <MiniKnob value={layer.fm.carrier} min={20} max={20000} onChange={v => onUpdate({ ...layer, fm: { ...layer.fm!, carrier: v } })} label="CAR" color={cfg.color} logarithmic size={knobSize} TE={TE} />
                <MiniKnob value={layer.fm.modulator} min={20} max={20000} onChange={v => onUpdate({ ...layer, fm: { ...layer.fm!, modulator: v } })} label="MOD" color={cfg.color} logarithmic size={knobSize} TE={TE} />
                <MiniKnob value={layer.fm.modulationIndex} min={0} max={100} onChange={v => onUpdate({ ...layer, fm: { ...layer.fm!, modulationIndex: v } })} label="IDX" color={cfg.color} size={knobSize} TE={TE} />
              </Module>
              <Module label="ENVELOPE" color={TE.green} on={!!layer.envelope} onToggle={() => onUpdate({ ...layer, envelope: layer.envelope ? undefined : { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 } })} isMobile={isMobile} TE={TE}>
                {layer.envelope && <>
                  <MiniKnob value={layer.envelope.attack * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, attack: v / 1000 } })} label="A" color={TE.green} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.envelope.decay * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, decay: v / 1000 } })} label="D" color={TE.green} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.envelope.sustain} min={0} max={1} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, sustain: v } })} label="S" color={TE.green} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.envelope.release * 1000} min={1} max={5000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, release: v / 1000 } })} label="R" color={TE.green} size={knobSize} TE={TE} />
                </>}
              </Module>
              <Module label="FILTER" color={TE.cyan} on={!!layer.filter} onToggle={() => onUpdate({ ...layer, filter: layer.filter ? undefined : { type: 'lowpass', frequency: 2000, q: 1 } })} isMobile={isMobile} TE={TE}>
                {layer.filter && <>
                  <div style={{ display: 'flex', gap: isMobile ? 6 : 2, flexWrap: 'wrap' }}>
                    {['lowpass', 'highpass', 'bandpass', 'notch'].map(t => (
                      <Btn key={t} active={layer.filter!.type === t} onClick={() => onUpdate({ ...layer, filter: { ...layer.filter!, type: t as any } })} color={TE.cyan} small size={btnSize} TE={TE}>{t.slice(0, 2).toUpperCase()}</Btn>
                    ))}
                  </div>
                  <MiniKnob value={layer.filter.frequency} min={20} max={20000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, frequency: v } })} label="FRQ" color={TE.cyan} logarithmic size={knobSize} TE={TE} />
                  <MiniKnob value={layer.filter.q} min={0.1} max={20} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, q: v } })} label="Q" color={TE.cyan} size={knobSize} TE={TE} />
                  <div style={{ display: 'flex', gap: isMobile ? 10 : 6, alignItems: 'center', flexWrap: 'wrap', marginTop: isMobile ? 8 : 4 }}>
                    <span style={{ fontSize: isMobile ? 9 : 7, color: TE.grey, fontWeight: 700 }}>ENV</span>
                    <Toggle on={!!layer.filter.envelope} onChange={() => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: layer.filter!.envelope ? undefined : { amount: 2000, attack: 0.01, decay: 0.2, sustain: 0, release: 0.3 } } })} color={TE.cyan} size={toggleSize} TE={TE} />
                    {layer.filter.envelope && <>
                      <MiniKnob value={layer.filter.envelope.amount} min={-10000} max={10000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, amount: v } } })} label="AMT" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={layer.filter.envelope.attack * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, attack: v / 1000 } } })} label="A" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={layer.filter.envelope.decay * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, decay: v / 1000 } } })} label="D" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={layer.filter.envelope.sustain} min={0} max={1} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, sustain: v } } })} label="S" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={layer.filter.envelope.release * 1000} min={1} max={5000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, release: v / 1000 } } })} label="R" color={TE.cyan} size={knobSize} TE={TE} />
                    </>}
                  </div>
                </>}
              </Module>
              <Module label="SATURATION" color={TE.pink} on={!!layer.saturation} onToggle={() => onUpdate({ ...layer, saturation: layer.saturation ? undefined : { type: 'soft', drive: 2, mix: 0.5 } })} isMobile={isMobile} TE={TE}>
                {layer.saturation && <>
                  <div style={{ display: 'flex', gap: isMobile ? 6 : 2, flexWrap: 'wrap' }}>
                    {['soft', 'hard', 'tube', 'tape'].map(t => (
                      <Btn key={t} active={layer.saturation!.type === t} onClick={() => onUpdate({ ...layer, saturation: { ...layer.saturation!, type: t as any } })} color={TE.pink} small size={btnSize} TE={TE}>{t.toUpperCase()}</Btn>
                    ))}
                  </div>
                  <MiniKnob value={layer.saturation.drive} min={0} max={10} onChange={v => onUpdate({ ...layer, saturation: { ...layer.saturation!, drive: v } })} label="DRV" color={TE.pink} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.saturation.mix} min={0} max={1} onChange={v => onUpdate({ ...layer, saturation: { ...layer.saturation!, mix: v } })} label="MIX" color={TE.pink} size={knobSize} TE={TE} />
                </>}
              </Module>
            </div>
          )}

          {layer.type === 'karplus-strong' && layer.karplus && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: isMobile ? 10 : 8 }}>
              <Module label="STRING" color={cfg.color} isMobile={isMobile} TE={TE}>
                <MiniKnob value={layer.karplus.frequency} min={20} max={20000} onChange={v => onUpdate({ ...layer, karplus: { ...layer.karplus!, frequency: v } })} label="FRQ" color={cfg.color} logarithmic size={knobSize} TE={TE} />
                <MiniKnob value={layer.karplus.damping} min={0} max={1} onChange={v => onUpdate({ ...layer, karplus: { ...layer.karplus!, damping: v } })} label="DMP" color={cfg.color} size={knobSize} TE={TE} />
                <MiniKnob value={layer.karplus.inharmonicity ?? 0} min={0} max={1} onChange={v => onUpdate({ ...layer, karplus: { ...layer.karplus!, inharmonicity: v } })} label="INH" color={cfg.color} size={knobSize} TE={TE} />
              </Module>
              <Module label="ENVELOPE" color={TE.green} on={!!layer.envelope} onToggle={() => onUpdate({ ...layer, envelope: layer.envelope ? undefined : { attack: 0.001, decay: 0.1, sustain: 0.5, release: 0.5 } })} isMobile={isMobile} TE={TE}>
                {layer.envelope && <>
                  <MiniKnob value={layer.envelope.attack * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, attack: v / 1000 } })} label="A" color={TE.green} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.envelope.decay * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, decay: v / 1000 } })} label="D" color={TE.green} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.envelope.sustain} min={0} max={1} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, sustain: v } })} label="S" color={TE.green} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.envelope.release * 1000} min={1} max={5000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, release: v / 1000 } })} label="R" color={TE.green} size={knobSize} TE={TE} />
                </>}
              </Module>
              <Module label="FILTER" color={TE.cyan} on={!!layer.filter} onToggle={() => onUpdate({ ...layer, filter: layer.filter ? undefined : { type: 'lowpass', frequency: 4000, q: 1 } })} isMobile={isMobile} TE={TE}>
                {layer.filter && <>
                  <div style={{ display: 'flex', gap: isMobile ? 6 : 2, flexWrap: 'wrap' }}>
                    {['lowpass', 'highpass', 'bandpass', 'notch'].map(t => (
                      <Btn key={t} active={layer.filter!.type === t} onClick={() => onUpdate({ ...layer, filter: { ...layer.filter!, type: t as any } })} color={TE.cyan} small size={btnSize} TE={TE}>{t.slice(0, 2).toUpperCase()}</Btn>
                    ))}
                  </div>
                  <MiniKnob value={layer.filter.frequency} min={20} max={20000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, frequency: v } })} label="FRQ" color={TE.cyan} logarithmic size={knobSize} TE={TE} />
                  <MiniKnob value={layer.filter.q} min={0.1} max={20} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, q: v } })} label="Q" color={TE.cyan} size={knobSize} TE={TE} />
                  <div style={{ display: 'flex', gap: isMobile ? 10 : 6, alignItems: 'center', flexWrap: 'wrap', marginTop: isMobile ? 8 : 4 }}>
                    <span style={{ fontSize: isMobile ? 9 : 7, color: TE.grey, fontWeight: 700 }}>ENV</span>
                    <Toggle on={!!layer.filter.envelope} onChange={() => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: layer.filter!.envelope ? undefined : { amount: -2000, attack: 0.01, decay: 0.5, sustain: 0, release: 0.3 } } })} color={TE.cyan} size={toggleSize} TE={TE} />
                    {layer.filter.envelope && <>
                      <MiniKnob value={layer.filter.envelope.amount} min={-10000} max={10000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, amount: v } } })} label="AMT" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={layer.filter.envelope.attack * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, attack: v / 1000 } } })} label="A" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={layer.filter.envelope.decay * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, decay: v / 1000 } } })} label="D" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={layer.filter.envelope.sustain} min={0} max={1} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, sustain: v } } })} label="S" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={layer.filter.envelope.release * 1000} min={1} max={5000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, release: v / 1000 } } })} label="R" color={TE.cyan} size={knobSize} TE={TE} />
                    </>}
                  </div>
                </>}
              </Module>
              <Module label="SATURATION" color={TE.pink} on={!!layer.saturation} onToggle={() => onUpdate({ ...layer, saturation: layer.saturation ? undefined : { type: 'soft', drive: 2, mix: 0.5 } })} isMobile={isMobile} TE={TE}>
                {layer.saturation && <>
                  <div style={{ display: 'flex', gap: isMobile ? 6 : 2, flexWrap: 'wrap' }}>
                    {['soft', 'hard', 'tube', 'tape'].map(t => (
                      <Btn key={t} active={layer.saturation!.type === t} onClick={() => onUpdate({ ...layer, saturation: { ...layer.saturation!, type: t as any } })} color={TE.pink} small size={btnSize} TE={TE}>{t.toUpperCase()}</Btn>
                    ))}
                  </div>
                  <MiniKnob value={layer.saturation.drive} min={0} max={10} onChange={v => onUpdate({ ...layer, saturation: { ...layer.saturation!, drive: v } })} label="DRV" color={TE.pink} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.saturation.mix} min={0} max={1} onChange={v => onUpdate({ ...layer, saturation: { ...layer.saturation!, mix: v } })} label="MIX" color={TE.pink} size={knobSize} TE={TE} />
                </>}
              </Module>
            </div>
          )}

          {layer.type === 'noise' && layer.noise && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: isMobile ? 10 : 8 }}>
              <Module label="NOISE TYPE" color={cfg.color} isMobile={isMobile} TE={TE}>
                <div style={{ display: 'flex', gap: isMobile ? 6 : 3, flexWrap: 'wrap' }}>
                  {[{ k: 'white', l: 'WHITE' }, { k: 'pink', l: 'PINK' }, { k: 'brown', l: 'BROWN' }].map(t => (
                    <Btn key={t.k} active={layer.noise!.type === t.k} onClick={() => onUpdate({ ...layer, noise: { type: t.k as any } })} color={cfg.color} size={btnSize} TE={TE}>{t.l}</Btn>
                  ))}
                </div>
              </Module>
              <Module label="ENVELOPE" color={TE.green} on={!!layer.envelope} onToggle={() => onUpdate({ ...layer, envelope: layer.envelope ? undefined : { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 } })} isMobile={isMobile} TE={TE}>
                {layer.envelope && <>
                  <MiniKnob value={layer.envelope.attack * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, attack: v / 1000 } })} label="A" color={TE.green} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.envelope.decay * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, decay: v / 1000 } })} label="D" color={TE.green} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.envelope.sustain} min={0} max={1} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, sustain: v } })} label="S" color={TE.green} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.envelope.release * 1000} min={1} max={5000} onChange={v => onUpdate({ ...layer, envelope: { ...layer.envelope!, release: v / 1000 } })} label="R" color={TE.green} size={knobSize} TE={TE} />
                </>}
              </Module>
              <Module label="FILTER" color={TE.cyan} on={!!layer.filter} onToggle={() => onUpdate({ ...layer, filter: layer.filter ? undefined : { type: 'lowpass', frequency: 2000, q: 1 } })} isMobile={isMobile} TE={TE}>
                {layer.filter && <>
                  <div style={{ display: 'flex', gap: isMobile ? 6 : 2, flexWrap: 'wrap' }}>
                    {['lowpass', 'highpass', 'bandpass', 'notch'].map(t => (
                      <Btn key={t} active={layer.filter!.type === t} onClick={() => onUpdate({ ...layer, filter: { ...layer.filter!, type: t as any } })} color={TE.cyan} small size={btnSize} TE={TE}>{t.slice(0, 2).toUpperCase()}</Btn>
                    ))}
                  </div>
                  <MiniKnob value={layer.filter.frequency} min={20} max={20000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, frequency: v } })} label="FRQ" color={TE.cyan} logarithmic size={knobSize} TE={TE} />
                  <MiniKnob value={layer.filter.q} min={0.1} max={20} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, q: v } })} label="Q" color={TE.cyan} size={knobSize} TE={TE} />
                  <div style={{ display: 'flex', gap: isMobile ? 10 : 6, alignItems: 'center', flexWrap: 'wrap', marginTop: isMobile ? 8 : 4 }}>
                    <span style={{ fontSize: isMobile ? 9 : 7, color: TE.grey, fontWeight: 700 }}>ENV</span>
                    <Toggle on={!!layer.filter.envelope} onChange={() => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: layer.filter!.envelope ? undefined : { amount: 2000, attack: 0.01, decay: 0.2, sustain: 0, release: 0.3 } } })} color={TE.cyan} size={toggleSize} TE={TE} />
                    {layer.filter.envelope && <>
                      <MiniKnob value={layer.filter.envelope.amount} min={-10000} max={10000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, amount: v } } })} label="AMT" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={layer.filter.envelope.attack * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, attack: v / 1000 } } })} label="A" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={layer.filter.envelope.decay * 1000} min={1} max={2000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, decay: v / 1000 } } })} label="D" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={layer.filter.envelope.sustain} min={0} max={1} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, sustain: v } } })} label="S" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={layer.filter.envelope.release * 1000} min={1} max={5000} onChange={v => onUpdate({ ...layer, filter: { ...layer.filter!, envelope: { ...layer.filter!.envelope!, release: v / 1000 } } })} label="R" color={TE.cyan} size={knobSize} TE={TE} />
                    </>}
                  </div>
                </>}
              </Module>
              <Module label="SATURATION" color={TE.pink} on={!!layer.saturation} onToggle={() => onUpdate({ ...layer, saturation: layer.saturation ? undefined : { type: 'soft', drive: 2, mix: 0.5 } })} isMobile={isMobile} TE={TE}>
                {layer.saturation && <>
                  <div style={{ display: 'flex', gap: isMobile ? 6 : 2, flexWrap: 'wrap' }}>
                    {['soft', 'hard', 'tube', 'tape'].map(t => (
                      <Btn key={t} active={layer.saturation!.type === t} onClick={() => onUpdate({ ...layer, saturation: { ...layer.saturation!, type: t as any } })} color={TE.pink} small size={btnSize} TE={TE}>{t.toUpperCase()}</Btn>
                    ))}
                  </div>
                  <MiniKnob value={layer.saturation.drive} min={0} max={10} onChange={v => onUpdate({ ...layer, saturation: { ...layer.saturation!, drive: v } })} label="DRV" color={TE.pink} size={knobSize} TE={TE} />
                  <MiniKnob value={layer.saturation.mix} min={0} max={1} onChange={v => onUpdate({ ...layer, saturation: { ...layer.saturation!, mix: v } })} label="MIX" color={TE.pink} size={knobSize} TE={TE} />
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

function Effect({ name, on, onToggle, color, children, isMobile = false, toggleSize = 'small' as const, TE }: { name: string; on: boolean; onToggle: () => void; color: string; children: React.ReactNode; isMobile?: boolean; toggleSize?: 'small' | 'medium' | 'large'; TE: ReturnType<typeof createThemeTokens> }) {
  return (
    <div style={{
      background: TE.panel,
      border: `1px solid ${on ? color : TE.border}`,
      borderRadius: 6,
      padding: isMobile ? 12 : 8,
      opacity: on ? 1 : 0.5,
      boxShadow: on ? `0 2px 12px ${color}15` : 'none',
      transition: 'all 0.2s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: on ? (isMobile ? 12 : 8) : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 4 }}>
          <LED on={on} color={color} size={isMobile ? 'medium' : 'small'} TE={TE} />
          <span style={{ fontSize: isMobile ? 11 : 8, fontWeight: 700, color: on ? TE.black : TE.grey }}>{name}</span>
        </div>
        <Toggle on={on} onChange={onToggle} color={color} size={toggleSize} TE={TE} />
      </div>
      {on && <div style={{ display: 'flex', gap: isMobile ? 12 : 8, justifyContent: 'center', flexWrap: 'wrap' }}>{children}</div>}
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
  const { mode } = useThemeMode();
  const TE = useMemo(() => createThemeTokens(mode === 'dark'), [mode]);
  
  const defaultPreset = useDefaultPreset();
  const [config, setConfig] = useState<SoundConfig>(defaultPreset);
  const [jsonValue, setJsonValue] = useState<string>('');
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult>({ valid: true, errors: [] });
  const [showJSONEditor, setShowJSONEditor] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showSynthEngine, setShowSynthEngine] = useState(true);
  const [selectedLayer, setSelectedLayer] = useState(0);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const isUpdatingFromUI = useRef(false);
  const isUpdatingFromJSON = useRef(false);
  
  // AI prompt state
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<AIProvider>('gemini');
  const [generating, setGenerating] = useState(false);

  // Real-time synth for MIDI
  const realtimeSynthRef = useRef<RealtimeSynth | null>(null);
  const [midiActivity, setMidiActivity] = useState(false);
  const midiActivityTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Initialize real-time synth
  useEffect(() => {
    realtimeSynthRef.current = new RealtimeSynth(config);
    return () => {
      realtimeSynthRef.current?.dispose();
    };
  }, []);

  // Update synth config when it changes
  useEffect(() => {
    realtimeSynthRef.current?.updateConfig(config);
  }, [config]);

  // MIDI note handlers
  const handleMidiNoteOn = useCallback((note: MidiNote) => {
    realtimeSynthRef.current?.noteOn(note.note, note.velocity);
    setMidiActivity(true);
    if (midiActivityTimeout.current) clearTimeout(midiActivityTimeout.current);
    midiActivityTimeout.current = setTimeout(() => setMidiActivity(false), 100);
  }, []);

  const handleMidiNoteOff = useCallback((note: MidiNote) => {
    realtimeSynthRef.current?.noteOff(note.note);
  }, []);

  // MIDI hook
  const midi = useMidi({
    onNoteOn: handleMidiNoteOn,
    onNoteOff: handleMidiNoteOff,
  });

  // Responsive breakpoints
  const isMobile = useMediaQuery(`(max-width: ${BREAKPOINTS.mobile}px)`);
  const isTablet = useMediaQuery(`(max-width: ${BREAKPOINTS.tablet}px)`);

  // Responsive sizing
  const knobSize = isMobile ? 'large' : isTablet ? 'medium' : 'small';
  const toggleSize = 'small' as const;
  const btnSize = isMobile ? 'medium' : 'small';

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
    const gen = async () => { try { setAudioBuffer(await synthesizeSound(config)); } catch { /* synthesis preview failed silently */ } };
    const t = setTimeout(gen, 200);
    return () => clearTimeout(t);
  }, [config]);

  // JSON change handler
  const handleJSONChange = useCallback((newJsonValue: string) => {
    setJsonValue(newJsonValue);
    const result = validateSoundConfigJSON(newJsonValue);
    setValidationResult(result);

    if (result.valid && !isUpdatingFromUI.current) {
      try {
        const parsedConfig = JSON.parse(newJsonValue) as SoundConfig;
        isUpdatingFromJSON.current = true;
        setConfig(parsedConfig);
        setError(null);
        setTimeout(() => { isUpdatingFromJSON.current = false; }, 0);
      } catch { /* JSON parse failed silently */ }
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
    else newLayer = { ...base, type, karplus: { frequency: 440, damping: 0.5, inharmonicity: 0 } };
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
  const updateDynamics = (dynamics: Partial<SoundConfig['dynamics']>) => setConfig({ ...config, dynamics: { ...config.dynamics, ...dynamics } });
  const updateMetadata = (metadata: Partial<SoundConfig['metadata']>) => setConfig({ ...config, metadata: { ...config.metadata, ...metadata } });

  // Generate sound from AI prompt
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setGenerating(true);
    setError(null);
    
    try {
      const generatedConfig = await generateSoundConfig(prompt, provider);
      setConfig(generatedConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI generation failed');
    } finally {
      setGenerating(false);
    }
  };

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
    <Container maxWidth="lg" sx={{ py: 2, px: 2 }}>
      <Stack spacing={1.25}>
        {/* HEADER + AI PROMPT + MIDI in single block */}
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          {/* HEADER */}
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: isMobile ? 10 : 0,
            padding: isMobile ? '12px' : '10px 16px',
            borderBottom: `1px solid ${TE.border}`,
          }}>
            <div 
              onClick={() => setShowSynthEngine(!showSynthEngine)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            >
              <div style={{
                width: isMobile ? 36 : 28,
                height: isMobile ? 36 : 28,
                background: TE.orange,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 900,
                fontSize: isMobile ? 14 : 12,
              }}>SE</div>
              <div>
                <div style={{ fontSize: isMobile ? 12 : 10, fontWeight: 700, color: TE.black, letterSpacing: 1 }}>SYNTH ENGINE</div>
                <div style={{ fontSize: isMobile ? 10 : 8, color: TE.grey }}>make a sound or ask AI</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
              <button
                onClick={() => setShowJSONEditor(!showJSONEditor)}
                style={{
                  padding: isMobile ? '10px 14px' : '6px 10px',
                  border: `1px solid ${showJSONEditor ? TE.orange : TE.border}`,
                  borderRadius: 3,
                  background: showJSONEditor ? `${TE.orange}20` : TE.panel,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isMobile ? 11 : 9,
                  fontWeight: 600,
                  color: showJSONEditor ? TE.orange : TE.grey,
                  minHeight: isMobile ? 44 : undefined,
                }}
              >
                {'</>'}
              </button>
              <button
                onClick={handlePlay}
                disabled={playing}
                style={{
                  padding: isMobile ? '10px 28px' : '6px 24px',
                  background: playing ? TE.surface : TE.orange,
                  border: 'none',
                  borderRadius: 3,
                  color: playing ? TE.grey : '#fff',
                  fontSize: isMobile ? 12 : 10,
                  fontWeight: 800,
                  cursor: playing ? 'not-allowed' : 'pointer',
                  letterSpacing: 0.5,
                  minHeight: isMobile ? 44 : undefined,
                  flex: isMobile ? 1 : undefined,
                }}
              >
                {playing ? '■ PLAYING' : '▶ PLAY'}
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                style={{
                  padding: isMobile ? '10px 16px' : '6px 12px',
                  background: TE.panel,
                  border: `1px solid ${TE.green}`,
                  borderRadius: 3,
                  color: TE.green,
                  fontSize: isMobile ? 11 : 9,
                  fontWeight: 600,
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  opacity: exporting ? 0.5 : 1,
                  minHeight: isMobile ? 44 : undefined,
                }}
              >↓ EXPORT</button>
            </div>
          </div>
          
          {/* AI PROMPT */}
          {showSynthEngine && (
          <div style={{ 
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 8 : 10,
            alignItems: 'center',
            padding: isMobile ? '12px' : '10px 16px',
            borderBottom: `1px solid ${TE.border}`,
          }}>
            <select
              value={provider}
              onChange={e => setProvider(e.target.value as AIProvider)}
              disabled={generating}
              style={{
                padding: isMobile ? '8px 10px' : '6px 8px',
                background: TE.inputBg,
                border: `1px solid ${TE.border}`,
                borderRadius: 4,
                color: TE.black,
                fontSize: isMobile ? 16 : 9,
                cursor: 'pointer',
                minWidth: isMobile ? '100%' : 100,
              }}
            >
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
            </select>
            <input
              type="text"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !generating && handleGenerate()}
              placeholder="Describe the sound you want to create..."
              disabled={generating}
              style={{
                flex: 1,
                padding: isMobile ? '10px 12px' : '6px 10px',
                background: TE.inputBg,
                border: `1px solid ${TE.border}`,
                borderRadius: 4,
                color: TE.black,
                fontSize: isMobile ? 16 : 10,
                width: isMobile ? '100%' : 'auto',
                minWidth: 0,
              }}
            />
            <button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              style={{
                padding: isMobile ? '10px 16px' : '6px 12px',
                background: generating ? TE.surface : TE.pink,
                border: 'none',
                borderRadius: 4,
                color: generating ? TE.grey : '#fff',
                fontSize: isMobile ? 11 : 9,
                fontWeight: 600,
                cursor: generating || !prompt.trim() ? 'not-allowed' : 'pointer',
                width: isMobile ? '100%' : 'auto',
                minHeight: isMobile ? 38 : undefined,
                whiteSpace: 'nowrap',
                boxShadow: generating ? 'none' : `0 2px 8px ${TE.pink}40`,
                transition: 'all 0.2s ease',
              }}
            >
              {generating ? 'GENERATING...' : '✨ GENERATE'}
            </button>
          </div>
          )}

          {/* MIDI PANEL - only show when devices available */}
          {showSynthEngine && midi.enabled && midi.devices.length > 0 && (
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? 8 : 16,
              alignItems: isMobile ? 'stretch' : 'center',
              padding: isMobile ? '10px 12px' : '8px 16px',
              borderTop: `1px solid ${TE.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: midiActivity ? TE.green : TE.yellow,
                  boxShadow: midiActivity ? `0 0 8px ${TE.green}` : 'none',
                  transition: 'all 0.1s ease',
                }} />
                <span style={{ fontSize: isMobile ? 10 : 9, fontWeight: 700, color: TE.grey, letterSpacing: 0.5 }}>MIDI</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, flex: 1 }}>
                <select
                  value={midi.selectedDeviceId || ''}
                  onChange={(e) => midi.selectDevice(e.target.value || null)}
                  style={{
                    padding: isMobile ? '8px 10px' : '5px 8px',
                    background: TE.inputBg,
                    border: `1px solid ${TE.green}`,
                    borderRadius: 4,
                    color: TE.black,
                    fontSize: isMobile ? 11 : 9,
                    cursor: 'pointer',
                    flex: isMobile ? 1 : 'none',
                    minWidth: 140,
                  }}
                >
                  <option value="">No MIDI Device</option>
                  {midi.devices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                    </option>
                  ))}
                </select>
                
                {midi.activeNotes.size > 0 && (
                  <div style={{
                    display: 'flex',
                    gap: 4,
                    flexWrap: 'wrap',
                  }}>
                    {Array.from(midi.activeNotes).slice(0, 8).map((note) => (
                      <span
                        key={note}
                        style={{
                          padding: '2px 6px',
                          background: TE.green,
                          borderRadius: 3,
                          fontSize: isMobile ? 10 : 8,
                          fontWeight: 700,
                          color: '#fff',
                        }}
                      >
                        {midiNoteToName(note)}
                      </span>
                    ))}
                  </div>
                )}
                
                {midi.lastNote && midi.activeNotes.size === 0 && (
                  <span style={{ fontSize: isMobile ? 10 : 8, color: TE.grey }}>
                    Last: {midiNoteToName(midi.lastNote.note)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* JSON EDITOR - inside same block */}
          <Collapse in={showJSONEditor}>
            <div style={{ padding: isMobile ? 12 : 16, borderTop: `1px solid ${TE.border}` }}>
              <div style={{ fontSize: 8, color: TE.grey, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>JSON CONFIGURATION</div>
              <ValidationDisplay result={validationResult} />
              <div style={{ marginTop: validationResult.errors.length > 0 ? 8 : 0 }}>
                <JSONEditor value={jsonValue} onChange={handleJSONChange} height="300px" />
              </div>
            </div>
          </Collapse>
        </Paper>

        {error && (
          <Paper variant="outlined" sx={{ p: 2, bgcolor: TE.errorBg, borderColor: TE.errorBorder }}>
            <span style={{ color: TE.errorText, fontSize: 10, fontWeight: 600 }}>{error}</span>
          </Paper>
        )}

        {/* MAIN */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isTablet ? '1fr' : '1fr 280px',
          gap: isMobile ? 10 : 12,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}>
        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10, minWidth: 0, overflow: 'hidden' }}>
          {/* WAVEFORM */}
          <div style={{ background: TE.panel, borderRadius: 4, padding: isMobile ? 12 : 10, border: `1px solid ${TE.border}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? 10 : 6 }}>
              <span style={{ fontSize: isMobile ? 10 : 8, color: TE.grey, fontWeight: 700, letterSpacing: 1 }}>WAVEFORM</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: isMobile ? 10 : 8, color: TE.grey }}>DUR</span>
                <span style={{ fontSize: isMobile ? 12 : 10, fontWeight: 700, color: TE.orange }}>{config.timing.duration.toFixed(2)}s</span>
              </div>
            </div>
            <ScopeDisplay audioBuffer={audioBuffer} TE={TE} />
            <input type="range" min={0.1} max={10} step={0.1} value={config.timing.duration} onChange={e => updateDuration(parseFloat(e.target.value))} style={{ width: '100%', height: isMobile ? 6 : 3, marginTop: isMobile ? 10 : 6, accentColor: TE.orange }} />
          </div>

          {/* LAYERS */}
          <div style={{ background: TE.panel, borderRadius: 4, padding: isMobile ? 12 : 10, border: `1px solid ${TE.border}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? 12 : 8, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: isMobile ? 11 : 8, color: TE.grey, fontWeight: 700, letterSpacing: 1 }}>LAYERS</span>
              {config.synthesis.layers.length < 8 && (
                <div style={{ display: 'flex', gap: isMobile ? 8 : 4, flexWrap: 'wrap' }}>
                  {([
                    { type: 'oscillator', color: TE.orange },
                    { type: 'noise', color: TE.pink },
                    { type: 'fm', color: TE.cyan },
                    { type: 'karplus-strong', color: TE.green },
                  ] as const).map(({ type, color }) => (
                    <button
                      key={type}
                      onClick={() => addLayer(type)}
                      style={{
                        width: isMobile ? 36 : 22,
                        height: isMobile ? 36 : 22,
                        background: TE.surface,
                        border: `1px solid ${color}40`,
                        borderRadius: 3,
                        color: color,
                        fontSize: isMobile ? 16 : 12,
                        cursor: 'pointer',
                        touchAction: 'manipulation',
                        fontWeight: 600,
                      }}
                    >+</button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 6 }}>
              {config.synthesis.layers.map((layer, i) => (
                <LayerPanel key={i} layer={layer} index={i} selected={selectedLayer === i} onSelect={() => setSelectedLayer(selectedLayer === i ? -1 : i)} onUpdate={l => updateLayer(i, l)} onRemove={() => removeLayer(i)} canRemove={config.synthesis.layers.length > 1} isMobile={isMobile} isTablet={isTablet} knobSize={knobSize} btnSize={btnSize} toggleSize={toggleSize} TE={TE} />
              ))}
            </div>
          </div>

          {/* METADATA - Collapsible (desktop only - renders last on mobile) */}
          {!isTablet && (
          <div style={{ background: TE.panel, borderRadius: 4, padding: isMobile ? 12 : 10, border: `1px solid ${TE.border}`, overflow: 'hidden' }}>
              <div
                onClick={() => setShowMetadata(!showMetadata)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span style={{ fontSize: isMobile ? 11 : 8, color: TE.grey, fontWeight: 700, letterSpacing: 1 }}>METADATA</span>
                <span style={{
                  fontSize: isMobile ? 12 : 10,
                  color: TE.grey,
                  transition: 'transform 0.2s ease',
                  transform: showMetadata ? 'rotate(180deg)' : 'rotate(0deg)',
                  opacity: 0.6,
                }}>▾</span>
              </div>
              <Collapse in={showMetadata}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 8, marginTop: isMobile ? 12 : 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: isMobile ? 9 : 7, color: TE.grey, fontWeight: 700 }}>NAME</span>
                    <input
                      type="text"
                      value={config.metadata.name}
                      onChange={e => updateMetadata({ name: e.target.value })}
                      placeholder="Sound name..."
                      style={{
                        padding: isMobile ? '8px 10px' : '5px 8px',
                        background: TE.inputBg,
                        border: `1px solid ${TE.border}`,
                        borderRadius: 4,
                        color: TE.black,
                        fontSize: isMobile ? 16 : 9,
                        width: '100%',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: isMobile ? 9 : 7, color: TE.grey, fontWeight: 700 }}>CATEGORY</span>
                    <div style={{ display: 'flex', gap: isMobile ? 6 : 3, flexWrap: 'wrap' }}>
                      {['kick', 'snare', 'hihat', 'tom', 'perc', 'bass', 'lead', 'pad', 'fx', 'other'].map(cat => (
                        <Btn key={cat} active={config.metadata.category === cat} onClick={() => updateMetadata({ category: cat as SoundConfig['metadata']['category'] })} color={TE.pink} small size={btnSize} TE={TE}>{cat.toUpperCase()}</Btn>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: isMobile ? 9 : 7, color: TE.grey, fontWeight: 700 }}>DESCRIPTION</span>
                    <textarea
                      value={config.metadata.description}
                      onChange={e => updateMetadata({ description: e.target.value })}
                      placeholder="Describe the sound..."
                      rows={2}
                      style={{
                        padding: isMobile ? '8px 10px' : '5px 8px',
                        background: TE.inputBg,
                        border: `1px solid ${TE.border}`,
                        borderRadius: 4,
                        color: TE.black,
                        fontSize: isMobile ? 16 : 9,
                        width: '100%',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: isMobile ? 9 : 7, color: TE.grey, fontWeight: 700 }}>TAGS</span>
                    <input
                      type="text"
                      value={config.metadata.tags.join(', ')}
                      onChange={e => updateMetadata({ tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) })}
                      placeholder="tag1, tag2, tag3..."
                      style={{
                        padding: isMobile ? '8px 10px' : '5px 8px',
                        background: TE.inputBg,
                        border: `1px solid ${TE.border}`,
                        borderRadius: 4,
                        color: TE.black,
                        fontSize: isMobile ? 16 : 9,
                        width: '100%',
                      }}
                    />
                    {config.metadata.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                        {config.metadata.tags.map((tag, i) => (
                          <span
                            key={i}
                            style={{
                              padding: '2px 6px',
                              background: `${TE.cyan}20`,
                              border: `1px solid ${TE.cyan}40`,
                              borderRadius: 3,
                              fontSize: isMobile ? 9 : 7,
                              color: TE.cyan,
                              fontWeight: 600,
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Collapse>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 8 : 10,
          width: '100%',
        }}>
          {/* ENVELOPE */}
          <div style={{ background: TE.panel, borderRadius: 4, padding: isMobile ? 12 : 10, border: `1px solid ${TE.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? 10 : 6 }}>
              <span style={{ fontSize: isMobile ? 10 : 8, color: TE.grey, fontWeight: 700, letterSpacing: 1 }}>ENVELOPE</span>
            </div>
            <EnvelopeDisplay {...config.envelope} TE={TE} />
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: isMobile ? 12 : 8, flexWrap: 'wrap', gap: isMobile ? 12 : 4 }}>
              <MiniKnob value={config.envelope.attack * 1000} min={1} max={2000} onChange={v => updateEnvelope({ ...config.envelope, attack: v / 1000 })} label="ATK" color={TE.green} size={knobSize} TE={TE} />
              <MiniKnob value={config.envelope.decay * 1000} min={1} max={2000} onChange={v => updateEnvelope({ ...config.envelope, decay: v / 1000 })} label="DEC" color={TE.green} size={knobSize} TE={TE} />
              <MiniKnob value={config.envelope.sustain} min={0} max={1} onChange={v => updateEnvelope({ ...config.envelope, sustain: v })} label="SUS" color={TE.green} size={knobSize} TE={TE} />
              <MiniKnob value={config.envelope.release * 1000} min={1} max={5000} onChange={v => updateEnvelope({ ...config.envelope, release: v / 1000 })} label="REL" color={TE.green} size={knobSize} TE={TE} />
            </div>
          </div>

          {/* LFO */}
          <div style={{ background: TE.panel, borderRadius: 6, padding: isMobile ? 12 : 10, border: `1px solid ${config.lfo ? TE.yellow : TE.border}`, opacity: config.lfo ? 1 : 0.6, boxShadow: config.lfo ? `0 2px 12px ${TE.yellow}15` : 'none', transition: 'all 0.2s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: config.lfo ? (isMobile ? 12 : 8) : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 4 }}>
                <LED on={!!config.lfo} color={TE.yellow} size={isMobile ? 'medium' : 'small'} TE={TE} />
                <span style={{ fontSize: isMobile ? 10 : 8, color: TE.grey, fontWeight: 700, letterSpacing: 1 }}>LFO</span>
              </div>
              <Toggle on={!!config.lfo} onChange={() => config.lfo ? updateLFO(undefined) : updateLFO({ waveform: 'sine', frequency: 5, depth: 0.5, target: 'pitch' })} color={TE.yellow} size={toggleSize} TE={TE} />
            </div>
            {config.lfo && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 8 }}>
                <div style={{ display: 'flex', gap: isMobile ? 6 : 2, flexWrap: 'wrap' }}>
                  {['sine', 'square', 'sawtooth', 'triangle', 'random'].map(w => (
                    <Btn key={w} active={config.lfo!.waveform === w} onClick={() => updateLFO({ ...config.lfo!, waveform: w as any })} color={TE.yellow} small size={btnSize} TE={TE}>{w.slice(0, 3).toUpperCase()}</Btn>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: isMobile ? 6 : 2, flexWrap: 'wrap' }}>
                  {['pitch', 'filter', 'amplitude', 'pan'].map(t => (
                    <Btn key={t} active={config.lfo!.target === t} onClick={() => updateLFO({ ...config.lfo!, target: t as any })} color={TE.yellow} small size={btnSize} TE={TE}>{t.slice(0, 3).toUpperCase()}</Btn>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: isMobile ? 12 : 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <MiniKnob value={config.lfo.frequency} min={0.1} max={20} onChange={v => updateLFO({ ...config.lfo!, frequency: v })} label="RATE" color={TE.yellow} size={knobSize} TE={TE} />
                  <MiniKnob value={config.lfo.depth} min={0} max={1} onChange={v => updateLFO({ ...config.lfo!, depth: v })} label="DEPTH" color={TE.yellow} size={knobSize} TE={TE} />
                  <MiniKnob value={config.lfo.delay || 0} min={0} max={2} onChange={v => updateLFO({ ...config.lfo!, delay: v })} label="DELAY" color={TE.yellow} size={knobSize} TE={TE} />
                  <MiniKnob value={config.lfo.fade || 0} min={0} max={2} onChange={v => updateLFO({ ...config.lfo!, fade: v })} label="FADE" color={TE.yellow} size={knobSize} TE={TE} />
                </div>
              </div>
            )}
          </div>

          {/* FILTER */}
          <div style={{ background: TE.panel, borderRadius: 6, padding: isMobile ? 12 : 10, border: `1px solid ${config.filter ? TE.cyan : TE.border}`, opacity: config.filter ? 1 : 0.6, boxShadow: config.filter ? `0 2px 12px ${TE.cyan}15` : 'none', transition: 'all 0.2s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: config.filter ? (isMobile ? 12 : 8) : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 4 }}>
                <LED on={!!config.filter} color={TE.cyan} size={isMobile ? 'medium' : 'small'} TE={TE} />
                <span style={{ fontSize: isMobile ? 10 : 8, color: TE.grey, fontWeight: 700, letterSpacing: 1 }}>FILTER</span>
              </div>
              <Toggle on={!!config.filter} onChange={() => config.filter ? updateFilter(undefined) : updateFilter({ type: 'lowpass', frequency: 2000, q: 1 })} color={TE.cyan} size={toggleSize} TE={TE} />
            </div>
            {config.filter && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 8 }}>
                <div style={{ display: 'flex', gap: isMobile ? 6 : 2, flexWrap: 'wrap' }}>
                  {['lowpass', 'highpass', 'bandpass', 'notch', 'allpass', 'peaking'].map(t => (
                    <Btn key={t} active={config.filter!.type === t} onClick={() => updateFilter({ ...config.filter!, type: t as any })} color={TE.cyan} small size={btnSize} TE={TE}>{t.slice(0, 2).toUpperCase()}</Btn>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: isMobile ? 12 : 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <MiniKnob value={config.filter.frequency} min={20} max={20000} onChange={v => updateFilter({ ...config.filter!, frequency: v })} label="FREQ" color={TE.cyan} logarithmic size={knobSize} TE={TE} />
                  <MiniKnob value={config.filter.q} min={0.1} max={20} onChange={v => updateFilter({ ...config.filter!, q: v })} label="RES" color={TE.cyan} size={knobSize} TE={TE} />
                  {config.filter.type === 'peaking' && (
                    <MiniKnob value={config.filter.gain ?? 0} min={-24} max={24} onChange={v => updateFilter({ ...config.filter!, gain: v })} label="GAIN" color={TE.cyan} size={knobSize} TE={TE} />
                  )}
                </div>
                <div style={{ display: 'flex', gap: isMobile ? 10 : 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: isMobile ? 9 : 7, color: TE.grey, fontWeight: 700 }}>ENV</span>
                  <Toggle on={!!config.filter.envelope} onChange={() => updateFilter({ ...config.filter!, envelope: config.filter!.envelope ? undefined : { amount: 2000, attack: 0.01, decay: 0.2, sustain: 0, release: 0.3 } })} color={TE.cyan} size={toggleSize} TE={TE} />
                  {config.filter.envelope && (
                    <>
                      <MiniKnob value={config.filter.envelope.amount} min={-10000} max={10000} onChange={v => updateFilter({ ...config.filter!, envelope: { ...config.filter!.envelope!, amount: v } })} label="AMT" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={config.filter.envelope.attack * 1000} min={1} max={2000} onChange={v => updateFilter({ ...config.filter!, envelope: { ...config.filter!.envelope!, attack: v / 1000 } })} label="A" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={config.filter.envelope.decay * 1000} min={1} max={2000} onChange={v => updateFilter({ ...config.filter!, envelope: { ...config.filter!.envelope!, decay: v / 1000 } })} label="D" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={config.filter.envelope.sustain} min={0} max={1} onChange={v => updateFilter({ ...config.filter!, envelope: { ...config.filter!.envelope!, sustain: v } })} label="S" color={TE.cyan} size={knobSize} TE={TE} />
                      <MiniKnob value={config.filter.envelope.release * 1000} min={1} max={5000} onChange={v => updateFilter({ ...config.filter!, envelope: { ...config.filter!.envelope!, release: v / 1000 } })} label="R" color={TE.cyan} size={knobSize} TE={TE} />
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* DYNAMICS */}
          <div style={{ background: TE.panel, borderRadius: 6, padding: isMobile ? 12 : 10, border: `1px solid ${TE.border}` }}>
            <span style={{ fontSize: isMobile ? 10 : 8, color: TE.grey, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: isMobile ? 12 : 8 }}>DYNAMICS</span>
            <div style={{ display: 'flex', gap: isMobile ? 16 : 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <MiniKnob value={config.dynamics?.velocity ?? 0.8} min={0} max={1} onChange={(v) => updateDynamics({ velocity: v })} label="VELOCITY" color={TE.orange} size={knobSize} TE={TE} />
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 4 }}>
                <span style={{ fontSize: isMobile ? 9 : 7, color: TE.grey, fontWeight: 700 }}>NORM</span>
                <Toggle on={config.dynamics?.normalize ?? true} onChange={() => updateDynamics({ normalize: !config.dynamics?.normalize })} color={TE.orange} size={toggleSize} TE={TE} />
              </div>
            </div>
          </div>

          {/* EFFECTS */}
          <div>
            <div style={{ fontSize: isMobile ? 10 : 8, color: TE.grey, fontWeight: 700, letterSpacing: 1, marginBottom: isMobile ? 10 : 6 }}>EFFECTS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 6 }}>
              <Effect name="EQ" on={!!config.effects.eq} onToggle={() => config.effects.eq ? updateEffects({ ...config.effects, eq: undefined }) : updateEffects({ ...config.effects, eq: { low: { frequency: 100, gain: 0 }, mid: { frequency: 1000, gain: 0, q: 1 }, high: { frequency: 8000, gain: 0 } } })} color={TE.cyan} isMobile={isMobile} toggleSize={toggleSize} TE={TE}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 6, width: '100%' }}>
                  <div style={{ display: 'flex', gap: isMobile ? 10 : 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: isMobile ? 9 : 7, color: TE.grey, fontWeight: 700, width: 28 }}>LOW</span>
                    <MiniKnob value={config.effects.eq?.low.frequency || 100} min={20} max={500} onChange={v => updateEffects({ ...config.effects, eq: { ...config.effects.eq!, low: { ...config.effects.eq!.low, frequency: v } } })} label="FRQ" color={TE.cyan} size={knobSize} logarithmic TE={TE} />
                    <MiniKnob value={config.effects.eq?.low.gain || 0} min={-24} max={24} onChange={v => updateEffects({ ...config.effects, eq: { ...config.effects.eq!, low: { ...config.effects.eq!.low, gain: v } } })} label="GAIN" color={TE.cyan} size={knobSize} TE={TE} />
                  </div>
                  <div style={{ display: 'flex', gap: isMobile ? 10 : 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: isMobile ? 9 : 7, color: TE.grey, fontWeight: 700, width: 28 }}>MID</span>
                    <MiniKnob value={config.effects.eq?.mid.frequency || 1000} min={200} max={5000} onChange={v => updateEffects({ ...config.effects, eq: { ...config.effects.eq!, mid: { ...config.effects.eq!.mid, frequency: v } } })} label="FRQ" color={TE.cyan} size={knobSize} logarithmic TE={TE} />
                    <MiniKnob value={config.effects.eq?.mid.gain || 0} min={-24} max={24} onChange={v => updateEffects({ ...config.effects, eq: { ...config.effects.eq!, mid: { ...config.effects.eq!.mid, gain: v } } })} label="GAIN" color={TE.cyan} size={knobSize} TE={TE} />
                    <MiniKnob value={config.effects.eq?.mid.q || 1} min={0.1} max={10} onChange={v => updateEffects({ ...config.effects, eq: { ...config.effects.eq!, mid: { ...config.effects.eq!.mid, q: v } } })} label="Q" color={TE.cyan} size={knobSize} TE={TE} />
                  </div>
                  <div style={{ display: 'flex', gap: isMobile ? 10 : 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: isMobile ? 9 : 7, color: TE.grey, fontWeight: 700, width: 28 }}>HIGH</span>
                    <MiniKnob value={config.effects.eq?.high.frequency || 8000} min={2000} max={20000} onChange={v => updateEffects({ ...config.effects, eq: { ...config.effects.eq!, high: { ...config.effects.eq!.high, frequency: v } } })} label="FRQ" color={TE.cyan} size={knobSize} logarithmic TE={TE} />
                    <MiniKnob value={config.effects.eq?.high.gain || 0} min={-24} max={24} onChange={v => updateEffects({ ...config.effects, eq: { ...config.effects.eq!, high: { ...config.effects.eq!.high, gain: v } } })} label="GAIN" color={TE.cyan} size={knobSize} TE={TE} />
                  </div>
                </div>
              </Effect>

              <Effect name="DISTORT" on={!!config.effects.distortion} onToggle={() => config.effects.distortion ? updateEffects({ ...config.effects, distortion: undefined }) : updateEffects({ ...config.effects, distortion: { type: 'soft', amount: 0.5, mix: 0.5 } })} color={TE.orange} isMobile={isMobile} toggleSize={toggleSize} TE={TE}>
                <div style={{ display: 'flex', gap: isMobile ? 6 : 2, flexWrap: 'wrap' }}>
                  {['soft', 'hard', 'fuzz', 'bitcrush', 'waveshaper'].map(t => (
                    <Btn key={t} active={config.effects.distortion?.type === t} onClick={() => updateEffects({ ...config.effects, distortion: { ...config.effects.distortion!, type: t as any } })} color={TE.orange} small size={btnSize} TE={TE}>{t === 'bitcrush' ? 'BIT' : t === 'waveshaper' ? 'WS' : t.slice(0, 2).toUpperCase()}</Btn>
                  ))}
                </div>
                <MiniKnob value={config.effects.distortion?.amount || 0.5} min={0} max={1} onChange={v => updateEffects({ ...config.effects, distortion: { ...config.effects.distortion!, amount: v } })} label="AMT" color={TE.orange} size={knobSize} TE={TE} />
                <MiniKnob value={config.effects.distortion?.mix || 0.5} min={0} max={1} onChange={v => updateEffects({ ...config.effects, distortion: { ...config.effects.distortion!, mix: v } })} label="MIX" color={TE.orange} size={knobSize} TE={TE} />
              </Effect>

              <Effect name="COMPRESS" on={!!config.effects.compressor} onToggle={() => config.effects.compressor ? updateEffects({ ...config.effects, compressor: undefined }) : updateEffects({ ...config.effects, compressor: { threshold: -20, ratio: 4, attack: 0.003, release: 0.25, knee: 30 } })} color={TE.yellow} isMobile={isMobile} toggleSize={toggleSize} TE={TE}>
                <MiniKnob value={config.effects.compressor?.threshold || -20} min={-60} max={0} onChange={v => updateEffects({ ...config.effects, compressor: { ...config.effects.compressor!, threshold: v } })} label="THRS" color={TE.yellow} size={knobSize} TE={TE} />
                <MiniKnob value={config.effects.compressor?.ratio || 4} min={1} max={20} onChange={v => updateEffects({ ...config.effects, compressor: { ...config.effects.compressor!, ratio: v } })} label="RATIO" color={TE.yellow} size={knobSize} TE={TE} />
                <MiniKnob value={(config.effects.compressor?.attack || 0.003) * 1000} min={0.1} max={100} onChange={v => updateEffects({ ...config.effects, compressor: { ...config.effects.compressor!, attack: v / 1000 } })} label="ATK" color={TE.yellow} size={knobSize} TE={TE} />
                <MiniKnob value={(config.effects.compressor?.release || 0.25) * 1000} min={10} max={1000} onChange={v => updateEffects({ ...config.effects, compressor: { ...config.effects.compressor!, release: v / 1000 } })} label="REL" color={TE.yellow} size={knobSize} TE={TE} />
                <MiniKnob value={config.effects.compressor?.knee ?? 30} min={0} max={40} onChange={v => updateEffects({ ...config.effects, compressor: { ...config.effects.compressor!, knee: v } })} label="KNEE" color={TE.yellow} size={knobSize} TE={TE} />
              </Effect>

              <Effect name="CHORUS" on={!!config.effects.chorus} onToggle={() => config.effects.chorus ? updateEffects({ ...config.effects, chorus: undefined }) : updateEffects({ ...config.effects, chorus: { rate: 0.5, depth: 0.5, mix: 0.5, feedback: 0, delay: 20 } })} color={TE.pink} isMobile={isMobile} toggleSize={toggleSize} TE={TE}>
                <MiniKnob value={config.effects.chorus?.rate || 0.5} min={0.1} max={10} onChange={v => updateEffects({ ...config.effects, chorus: { ...config.effects.chorus!, rate: v } })} label="RATE" color={TE.pink} size={knobSize} TE={TE} />
                <MiniKnob value={config.effects.chorus?.depth || 0.5} min={0} max={1} onChange={v => updateEffects({ ...config.effects, chorus: { ...config.effects.chorus!, depth: v } })} label="DEPTH" color={TE.pink} size={knobSize} TE={TE} />
                <MiniKnob value={config.effects.chorus?.delay || 20} min={1} max={50} onChange={v => updateEffects({ ...config.effects, chorus: { ...config.effects.chorus!, delay: v } })} label="DELAY" color={TE.pink} size={knobSize} TE={TE} />
                <MiniKnob value={config.effects.chorus?.feedback || 0} min={0} max={0.9} onChange={v => updateEffects({ ...config.effects, chorus: { ...config.effects.chorus!, feedback: v } })} label="FB" color={TE.pink} size={knobSize} TE={TE} />
                <MiniKnob value={config.effects.chorus?.mix || 0.5} min={0} max={1} onChange={v => updateEffects({ ...config.effects, chorus: { ...config.effects.chorus!, mix: v } })} label="MIX" color={TE.pink} size={knobSize} TE={TE} />
              </Effect>

              <Effect name="DELAY" on={!!config.effects.delay} onToggle={() => config.effects.delay ? updateEffects({ ...config.effects, delay: undefined }) : updateEffects({ ...config.effects, delay: { time: 0.25, feedback: 0.5, mix: 0.3 } })} color={TE.cyan} isMobile={isMobile} toggleSize={toggleSize} TE={TE}>
                <MiniKnob value={(config.effects.delay?.time || 0.25) * 1000} min={10} max={2000} onChange={v => updateEffects({ ...config.effects, delay: { ...config.effects.delay!, time: v / 1000 } })} label="TIME" color={TE.cyan} size={knobSize} TE={TE} />
                <MiniKnob value={config.effects.delay?.feedback || 0.5} min={0} max={0.95} onChange={v => updateEffects({ ...config.effects, delay: { ...config.effects.delay!, feedback: v } })} label="FB" color={TE.cyan} size={knobSize} TE={TE} />
                <MiniKnob value={config.effects.delay?.mix || 0.3} min={0} max={1} onChange={v => updateEffects({ ...config.effects, delay: { ...config.effects.delay!, mix: v } })} label="MIX" color={TE.cyan} size={knobSize} TE={TE} />
              </Effect>

              <Effect name="REVERB" on={!!config.effects.reverb} onToggle={() => config.effects.reverb ? updateEffects({ ...config.effects, reverb: undefined }) : updateEffects({ ...config.effects, reverb: { decay: 2, damping: 0.5, mix: 0.3 } })} color={TE.pink} isMobile={isMobile} toggleSize={toggleSize} TE={TE}>
                <MiniKnob value={config.effects.reverb?.decay || 2} min={0.1} max={10} onChange={v => updateEffects({ ...config.effects, reverb: { ...config.effects.reverb!, decay: v } })} label="DECAY" color={TE.pink} size={knobSize} TE={TE} />
                <MiniKnob value={config.effects.reverb?.damping || 0.5} min={0} max={1} onChange={v => updateEffects({ ...config.effects, reverb: { ...config.effects.reverb!, damping: v } })} label="DAMP" color={TE.pink} size={knobSize} TE={TE} />
                <MiniKnob value={config.effects.reverb?.mix || 0.3} min={0} max={1} onChange={v => updateEffects({ ...config.effects, reverb: { ...config.effects.reverb!, mix: v } })} label="MIX" color={TE.pink} size={knobSize} TE={TE} />
              </Effect>

              <Effect name="GATE" on={!!config.effects.gate} onToggle={() => config.effects.gate ? updateEffects({ ...config.effects, gate: undefined }) : updateEffects({ ...config.effects, gate: { attack: 0.001, hold: 0.2, release: 0.05 } })} color={TE.green} isMobile={isMobile} toggleSize={toggleSize} TE={TE}>
                <MiniKnob value={(config.effects.gate?.attack || 0.001) * 1000} min={0.1} max={50} onChange={v => updateEffects({ ...config.effects, gate: { ...config.effects.gate!, attack: v / 1000 } })} label="ATK" color={TE.green} size={knobSize} TE={TE} />
                <MiniKnob value={(config.effects.gate?.hold || 0.2) * 1000} min={10} max={1000} onChange={v => updateEffects({ ...config.effects, gate: { ...config.effects.gate!, hold: v / 1000 } })} label="HOLD" color={TE.green} size={knobSize} TE={TE} />
                <MiniKnob value={(config.effects.gate?.release || 0.05) * 1000} min={5} max={500} onChange={v => updateEffects({ ...config.effects, gate: { ...config.effects.gate!, release: v / 1000 } })} label="REL" color={TE.green} size={knobSize} TE={TE} />
              </Effect>
            </div>
          </div>

          {/* METADATA - Collapsible (mobile/tablet only - renders last in RIGHT column) */}
          {isTablet && (
            <div style={{ background: TE.panel, borderRadius: 4, padding: isMobile ? 12 : 10, border: `1px solid ${TE.border}`, overflow: 'hidden' }}>
              <div
                onClick={() => setShowMetadata(!showMetadata)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span style={{ fontSize: isMobile ? 11 : 8, color: TE.grey, fontWeight: 700, letterSpacing: 1 }}>METADATA</span>
                <span style={{
                  fontSize: isMobile ? 12 : 10,
                  color: TE.grey,
                  transition: 'transform 0.2s ease',
                  transform: showMetadata ? 'rotate(180deg)' : 'rotate(0deg)',
                  opacity: 0.6,
                }}>▾</span>
              </div>
              <Collapse in={showMetadata}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 8, marginTop: isMobile ? 12 : 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: isMobile ? 9 : 7, color: TE.grey, fontWeight: 700 }}>NAME</span>
                    <input
                      type="text"
                      value={config.metadata.name}
                      onChange={e => updateMetadata({ name: e.target.value })}
                      placeholder="Sound name..."
                      style={{
                        padding: isMobile ? '8px 10px' : '5px 8px',
                        background: TE.inputBg,
                        border: `1px solid ${TE.border}`,
                        borderRadius: 4,
                        color: TE.black,
                        fontSize: isMobile ? 16 : 9,
                        width: '100%',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: isMobile ? 9 : 7, color: TE.grey, fontWeight: 700 }}>CATEGORY</span>
                    <div style={{ display: 'flex', gap: isMobile ? 6 : 3, flexWrap: 'wrap' }}>
                      {['kick', 'snare', 'hihat', 'tom', 'perc', 'bass', 'lead', 'pad', 'fx', 'other'].map(cat => (
                        <Btn key={cat} active={config.metadata.category === cat} onClick={() => updateMetadata({ category: cat as SoundConfig['metadata']['category'] })} color={TE.pink} small size={btnSize} TE={TE}>{cat.toUpperCase()}</Btn>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: isMobile ? 9 : 7, color: TE.grey, fontWeight: 700 }}>DESCRIPTION</span>
                    <textarea
                      value={config.metadata.description}
                      onChange={e => updateMetadata({ description: e.target.value })}
                      placeholder="Describe the sound..."
                      rows={2}
                      style={{
                        padding: isMobile ? '8px 10px' : '5px 8px',
                        background: TE.inputBg,
                        border: `1px solid ${TE.border}`,
                        borderRadius: 4,
                        color: TE.black,
                        fontSize: isMobile ? 16 : 9,
                        width: '100%',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: isMobile ? 9 : 7, color: TE.grey, fontWeight: 700 }}>TAGS</span>
                    <input
                      type="text"
                      value={config.metadata.tags.join(', ')}
                      onChange={e => updateMetadata({ tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) })}
                      placeholder="tag1, tag2, tag3..."
                      style={{
                        padding: isMobile ? '8px 10px' : '5px 8px',
                        background: TE.inputBg,
                        border: `1px solid ${TE.border}`,
                        borderRadius: 4,
                        color: TE.black,
                        fontSize: isMobile ? 16 : 9,
                        width: '100%',
                      }}
                    />
                    {config.metadata.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                        {config.metadata.tags.map((tag, i) => (
                          <span
                            key={i}
                            style={{
                              padding: '2px 6px',
                              background: `${TE.cyan}20`,
                              border: `1px solid ${TE.cyan}40`,
                              borderRadius: 3,
                              fontSize: isMobile ? 9 : 7,
                              color: TE.cyan,
                              fontWeight: 600,
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Collapse>
            </div>
          )}

        </div>
      </div>
      </Stack>
    </Container>
  );
}
