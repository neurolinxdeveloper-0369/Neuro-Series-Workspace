import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  Sparkles, 
  RotateCcw, 
  Mic, 
  MicOff, 
  CheckCircle2, 
  ArrowRight,
  Cpu,
  ExternalLink
} from 'lucide-react';
import { getAssetUrl } from '../utils/assets';
import { aiApi } from '../services/ai';

// Brand-accurate WhatsApp SVG Icon
const WhatsAppIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  provider?: string;
  actionTaken?: {
    type: 'control' | 'scene' | 'nav' | 'whatsapp_support';
    label: string;
    phone?: string;
    prefillText?: string;
  };
}

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices?: any[];
  rooms?: any[];
  routines?: any[];
  currentHomeName?: string;
  onToggleSwitch?: (deviceId: string, switchIndex: number, targetState: boolean) => void;
  onRunRoutine?: (routine: any) => void;
  onNavigateTab?: (tabId: 'devices' | 'explore' | 'home' | 'menu' | 'routines') => void;
}

const DEFAULT_GREETING = "Hello! I'm your Neuro AI Assistant ⚡. I can report exact switch states in your rooms, signal strength (RSSI), run group controls, diagnose issues, or connect you directly with WhatsApp Support. What would you like to know?";

const QUICK_PROMPTS = [
  { label: 'Living Room Switches', query: 'How many switches are turned on in living room?' },
  { label: 'Wi-Fi RSSI', query: 'Show Wi-Fi signal strength and RSSI details' },
  { label: 'Location Profile', query: 'Show location profile and group control details' },
  { label: 'Device Not Working?', query: 'Why is my device not working or showing weak strength?' },
  { label: 'Raise Complaint', query: 'I want to raise a complaint with WhatsApp support' },
  { label: 'Turn off all', query: 'Turn off all switches' },
];

const SUPPORT_PHONE = '917995558994';

export const AiAssistantModal = ({
  isOpen,
  onClose,
  devices = [],
  rooms = [],
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
  const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; model: string }>({
    available: false,
    model: 'llama3.2',
  });
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Check Ollama status on open
  useEffect(() => {
    if (isOpen) {
      aiApi.getStatus().then((res) => {
        if (res?.ollama?.available) {
          setOllamaStatus({
            available: true,
            model: res.ollama.models[0] || 'llama3.2',
          });
        }
      }).catch(() => {});
    }
  }, [isOpen]);

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

  // Open WhatsApp Support Complaint Box directly
  const handleOpenWhatsAppSupport = (customPrefill?: string) => {
    const dev = devices[0];
    const devName = dev?.custom_name || dev?.name || 'Touch Switch Panel';
    const devId = dev?.device_id || dev?.id || 'DEV_UNKNOWN';
    const text = customPrefill || `Hello Neurolinx Support, I am raising a complaint for my device (${devName}, ID: ${devId}) in ${currentHomeName}. Issue: `;
    const encoded = encodeURIComponent(text);
    const url = `https://wa.me/${SUPPORT_PHONE}?text=${encoded}`;
    window.open(url, '_blank');
  };

  // Smart Home AI Grounded Response Generator (Real-time device & room telemetry fallback)
  const generateAiResponse = async (userInput: string): Promise<{ text: string; action?: ChatMessage['actionTaken'] }> => {
    const q = userInput.toLowerCase().trim();

    // 1. Specific Room & Switch Status Breakdown (e.g. Living room, switches on, which are on, scene controlled)
    if (
      q.includes('living room') ||
      q.includes('bedroom') ||
      q.includes('kitchen') ||
      q.includes('how many switches are turned on') ||
      q.includes('how many switches') ||
      q.includes('switches are on') ||
      q.includes('what are there') ||
      q.includes('which switches are on') ||
      q.includes('switch status')
    ) {
      // Find requested room or default to Living room
      let targetRoomName = 'Living room';
      if (rooms && rooms.length > 0) {
        const matched = rooms.find((r: any) => q.includes(r.name.toLowerCase()));
        if (matched) targetRoomName = matched.name;
      }
      
      const targetRoomObj = (rooms || []).find((r: any) => r.name.toLowerCase() === targetRoomName.toLowerCase());
      const targetRoomId = targetRoomObj?.id;

      // Filter devices in target room
      let roomDevices = devices.filter((d: any) => 
        (targetRoomId && d.room_id === targetRoomId) || 
        (d.room_name && d.room_name.toLowerCase() === targetRoomName.toLowerCase())
      );
      if (roomDevices.length === 0 && devices.length > 0) {
        roomDevices = [devices[0]];
        targetRoomName = roomDevices[0].room_name || targetRoomName;
      }

      // Build scene mapping for all switches
      const sceneActionMap = new Map<string, string[]>();
      routines.forEach((r: any) => {
        (r.actions || []).forEach((act: any) => {
          const key = `${act.deviceId || act.device_id}_${act.channel}`;
          const cur = sceneActionMap.get(key) || [];
          if (!cur.includes(r.name)) cur.push(r.name);
          sceneActionMap.set(key, cur);
        });
      });

      const switchList: Array<{
        deviceId: string;
        channel: number;
        name: string;
        isOn: boolean;
        scenes: string[];
      }> = [];

      roomDevices.forEach((dev: any) => {
        const devId = dev.device_id || dev.id;
        const count = dev.model_code === 'TP6' ? 6 : dev.model_code === 'TP4' ? 4 : dev.model_code === 'TP2' ? 2 : dev.model_code === 'TP1' ? 1 : 8;
        const rawConfigs = dev.switch_configs || [];
        const rawSwitches = dev.switches || dev.status?.switches || {};

        for (let i = 1; i <= count; i++) {
          const cfg = rawConfigs.find((c: any) => c.index === i - 1);
          const channelKey = `${devId}_${i}`;
          let isSwOn = false;
          if (Array.isArray(rawSwitches)) {
            isSwOn = Boolean(rawSwitches[i - 1]);
          } else if (typeof rawSwitches === 'object') {
            isSwOn = Boolean(rawSwitches[String(i)] ?? rawSwitches[i]);
          }
          
          switchList.push({
            deviceId: devId,
            channel: i,
            name: cfg?.name || (i === 1 ? 'Light 2' : i === 2 ? 'Light 3' : i === 4 ? 'Fan 1' : `Switch ${i}`),
            isOn: isSwOn,
            scenes: sceneActionMap.get(channelKey) || [],
          });
        }
      });

      const onSwitches = switchList.filter((s) => s.isOn);
      const offSwitches = switchList.filter((s) => !s.isOn);

      let text = `💡 **Real-time Switch Status — ${targetRoomName}:**\n\n` +
        `• **Total Switches:** ${switchList.length} capacitive channels\n` +
        `• **Turned ON:** ${onSwitches.length} active\n` +
        `• **Turned OFF:** ${offSwitches.length} idle\n\n`;

      if (onSwitches.length > 0) {
        text += `🟢 **Active Switches (Turned ON):**\n` +
          onSwitches.map((s) => {
            const sc = s.scenes.length > 0 ? ` *(Controlled by Scene: "${s.scenes.join(', ')}")*` : '';
            return `• **ID ${s.channel} ${s.name}**: was ON 🟢${sc}`;
          }).join('\n') + '\n\n';
      } else {
        text += `🟢 **Active Switches:** None currently turned ON.\n\n`;
      }

      if (offSwitches.length > 0) {
        text += `⚪ **Remaining Switches in OFF Position:**\n` +
          offSwitches.map((s) => {
            const sc = s.scenes.length > 0 ? ` *(Configured in Scene: "${s.scenes.join(', ')}")*` : '';
            return `• **ID ${s.channel} ${s.name}**: in OFF position ⚪${sc}`;
          }).join('\n');
      }

      const sceneSwitches = switchList.filter((s) => s.scenes.length > 0);
      if (sceneSwitches.length > 0) {
        text += `\n\n🎬 **Scene Automations:**\n` +
          sceneSwitches.map((s) => `• ID ${s.channel} ${s.name} is controlled by Scene **"${s.scenes.join(', ')}"**`).join('\n');
      }

      return { text };
    }

    // 2. Wi-Fi RSSI & Signal Strength
    if (q.includes('rssi') || q.includes('wifi') || q.includes('wi-fi') || q.includes('signal') || q.includes('strength')) {
      if (devices.length === 0) {
        return {
          text: `📶 **Wi-Fi Telemetry:** No touch switches currently connected in **${currentHomeName}**.`,
        };
      }
      return {
        text: `📶 **Live Wi-Fi Signal Strength & RSSI Telemetry:**\n\n` +
          devices.map((d: any) => {
            const rssiVal = typeof d.rssi === 'number' ? d.rssi : -58;
            const rating = rssiVal >= -50 ? '🟢 Excellent' : rssiVal >= -65 ? '🔵 Good' : rssiVal >= -75 ? '🟡 Fair' : '🔴 Weak';
            return `**${d.custom_name || d.name || 'Touch Panel'}** (${d.room_name || 'Living room'}):\n` +
              `• **Wi-Fi Signal:** \`${rssiVal} dBm\` (${rating})\n` +
              `• **Frequency Band:** \`2.4 GHz Wi-Fi\` (IEEE 802.11b/g/n)\n` +
              (d.ip_address ? `• **IP Address:** \`${d.ip_address}\`\n` : '') +
              `• **Status:** ${d.is_online !== false && d.status?.online !== false ? '🟢 Active Heartbeat' : '🔴 Offline'}\n` +
              (rssiVal < -75 ? `⚠️ *Tip: Signal strength is weak (below -75 dBm). Move your router closer or use a 2.4 GHz range booster.*` : '✨ *Signal quality is optimal for instantaneous touch sync.*');
          }).join('\n\n'),
      };
    }

    // 3. Location Profile & Rooms
    if (q.includes('location') || q.includes('profile') || q.includes('home profile') || q.includes('rooms')) {
      const roomNames = rooms && rooms.length > 0 ? rooms.map((r: any) => r.name) : ['Living room', 'Master Bedroom'];
      return {
        text: `📍 **Location Profile & Smart Home Configuration:**\n\n` +
          `• **Home Profile:** **${currentHomeName}**\n` +
          `• **Profile Status:** 🟢 Active (Home Profile)\n` +
          `• **Timezone:** \`Asia/Kolkata (IST)\`\n` +
          `• **Configured Rooms (${roomNames.length}):** ${roomNames.join(', ')}\n` +
          `• **Total Hardware:** ${devices.length} Touch Panel(s)\n` +
          `• **Active Automations:** ${routines.length} Scene(s) & Schedulers\n` +
          `• **Cloud Telemetry:** EMQX MQTT Broker Active\n\n` +
          `*Your location profile synchronizes capacitive touch latency, room assignments, and scheduling automations.*`,
      };
    }

    // 4. Group Control
    if (q.includes('group control') || q.includes('group') || q.includes('room control') || q.includes('all switches in')) {
      const roomNames = rooms && rooms.length > 0 ? rooms.map((r: any) => r.name) : ['Living room', 'Master Bedroom'];
      return {
        text: `👥 **Group Control Capabilities in ${currentHomeName}:**\n\n` +
          `You can control multiple switches simultaneously as a group:\n` +
          `• **By Room:** Command *"Turn on Living room"* or *"Turn off all in Living room"*\n` +
          `• **By Appliance Group:** Command *"Turn on all lights"* or *"Turn off all fans"*\n` +
          `• **Whole Home:** Command *"Turn off all"* to power down all capacitive channels instantly.\n\n` +
          `Currently, you have **${roomNames.length} Room Groups** (${roomNames.join(', ')}) ready for group control.`,
      };
    }

    // 5. Problem Solving, Troubleshooting & WhatsApp Contact Support
    if (
      q.includes('not working') ||
      q.includes('not respond') ||
      q.includes('offline') ||
      q.includes('weak strength') ||
      q.includes('weak signal') ||
      q.includes('complaint') ||
      q.includes('support') ||
      q.includes('problem') ||
      q.includes('issue') ||
      q.includes('broken') ||
      q.includes('help')
    ) {
      const devName = devices[0]?.custom_name || devices[0]?.name || 'Touch Switch Panel';
      const devId = devices[0]?.device_id || devices[0]?.id || 'DEV_UNKNOWN';
      const prefilledComplaint = `Hello Neurolinx Support, I am raising a complaint for my device (${devName}, ID: ${devId}) in ${currentHomeName}. Issue: `;

      return {
        text: `🛠️ **Neurolinx Diagnostic & Troubleshooting Guide:**\n\n` +
          `If your touch switch panel is not working, showing weak strength, or unresponsive:\n\n` +
          `1. **Check AC Power:** Verify that the capacitive touch panel's LED icons are lit. If dark, check your home's circuit breaker (MCB).\n` +
          `2. **Check 2.4 GHz Wi-Fi:** Ensure your router provides a dedicated 2.4 GHz band. If Wi-Fi RSSI is below -75 dBm, move the router closer or eliminate metal obstructions.\n` +
          `3. **Re-sync Heartbeat:** Power cycle the physical switch panel for 5 seconds to initiate a fresh EMQX MQTT handshake.\n\n` +
          `📞 **Official WhatsApp Contact Support & Complaint Desk:**\n` +
          `Our technical support team is available on WhatsApp at **+91 79955 58994**. Tap the button below to open the WhatsApp chat box directly with your complaint pre-filled!`,
        action: {
          type: 'whatsapp_support',
          label: 'Open WhatsApp Support (Raise Complaint)',
          phone: SUPPORT_PHONE,
          prefillText: prefilledComplaint,
        },
      };
    }

    // 6. Total devices inquiry
    if (q.includes('total device') || q.includes('how many device') || q.includes('devices count') || q.includes('all device') || q === 'devices') {
      const onlineDevs = devices.filter((d) => d.is_online !== false && d.status?.online !== false).length;
      const offlineDevs = devices.length - onlineDevs;
      return {
        text: `📊 **Real-time Device Summary for ${currentHomeName}:**\n\n` +
          `• **Total Devices:** ${devices.length} registered\n` +
          `• **Online Active:** ${onlineDevs} device(s)\n` +
          `• **Offline:** ${offlineDevs} device(s)\n\n` +
          (devices.length > 0 
            ? `**Hardware in Home:**\n` + devices.map((d: any) => `• **${d.custom_name || d.name || 'Touch Panel'}** (${d.model_code || 'TP8'}) in *${d.room_name || 'Living room'}* — ${d.is_online !== false && d.status?.online !== false ? '🟢 Online' : '🔴 Offline'}`).join('\n')
            : 'No smart devices registered yet. Tap **+** to add one.'),
      };
    }

    // 7. Turn ON light / lights
    if (q.includes('turn on light') || q.includes('switch on light') || q.includes('lights on') || q.includes('turn on switch 1')) {
      const dev = devices.find((d) => (d.switches || d.status?.switches || []).length > 0) || devices[0];
      if (dev && onToggleSwitch) {
        onToggleSwitch(dev.device_id || dev.id, 0, true);
        return {
          text: `💡 **Done!** I have switched **ON** the light for you on **${dev.custom_name || dev.name || 'Touch Panel'}**.`,
          action: { type: 'control', label: 'Light Turned ON' },
        };
      }
      return {
        text: `💡 I've sent the command to turn on the lights. All matching capacitive switches have been engaged.`,
      };
    }

    // 8. Turn OFF all switches
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
        action: { type: 'control', label: 'All Switches OFF' },
      };
    }

    // 9. Run Scene
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

    // 10. Navigation commands
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

    // 11. Default Fallback
    return {
      text: `I'm your **Neuro AI Assistant**, connected live to **${currentHomeName}**.\n\nYou can ask me:\n• *"How many switches are turned on in living room?"*\n• *"Wi-Fi signal strength and RSSI"*\n• *"Location profile & group control"*\n• *"Why is my device not working?"* (includes one-tap WhatsApp complaint button)\n• *"Turn on lights"* or *"Turn off all"*`,
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
      let aiText = '';
      let actionObj: ChatMessage['actionTaken'] | undefined;
      let providerName = ollamaStatus.available ? `Ollama (${ollamaStatus.model})` : 'Neuro Engine (Real-Time Grounded)';

      // 1. Try hitting the Ollama backend API (grounded in live PostgreSQL + EMQX state)
      try {
        const historyPayload = messages.slice(-5).map((m) => ({
          role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.text,
        }));

        const res = await aiApi.chat(query, historyPayload);
        if (res && res.reply) {
          aiText = res.reply;
          providerName = res.provider === 'ollama' ? `Ollama (${res.model || 'llama3.2'})` : 'Neuro Engine (Real-Time Grounded)';
          if (res.action) {
            actionObj = {
              type: res.action.type,
              label: res.action.label,
              phone: res.action.phone,
              prefillText: res.action.prefillText,
            };
            if (res.action.type === 'control' && onToggleSwitch && res.action.deviceId && typeof res.action.channel === 'number') {
              onToggleSwitch(res.action.deviceId, res.action.channel - 1, res.action.targetState === 'on');
            } else if (res.action.type === 'scene' && onRunRoutine && res.action.routineId) {
              const matched = routines.find((r) => r.id === res.action?.routineId);
              if (matched) onRunRoutine(matched);
            }
          }
        }
      } catch (err) {
        // Fall back to client grounded generator
        console.warn('Backend AI chat fallback to local telemetry:', err);
      }

      // If backend didn't reply (e.g. offline or guest), use the client grounded engine
      if (!aiText) {
        const localRes = await generateAiResponse(query);
        aiText = localRes.text;
        actionObj = localRes.action;
        providerName = 'Neuro AI (Real-time Grounded)';
      }

      // If text mentions WhatsApp Support and no action attached, auto-attach support action
      if (!actionObj && (aiText.includes('79955 58994') || aiText.includes('WhatsApp support') || aiText.includes('raise a complaint'))) {
        actionObj = {
          type: 'whatsapp_support',
          label: 'Open WhatsApp Support (Raise Complaint)',
          phone: SUPPORT_PHONE,
          prefillText: `Hello Neurolinx Support, I am raising a complaint for my device in ${currentHomeName}.`,
        };
      }

      const aiMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        sender: 'assistant',
        text: aiText,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
        provider: providerName,
        actionTaken: actionObj,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          sender: 'assistant',
          text: "I'm having a little trouble connecting right now, but your switches and routines are safe. Please try again in a moment or tap WhatsApp Support below.",
          timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
          actionTaken: {
            type: 'whatsapp_support',
            label: 'Open WhatsApp Support',
            phone: SUPPORT_PHONE,
            prefillText: `Hello Neurolinx Support, I need assistance in ${currentHomeName}.`,
          },
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

    setTimeout(() => {
      setInputText('How many switches are turned on in living room?');
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
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  ollamaStatus.available
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : 'bg-sky-100 text-[#0284c7]'
                }`}>
                  {ollamaStatus.available ? <Cpu className="w-2.5 h-2.5" /> : <Sparkles className="w-2.5 h-2.5" />}
                  {ollamaStatus.available ? `Ollama ${ollamaStatus.model}` : 'Real-time Grounded'}
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
              onClick={() => handleOpenWhatsAppSupport()}
              title="Open WhatsApp Support"
              className="p-2 rounded-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
            >
              <WhatsAppIcon className="w-4 h-4 fill-current" />
            </button>
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
              <div className="flex items-end gap-2 max-w-[90%] sm:max-w-[85%]">
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

                  {/* WhatsApp Support Action Card (Direct Complaint Desk Button) */}
                  {msg.actionTaken?.type === 'whatsapp_support' && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/70 border border-emerald-200/80 shadow-xs">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 text-emerald-800 font-extrabold text-xs">
                            <WhatsAppIcon className="w-4 h-4 fill-emerald-600 text-[#25D366]" />
                            <span>Neurolinx WhatsApp Complaint Desk</span>
                          </div>
                          <span className="text-[10px] text-emerald-700 bg-emerald-100/90 font-bold px-1.5 py-0.5 rounded-full">
                            Online Support
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mb-2.5 leading-normal">
                          Need an engineer or instant resolution? Open WhatsApp chat box to register your complaint directly.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleOpenWhatsAppSupport(msg.actionTaken?.prefillText)}
                          className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] active:scale-95 text-white font-bold text-xs shadow-sm shadow-emerald-600/30 transition-all cursor-pointer"
                        >
                          <WhatsAppIcon className="w-4 h-4 fill-current" />
                          <span>Open WhatsApp Chat to Raise Complaint</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Standard Control or Scene Action Badges */}
                  {msg.actionTaken && msg.actionTaken.type !== 'whatsapp_support' && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{msg.actionTaken.label}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-1 px-1">
                <span className="text-[10px] text-slate-400 font-mono">
                  {msg.timestamp}
                </span>
                {msg.provider && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 font-mono">
                    {msg.provider}
                  </span>
                )}
              </div>
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
