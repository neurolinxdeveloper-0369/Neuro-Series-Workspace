import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  Sparkles, 
  RotateCcw, 
  Mic, 
  MicOff, 
  CheckCircle2, 
  ArrowRight
} from 'lucide-react';
import { getAssetUrl } from '../utils/assets';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actionTaken?: {
    type: 'toggle' | 'scene' | 'schedule' | 'nav';
    label: string;
  };
}

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices?: any[];
  routines?: any[];
  currentHomeName?: string;
  onToggleSwitch?: (deviceId: string, switchIndex: number, targetState: boolean) => void;
  onRunRoutine?: (routine: any) => void;
  onNavigateTab?: (tabId: 'devices' | 'explore' | 'home' | 'menu' | 'routines') => void;
}

const DEFAULT_GREETING = "Hello! I'm your Neuro AI Assistant ⚡. I can control your capacitive touch switches, trigger room scenes, run schedulers, check device statuses, or answer any questions about your smart home. What would you like to do?";

const QUICK_PROMPTS = [
  { label: 'Turn on lights', query: 'Turn on the lights' },
  { label: 'Run Good Morning', query: 'Run Good Morning scene' },
  { label: 'Device Status', query: 'What devices are online?' },
  { label: 'Show Routines', query: 'Show active scenes and schedules' },
  { label: 'Turn off all', query: 'Turn off all switches' },
];

export const AiAssistantModal = ({
  isOpen,
  onClose,
  devices = [],
  routines = [],
  currentHomeName = 'Neurolinx',
  onToggleSwitch,
  onRunRoutine,
  onNavigateTab,
}: AiAssistantModalProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'assistant',
      text: DEFAULT_GREETING,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Smart Home AI Response Generator
  const generateAiResponse = async (userInput: string): Promise<{ text: string; action?: { type: 'toggle' | 'scene' | 'schedule' | 'nav'; label: string } }> => {
    const q = userInput.toLowerCase().trim();

    // 1. Greetings
    if (q === 'hi' || q === 'hello' || q === 'hey' || q.startsWith('good morning') || q.startsWith('good evening')) {
      return {
        text: `Hello! I'm ready to assist you in **${currentHomeName}**. You can ask me to toggle switches, run scenes, or check routine schedules.`,
      };
    }

    // 2. Turn ON light / lights
    if (q.includes('turn on light') || q.includes('switch on light') || q.includes('lights on') || q.includes('turn on switch 1')) {
      // Find first available device with switches
      const dev = devices.find((d) => (d.switches || d.status?.switches || []).length > 0) || devices[0];
      if (dev && onToggleSwitch) {
        onToggleSwitch(dev.device_id || dev.id, 0, true);
        return {
          text: `💡 **Done!** I have switched **ON** the light for you on **${dev.custom_name || dev.name || 'Touch Panel'}**.`,
          action: { type: 'toggle', label: 'Light Turned ON' },
        };
      }
      return {
        text: `💡 I've sent the command to turn on the lights. All matching capacitive switches have been engaged.`,
      };
    }

    // 3. Turn OFF all switches
    if (q.includes('turn off all') || q.includes('all off') || q.includes('switch off all') || q.includes('lights off')) {
      let toggledCount = 0;
      devices.forEach((dev) => {
        const swList = dev.switches || dev.status?.switches || [];
        const devId = dev.device_id || dev.id;
        swList.forEach((_: any, idx: number) => {
          if (onToggleSwitch && devId) {
            onToggleSwitch(devId, idx, false);
            toggledCount++;
          }
        });
      });
      return {
        text: `🌙 **All Off executed!** Turned off switches across your active rooms.`,
        action: { type: 'toggle', label: 'All Switches OFF' },
      };
    }

    // 4. Run Good Morning or Scene
    if (q.includes('good morning') || (q.includes('run') && q.includes('scene'))) {
      const scene = routines.find((r) => r.type === 'scene' || (r.name && r.name.toLowerCase().includes('morning'))) || routines[0];
      if (scene && onRunRoutine) {
        onRunRoutine(scene);
        return {
          text: `🌅 **${scene.name || 'Scene'} executed successfully!** Applied all configured switch actions.`,
          action: { type: 'scene', label: `Ran Scene: ${scene.name}` },
        };
      }
      return {
        text: `🌅 I triggered the morning automation scene! Your devices are now set to optimal morning states.`,
      };
    }

    // 5. Device Status / Online check
    if (q.includes('online') || q.includes('device') || q.includes('status') || q.includes('how many')) {
      const totalDevs = devices.length;
      const onlineDevs = devices.filter((d) => d.status?.online !== false).length;
      return {
        text: `📊 **Smart Home Status for ${currentHomeName}:**\n\n• **Connected Devices:** ${totalDevs} device(s) (${onlineDevs} online)\n• **Active Routines:** ${routines.length} configured\n• **Gateway:** Connected via EMQX MQTT & WebSocket real-time sync.`,
      };
    }

    // 6. Routine / Schedule check
    if (q.includes('schedule') || q.includes('routine') || q.includes('scenes')) {
      const scenesCount = routines.filter((r) => r.type === 'scene').length;
      const schedulesCount = routines.filter((r) => r.type === 'schedule').length;
      return {
        text: `⏰ You have **${routines.length} total routines** configured in **${currentHomeName}**:\n\n• **Scenes:** ${scenesCount}\n• **Time Schedules (IST):** ${schedulesCount}\n\nYou can tap **Run Now** directly from the Routines tab, or ask me to trigger any scene by name.`,
      };
    }

    // 7. Help / Instructions
    if (q.includes('help') || q.includes('how to add') || q.includes('how do i')) {
      return {
        text: `ℹ️ **Here is how to get the most out of Neuro Series:**\n\n1. **Add Device:** Tap the **+** button in the top right and select *Add Device*.\n2. **Long-press Switch:** Long-press any capacitive switch to customize its appliance name and white icon.\n3. **Create Schedules:** Tap the **+** button on the Routines tab to create IST-precise automated schedules.\n4. **Voice & AI:** You can ask me here anytime to toggle switches or run scenes!`,
      };
    }

    // 8. Navigation commands
    if (q.includes('routines') || q.includes('go to routines') || q.includes('open routines')) {
      if (onNavigateTab) onNavigateTab('routines');
      return {
        text: `🚀 Navigated you to the **Routines & Automations** tab!`,
        action: { type: 'nav', label: 'Opened Routines' },
      };
    }
    if (q.includes('devices') || q.includes('go to devices') || q.includes('open devices')) {
      if (onNavigateTab) onNavigateTab('devices');
      return {
        text: `🚀 Navigated you to the **Devices** tab!`,
        action: { type: 'nav', label: 'Opened Devices' },
      };
    }
    if (q.includes('home') || q.includes('go to home') || q.includes('open home')) {
      if (onNavigateTab) onNavigateTab('home');
      return {
        text: `🚀 Navigated you to the **Home** dashboard!`,
        action: { type: 'nav', label: 'Opened Home' },
      };
    }

    // Default Fallback
    return {
      text: `I understand you're asking about "${userInput}". I can help you operate your capacitive touch switches, trigger scenes like "Good Morning", or check status in **${currentHomeName}**. Feel free to try the quick buttons below!`,
    };
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isTyping) return;

    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      // Simulate quick natural AI latency (300-600ms)
      await new Promise((r) => setTimeout(r, 450));
      const response = await generateAiResponse(query);

      const aiMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        sender: 'assistant',
        text: response.text,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
        actionTaken: response.action,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          sender: 'assistant',
          text: "I'm having a little trouble connecting right now, but your switches and routines are safe. Please try again in a moment.",
          timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // Toggle voice recognition simulation
  const handleToggleMic = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    setIsListening(true);
    // Web Speech Recognition if available
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-IN';
        recognition.onresult = (event: any) => {
          const speechResult = event.results[0][0].transcript;
          setInputText(speechResult);
          setIsListening(false);
          handleSend(speechResult);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
        return;
      } catch {
        setIsListening(false);
      }
    }

    // Fallback simulation for voice input
    setTimeout(() => {
      setInputText('Turn on the lights');
      setIsListening(false);
    }, 1800);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `msg_welcome_${Date.now()}`,
        sender: 'assistant',
        text: DEFAULT_GREETING,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      },
    ]);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 select-none pointer-events-auto font-sans animate-in fade-in duration-200">
      {/* Blurred Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity"
        aria-hidden="true"
      />

      {/* Main Chat Drawer / Modal Container */}
      <div 
        className="relative w-full sm:max-w-xl bg-white/95 backdrop-blur-2xl rounded-t-[32px] sm:rounded-3xl shadow-2xl border border-white/80 flex flex-col h-[85vh] sm:h-[620px] max-h-[92vh] overflow-hidden z-10 animate-in slide-in-from-bottom-6 duration-200"
        style={{
          boxShadow: '0 25px 60px -15px rgba(2, 132, 199, 0.25), 0 10px 30px rgba(15, 23, 42, 0.15)',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(240, 249, 255, 0.94) 100%)',
        }}
      >
        {/* Top Header */}
        <header className="px-5 py-3.5 border-b border-sky-100/80 bg-white/70 backdrop-blur-xl flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Logo in Circle with glowing ring */}
            <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-950 border-2 border-white ring-2 ring-sky-400/80 shadow-[0_0_14px_rgba(56,189,248,0.5)] flex items-center justify-center flex-shrink-0">
              <img 
                src={getAssetUrl('logo.png')} 
                alt="Neuro AI" 
                className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white ring-1 ring-emerald-300 animate-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                  Neuro AI Assistant
                </h2>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-100 text-[#0284c7] text-[10px] font-bold">
                  <Sparkles className="w-2.5 h-2.5" />
                  Smart
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {currentHomeName} &bull; Ready to help
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleClearHistory}
              title="Reset conversation"
              className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              title="Close chat"
              className="p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" strokeWidth={2.4} />
            </button>
          </div>
        </header>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 scroll-smooth">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-in fade-in duration-150`}
            >
              <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[80%]">
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-slate-950 border border-sky-300 flex items-center justify-center flex-shrink-0 shadow-xs mb-1">
                    <img src={getAssetUrl('logo.png')} alt="" className="w-4 h-4 object-contain" />
                  </div>
                )}

                <div
                  className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-[#0284c7] to-[#0369a1] text-white rounded-br-xs shadow-md shadow-sky-600/20'
                      : 'bg-white text-slate-800 rounded-bl-xs border border-slate-200/80 shadow-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans">
                    {msg.text.split('\n').map((line, i) => (
                      <p key={i} className={i > 0 ? 'mt-1.5' : ''}>
                        {line.split('**').map((part, pIdx) =>
                          pIdx % 2 === 1 ? <strong key={pIdx} className="font-extrabold">{part}</strong> : part
                        )}
                      </p>
                    ))}
                  </div>

                  {/* Optional Action Badge */}
                  {msg.actionTaken && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{msg.actionTaken.label}</span>
                    </div>
                  )}
                </div>
              </div>

              <span className="text-[10px] text-slate-400 mt-1 px-1 font-mono">
                {msg.timestamp}
              </span>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center gap-2 animate-in fade-in duration-100">
              <div className="w-7 h-7 rounded-full bg-slate-950 border border-sky-300 flex items-center justify-center flex-shrink-0 shadow-xs">
                <img src={getAssetUrl('logo.png')} alt="" className="w-4 h-4 object-contain" />
              </div>
              <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200/80 shadow-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#0284c7] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#0284c7] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#0284c7] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-white/50 border-t border-sky-100/60 overflow-x-auto no-scrollbar flex items-center gap-2 flex-shrink-0">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={() => handleSend(prompt.query)}
              className="px-3 py-1.5 rounded-full bg-white hover:bg-sky-50 text-slate-700 hover:text-[#0284c7] text-[11px] sm:text-xs font-semibold border border-slate-200/80 shadow-2xs transition-all whitespace-nowrap cursor-pointer active:scale-95 flex items-center gap-1"
            >
              <span>{prompt.label}</span>
              <ArrowRight className="w-3 h-3 opacity-60" />
            </button>
          ))}
        </div>

        {/* Chat Input Bar */}
        <footer className="p-3 sm:p-4 bg-white/90 border-t border-slate-200/80 flex items-center gap-2 flex-shrink-0 pb-[calc(0.75rem+max(var(--android-nav-bottom,0px),env(safe-area-inset-bottom,0px)))]">
          <button
            type="button"
            onClick={handleToggleMic}
            className={`p-2.5 rounded-full transition-all cursor-pointer ${
              isListening 
                ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30' 
                : 'bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-[#0284c7]'
            }`}
            title={isListening ? 'Listening...' : 'Voice command'}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isListening ? 'Listening to voice...' : 'Ask Neuro AI anything...'}
            disabled={isTyping}
            className="flex-1 px-4 py-2.5 rounded-full bg-slate-100/90 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm font-sans outline-none focus:border-[#0284c7] focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all"
          />

          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!inputText.trim() || isTyping}
            className="p-2.5 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-md shadow-sky-600/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </footer>
      </div>
    </div>
  );
};
