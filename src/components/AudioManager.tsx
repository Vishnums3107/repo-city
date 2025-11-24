import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import * as Tone from 'tone';
import { useFrame, useThree } from '@react-three/fiber';

interface AudioContextType {
  initialized: boolean;
  initializeAudio: () => Promise<void>;
  playHover: () => void;
  playClick: () => void;
  droneSynthRef: React.MutableRefObject<Tone.FMSynth | null>;
}

const AudioContext = createContext<AudioContextType | null>(null);

export const useCyberSound = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useCyberSound must be used within an AudioProvider');
  }
  return context;
};

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [initialized, setInitialized] = useState(false);
  
  // Refs for synths to persist across renders without re-creating
  const hoverSynth = useRef<Tone.Synth | null>(null);
  const clickSynth = useRef<Tone.NoiseSynth | null>(null);
  const droneSynth = useRef<Tone.FMSynth | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      hoverSynth.current?.dispose();
      clickSynth.current?.dispose();
      droneSynth.current?.dispose();
    };
  }, []);

  const initializeAudio = async () => {
    if (initialized) return;
    
    await Tone.start();
    console.log('Audio Engine Started');

    // 1. Hover Synth (High-pitched bleep)
    hoverSynth.current = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }
    }).toDestination();
    hoverSynth.current.volume.value = -10;

    // 2. Click Synth (Mechanical Clack)
    // Noise burst + Lowpass Filter
    const clickFilter = new Tone.Filter(800, "lowpass");
    clickSynth.current = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
    }).chain(clickFilter, Tone.Destination);
    clickSynth.current.volume.value = -10;

    // 3. Ambient Drone (FMSynth + PingPongDelay)
    const pingPong = new Tone.PingPongDelay("8n", 0.2).toDestination();
    const reverb = new Tone.Reverb({ decay: 4, wet: 0.5 }).toDestination();
    
    droneSynth.current = new Tone.FMSynth({
      harmonicity: 1,
      modulationIndex: 3.5,
      oscillator: { type: "sine" },
      envelope: { attack: 2, decay: 0, sustain: 1, release: 2 },
      modulation: { type: "square" },
      modulationEnvelope: { attack: 0.5, decay: 0, sustain: 1, release: 0.5 }
    }).connect(pingPong).connect(reverb);
    
    droneSynth.current.volume.value = -20;
    
    // Start the drone
    droneSynth.current.triggerAttack("C2");

    setInitialized(true);
  };

  const playHover = () => {
    if (!initialized || !hoverSynth.current) return;
    // Play a random high note for variety
    const notes = ["C6", "E6", "G6", "A6"];
    const note = notes[Math.floor(Math.random() * notes.length)];
    hoverSynth.current.triggerAttackRelease(note, "32n");
  };

  const playClick = () => {
    if (!initialized || !clickSynth.current) return;
    clickSynth.current.triggerAttackRelease("16n");
  };

  return (
    <AudioContext.Provider value={{ 
        initialized, 
        initializeAudio, 
        playHover, 
        playClick,
        droneSynthRef: droneSynth 
    }}>
      {children}
    </AudioContext.Provider>
  );
};

export const CyberDrone: React.FC = () => {
    return <DroneLogic />;
};

const DroneLogic = () => {
    const context = useCyberSound(); 
    const synth = context.droneSynthRef.current;
    
    const { camera } = useThree();
    const lastPos = useRef(camera.position.clone());
    
    useFrame((_state, delta) => {
        if (!synth || !context.initialized) return;
        
        // Calculate speed
        // Safety: Ensure delta is not zero or extremely small to avoid Infinity
        const safeDelta = Math.max(delta, 0.001);
        const speed = camera.position.distanceTo(lastPos.current) / safeDelta;
        lastPos.current.copy(camera.position);
        
        // Modulate Harmonicity based on speed
        // Base is 1. Max speed might be around 50-100 in drone mode?
        // Safety: Clamp values to valid ranges
        const targetHarmonicity = Math.max(0.1, Math.min(1 + speed * 0.05, 10));
        const targetModIndex = Math.max(0, Math.min(3.5 + speed * 0.1, 20));
        
        // Smoothly ramp to values
        // Note: Tone.js AudioParams can be ramped
        if (isFinite(targetHarmonicity)) synth.harmonicity.rampTo(targetHarmonicity, 0.1);
        if (isFinite(targetModIndex)) synth.modulationIndex.rampTo(targetModIndex, 0.1);
    });
    
    return null;
}
