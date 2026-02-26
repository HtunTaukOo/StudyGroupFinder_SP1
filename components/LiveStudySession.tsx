
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Mic, MicOff, X, Sparkles, Volume2, Info } from 'lucide-react';

// Audio Encoding/Decoding helpers as per requirements
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

interface LiveStudySessionProps {
  onClose: () => void;
  subject: string;
}

const LiveStudySession: React.FC<LiveStudySessionProps> = ({ onClose, subject }) => {
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcription, setTranscription] = useState<string[]>([]);
  const [status, setStatus] = useState('Connecting to AI Tutor...');

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const streamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionIdRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    let localSession: any = null;
    let localStream: MediaStream | null = null;
    let localInputCtx: AudioContext | null = null;
    let localOutputCtx: AudioContext | null = null;
    let localScriptProcessor: ScriptProcessorNode | null = null;
    let localSourceNode: MediaStreamAudioSourceNode | null = null;

    const init = async () => {
      try {
        // Increment session ID to invalidate callbacks from previous sessions
        sessionIdRef.current += 1;
        const currentSessionId = sessionIdRef.current;

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        localStream = stream;
        streamRef.current = stream;

        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        localInputCtx = inputCtx;
        localOutputCtx = outputCtx;
        audioContextRef.current = { input: inputCtx, output: outputCtx };

        // Avoid embedding API keys in the frontend bundle.
        const runtimeKey = (window.localStorage.getItem('gemini_client_key') || '').trim();
        if (!runtimeKey) {
          setStatus('AI Tutor unavailable: missing runtime key');
          return;
        }
        const ai = new GoogleGenAI({ apiKey: runtimeKey });
        console.log('[LiveSession] Attempting to connect to Gemini...');
        const session = await ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          callbacks: {
            onopen: () => {
              console.log('[LiveSession] onopen callback fired - Session opened!');

              // Check if this session is still the current one
              if (currentSessionId !== sessionIdRef.current || !mounted) {
                console.warn('[LiveSession] Session opened but a newer session has started or component unmounted');
                return;
              }

              // Check if audio context is still valid
              if (inputCtx.state === 'closed') {
                console.warn('[LiveSession] Audio context closed before session opened');
                return;
              }

              console.log('[LiveSession] Setting status to "AI Tutor is Listening"');
              setStatus('AI Tutor is Listening');
              setIsActive(true);
              console.log('[LiveSession] Status and active state updated');

              try {
                const source = inputCtx.createMediaStreamSource(stream);
                localSourceNode = source;
                sourceNodeRef.current = source;

                const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                localScriptProcessor = scriptProcessor;
                scriptProcessorRef.current = scriptProcessor;

                scriptProcessor.onaudioprocess = (e) => {
                  // Check if session is still the current one
                  if (isMuted || !sessionRef.current || currentSessionId !== sessionIdRef.current) return;

                  const inputData = e.inputBuffer.getChannelData(0);
                  const pcmBlob = createBlob(inputData);

                  // Only send if session exists and is ready
                  try {
                    if (sessionRef.current) {
                      sessionRef.current.sendRealtimeInput({ media: pcmBlob });
                    }
                  } catch (err) {
                    console.warn('Failed to send audio data:', err);
                  }
                };

                // Create a gain node set to 0 to keep processing alive without playing back
                const gainNode = inputCtx.createGain();
                gainNode.gain.value = 0;
                source.connect(scriptProcessor);
                scriptProcessor.connect(gainNode);
                gainNode.connect(inputCtx.destination);
                console.log('[LiveSession] Audio processing setup complete!');
              } catch (err) {
                console.error('[LiveSession] Error setting up audio processing:', err);
              }
            },
            onmessage: async (message: LiveServerMessage) => {
              // Check if this session is still the current one
              if (currentSessionId !== sessionIdRef.current) return;

              if (message.serverContent?.outputTranscription) {
                setTranscription(prev => [...prev.slice(-4), `AI: ${message.serverContent?.outputTranscription?.text}`]);
              }
              if (message.serverContent?.inputTranscription) {
                setTranscription(prev => [...prev.slice(-4), `You: ${message.serverContent?.inputTranscription?.text}`]);
              }

              const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audioData && currentSessionId === sessionIdRef.current) {
                // Check if output context is still valid
                if (outputCtx.state === 'closed') {
                  return;
                }

                try {
                  const LOOKAHEAD_TIME = 0.1;
                  const currentTime = outputCtx.currentTime;

                  if (nextStartTimeRef.current < currentTime + LOOKAHEAD_TIME) {
                    nextStartTimeRef.current = currentTime + LOOKAHEAD_TIME;
                  }

                  const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
                  const source = outputCtx.createBufferSource();
                  source.buffer = buffer;
                  source.connect(outputCtx.destination);
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += buffer.duration;
                  sourcesRef.current.add(source);
                  source.onended = () => sourcesRef.current.delete(source);
                } catch (err) {
                  console.warn('Error playing audio response:', err);
                }
              }

              if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => {
                  try {
                    s.stop();
                  } catch (e) {}
                });
                sourcesRef.current.clear();
                nextStartTimeRef.current = outputCtx.currentTime;
              }
            },
            onerror: (e) => {
              console.error("[LiveSession] ERROR:", e);
              console.error("[LiveSession] Error details:", JSON.stringify(e, null, 2));
              setStatus('Connection Error');
            },
            onclose: (event?: any) => {
              console.log('[LiveSession] onclose callback fired - Session closed');
              console.log('[LiveSession] Close event details:', event);
              if (event) {
                console.log('[LiveSession] Close code:', event.code);
                console.log('[LiveSession] Close reason:', event.reason);
              }
              if (currentSessionId === sessionIdRef.current) {
                console.log('[LiveSession] Setting status to "Session Ended"');
                setStatus('Session Ended');
                setIsActive(false);

                // Clean up audio resources when session closes unexpectedly
                if (scriptProcessorRef.current) {
                  scriptProcessorRef.current.disconnect();
                  scriptProcessorRef.current = null;
                }
                if (sourceNodeRef.current) {
                  sourceNodeRef.current.disconnect();
                  sourceNodeRef.current = null;
                }
              }
            }
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
            systemInstruction: `You are an expert academic tutor for university students. The current subject is ${subject}. Help the user understand difficult concepts, solve problems, and stay motivated. Keep your answers clear, professional, and helpful. Speak naturally.`,
            outputAudioTranscription: {},
            inputAudioTranscription: {},
          }
        });

        if (!mounted) {
          console.log('[LiveSession] Component unmounted before connection completed, cleaning up');
          session.close();
          stream.getTracks().forEach(track => track.stop());
          inputCtx.close();
          outputCtx.close();
          return;
        }

        console.log('[LiveSession] Session connected successfully!');
        localSession = session;
        sessionRef.current = session;
      } catch (err) {
        console.error('[LiveSession] Initialization error:', err);
        if (mounted) {
          setStatus('Failed to access microphone');
        }
      }
    };

    init();

    return () => {
      mounted = false;

      // Clean up this mount's specific resources
      if (localScriptProcessor) {
        localScriptProcessor.disconnect();
      }
      if (localSourceNode) {
        localSourceNode.disconnect();
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (localInputCtx) {
        localInputCtx.close();
      }
      if (localOutputCtx) {
        localOutputCtx.close();
      }
      if (localSession) {
        try {
          localSession.close();
        } catch (e) {
          console.warn('Error closing session:', e);
        }
      }

      // Clear global refs only if they match our local resources
      if (sessionRef.current === localSession) {
        sessionRef.current = null;
      }
      if (scriptProcessorRef.current === localScriptProcessor) {
        scriptProcessorRef.current = null;
      }
      if (sourceNodeRef.current === localSourceNode) {
        sourceNodeRef.current = null;
      }
      if (streamRef.current === localStream) {
        streamRef.current = null;
      }
    };
  }, []);



  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-2xl bg-white/5 border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col items-center p-12 relative">
        <button onClick={onClose} className="absolute top-8 right-8 p-3 text-white/40 hover:text-white transition-colors">
          <X size={24} />
        </button>

        <div className="flex flex-col items-center text-center space-y-8 mb-12">
          <div className="relative">
            <div className={`w-32 h-32 rounded-full bg-orange-500 flex items-center justify-center shadow-[0_0_50px_rgba(249,115,22,0.4)] relative z-10 transition-transform duration-500 ${isActive ? 'scale-110' : 'scale-100'}`}>
              <Sparkles size={48} className="text-white animate-pulse" />
            </div>
            {isActive && (
              <>
                <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-ping duration-[2000ms]"></div>
                <div className="absolute inset-0 rounded-full bg-orange-500/10 animate-ping duration-[3000ms] delay-500"></div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-black text-white tracking-tight">{subject} Live Session</h2>
            <p className="text-orange-400 font-bold tracking-widest uppercase text-xs">{status}</p>
          </div>
        </div>

        <div className="w-full bg-black/20 rounded-3xl p-6 min-h-[160px] flex flex-col justify-end space-y-2 mb-12 border border-white/5">
          {transcription.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-white/20 space-y-2">
              <Info size={20} />
              <p className="text-xs font-bold uppercase tracking-widest italic">Start talking to your AI Tutor</p>
            </div>
          )}
          {transcription.map((t, idx) => (
            <p key={idx} className={`text-sm font-medium ${t.startsWith('AI:') ? 'text-orange-200' : 'text-white/60'}`}>
              {t}
            </p>
          ))}
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all shadow-xl ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
          </button>
          
          <div className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3">
             <Volume2 size={18} className="text-white/40" />
             <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full bg-orange-500 transition-all duration-300 ${isActive ? 'w-2/3' : 'w-0'}`}></div>
             </div>
          </div>
        </div>

        <p className="mt-12 text-white/30 text-[10px] font-black uppercase tracking-[0.3em]">Powered by Gemini 2.5 Flash Native Audio</p>
      </div>
    </div>
  );
};

export default LiveStudySession;
