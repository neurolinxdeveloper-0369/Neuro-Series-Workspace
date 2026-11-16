import { homeService } from '../homes/home.service.js';
import { deviceService } from '../devices/device.service.js';
import { routineService } from '../routines/routine.service.js';

export interface AiChatAction {
  type: 'control' | 'scene' | 'nav';
  deviceId?: string;
  channel?: number;
  targetState?: 'on' | 'off';
  routineId?: string;
  tabId?: string;
  label: string;
}

export interface RealtimeTelemetryContext {
  userId: string;
  homeName: string;
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  devices: Array<{
    id: string;
    deviceId: string;
    name: string;
    model: string;
    roomName: string;
    isOnline: boolean;
    ipAddress?: string;
    rssi?: number;
    switches: Array<{
      channel: number;
      name: string;
      isOn: boolean;
    }>;
  }>;
  routines: Array<{
    id: string;
    name: string;
    type: string;
    actionCount: number;
  }>;
}

export class AiService {
  private ollamaHost: string;
  private ollamaModel: string;

  constructor() {
    this.ollamaHost = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
    this.ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2';
  }

  /**
   * Check if Ollama service is reachable on 127.0.0.1:11434
   */
  public async isOllamaAvailable(): Promise<{ available: boolean; models: string[]; host: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.ollamaHost}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as { models?: Array<{ name: string }> };
        const models = (data.models || []).map((m) => m.name);
        return { available: true, models, host: this.ollamaHost };
      }
    } catch {
      // offline or unreachable
    }
    return { available: false, models: [], host: this.ollamaHost };
  }

  /**
   * Fetch live, grounded telemetry from PostgreSQL & EMQX state
   */
  public async getRealtimeContext(userId: string): Promise<RealtimeTelemetryContext> {
    try {
      const homes = await homeService.getHomesByOwner(userId);
      const primaryHome = homes[0] || null;
      const homeId = primaryHome?.id;
      const homeName = primaryHome?.name || 'My Home';

      if (!homeId) {
        return {
          userId,
          homeName,
          totalDevices: 0,
          onlineDevices: 0,
          offlineDevices: 0,
          devices: [],
          routines: [],
        };
      }

      const [devicesRaw, roomsRaw, routinesRaw] = await Promise.all([
        deviceService.getDevicesByHome(homeId).catch(() => []),
        homeService.getRoomsByHome(homeId).catch(() => []),
        routineService.getRoutines(homeId, userId).catch(() => []),
      ]);

      const roomMap = new Map<string, string>();
      for (const r of roomsRaw) {
        roomMap.set(r.id, r.name);
      }

      const now = Date.now();
      const devices = devicesRaw.map((d: any) => {
        const isOnline = Boolean(d.is_online) && d.last_seen_at && (now - new Date(d.last_seen_at).getTime() <= 12000);
        const devRoom = d.room_id ? roomMap.get(d.room_id) || 'Living room' : 'Living room';

        const switchList: Array<{ channel: number; name: string; isOn: boolean }> = [];
        const rawSwitches = d.switches || {};
        const rawConfigs = d.switch_configs || [];

        const count = d.model_code === 'TP6' ? 6 : d.model_code === 'TP4' ? 4 : d.model_code === 'TP2' ? 2 : d.model_code === 'TP1' ? 1 : 8;
        for (let i = 1; i <= count; i++) {
          const cfg = rawConfigs.find((c: any) => c.index === i - 1);
          switchList.push({
            channel: i,
            name: cfg?.name || `Switch ${i}`,
            isOn: Boolean(rawSwitches[String(i)]),
          });
        }

        return {
          id: d.id,
          deviceId: d.device_id || d.id,
          name: d.custom_name || d.device_id,
          model: d.model_code || 'TP8',
          roomName: devRoom,
          isOnline: Boolean(isOnline),
          ipAddress: d.ip_address || undefined,
          rssi: typeof d.rssi === 'number' ? d.rssi : undefined,
          switches: switchList,
        };
      });

      const onlineCount = devices.filter((d) => d.isOnline).length;
      const offlineCount = devices.length - onlineCount;

      const routines = routinesRaw.map((r: any) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        actionCount: (r.actions || []).length,
      }));

      return {
        userId,
        homeName,
        totalDevices: devices.length,
        onlineDevices: onlineCount,
        offlineDevices: offlineCount,
        devices,
        routines,
      };
    } catch (err) {
      console.error('[AiService] Failed to gather real-time telemetry:', err);
      return {
        userId,
        homeName: 'Neurolinx',
        totalDevices: 0,
        onlineDevices: 0,
        offlineDevices: 0,
        devices: [],
        routines: [],
      };
    }
  }

  /**
   * Main chat interface with Ollama (Llama 3.2) + Live Grounded Fallback
   */
  public async chat(
    userId: string,
    message: string,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<{
    reply: string;
    action?: AiChatAction;
    realtimeContext: {
      homeName: string;
      totalDevices: number;
      onlineDevices: number;
      offlineDevices: number;
    };
    provider: 'ollama' | 'grounded-engine';
    model: string;
  }> {
    const telemetry = await this.getRealtimeContext(userId);
    const ollamaCheck = await this.isOllamaAvailable();

    // If Ollama is available locally, run grounded prompt through Ollama
    if (ollamaCheck.available) {
      try {
        const chosenModel = ollamaCheck.models.includes(this.ollamaModel)
          ? this.ollamaModel
          : ollamaCheck.models[0] || 'llama3.2';

        const systemPrompt = `You are Neuro AI, the intelligent voice and smart home assistant for "${telemetry.homeName}", built for the Neuro Series capacitive touch ecosystem.
You have REAL-TIME direct telemetry access to the user's devices, rooms, and switches.

=== LIVE SMART HOME TELEMETRY ===
Current Home: ${telemetry.homeName}
Total Devices: ${telemetry.totalDevices} (${telemetry.onlineDevices} Online, ${telemetry.offlineDevices} Offline)

Connected Devices:
${telemetry.devices.map((d, i) => `
[Device ${i + 1}]
- Custom Name: ${d.name}
- Device ID: ${d.deviceId}
- Model: ${d.model}
- Room: ${d.roomName}
- Online Status: ${d.isOnline ? 'Online (Active)' : 'Offline'}
${d.ipAddress ? `- Local IP: ${d.ipAddress}` : ''}
${d.rssi ? `- Wi-Fi RSSI Signal: ${d.rssi} dBm` : ''}
- Switches (${d.switches.length} gangs):
  ${d.switches.map((s) => `• Channel ${s.channel} (${s.name}): ${s.isOn ? 'ON' : 'OFF'}`).join('\n  ')}
`).join('\n')}

Active Automations & Scenes:
${telemetry.routines.length > 0 ? telemetry.routines.map((r) => `• ${r.name} (${r.type}, ${r.actionCount} actions, id: ${r.id})`).join('\n') : '• No active scenes'}

=== INSTRUCTIONS ===
1. Accurately answer queries about total devices, online/offline counts, device info, signal strength, IP addresses, and switch states using ONLY the real-time data above.
2. If the user asks to control or toggle any switch (e.g. "turn on lights", "turn on Switch 1 in Living Room", "turn off all"), clearly explain what you did AND include a JSON action at the end:
\`\`\`json
{"action":"control","deviceId":"<deviceId>","channel":<channel_number>,"targetState":"on"|"off"}
\`\`\`
3. If the user asks to run a scene (e.g. "run Good Morning"), include:
\`\`\`json
{"action":"scene","routineId":"<routineId>"}
\`\`\`
4. Keep responses direct, helpful, and concise with smart formatting.`;

        const messagesPayload: Array<{ role: string; content: string }> = [
          { role: 'system', content: systemPrompt },
        ];

        if (history && Array.isArray(history)) {
          for (const h of history.slice(-6)) {
            messagesPayload.push({ role: h.role, content: h.content });
          }
        }
        messagesPayload.push({ role: 'user', content: message });

        const ollamaRes = await fetch(`${this.ollamaHost}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: chosenModel,
            messages: messagesPayload,
            stream: false,
            options: {
              temperature: 0.3,
            },
          }),
        });

        if (ollamaRes.ok) {
          const data = (await ollamaRes.json()) as { message?: { content: string } };
          const rawContent = data.message?.content || '';

          // Parse any JSON action block
          let action: AiChatAction | undefined;
          const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            try {
              const parsed = JSON.parse(jsonMatch[1]);
              if (parsed.action === 'control' && parsed.deviceId && parsed.channel) {
                action = {
                  type: 'control',
                  deviceId: parsed.deviceId,
                  channel: Number(parsed.channel),
                  targetState: parsed.targetState === 'on' ? 'on' : 'off',
                  label: `${parsed.targetState === 'on' ? 'Turned ON' : 'Turned OFF'} Channel ${parsed.channel}`,
                };
                // Execute control directly on the backend
                deviceService.controlSwitch(action.deviceId!, action.channel!, action.targetState!).catch(() => {});
              } else if (parsed.action === 'scene' && parsed.routineId) {
                action = {
                  type: 'scene',
                  routineId: parsed.routineId,
                  label: `Executed Scene`,
                };
                routineService.executeRoutine(parsed.routineId).catch(() => {});
              }
            } catch {}
          }

          const cleanReply = rawContent.replace(/```json[\s\S]*?```/g, '').trim();

          return {
            reply: cleanReply || rawContent,
            action,
            realtimeContext: {
              homeName: telemetry.homeName,
              totalDevices: telemetry.totalDevices,
              onlineDevices: telemetry.onlineDevices,
              offlineDevices: telemetry.offlineDevices,
            },
            provider: 'ollama',
            model: chosenModel,
          };
        }
      } catch (err) {
        console.warn('[AiService] Ollama request failed, falling back to grounded engine:', err);
      }
    }

    // Grounded Real-Time Engine (Fall-through when Ollama is offline or spinning up)
    return this.generateGroundedResponse(message, telemetry);
  }

  /**
   * Deterministic Real-Time Grounded Engine with full PostgreSQL + EMQX telemetry support
   */
  private async generateGroundedResponse(
    message: string,
    telemetry: RealtimeTelemetryContext
  ): Promise<{
    reply: string;
    action?: AiChatAction;
    realtimeContext: {
      homeName: string;
      totalDevices: number;
      onlineDevices: number;
      offlineDevices: number;
    };
    provider: 'grounded-engine';
    model: string;
  }> {
    const q = message.toLowerCase().trim();
    let reply = '';
    let action: AiChatAction | undefined;

    // 1. Total devices inquiry
    if (q.includes('total device') || q.includes('how many device') || q.includes('all device') || q === 'devices') {
      reply = `📊 **Real-time Device Summary for ${telemetry.homeName}:**\n\n` +
        `• **Total Devices:** ${telemetry.totalDevices} registered\n` +
        `• **Online Now:** ${telemetry.onlineDevices} device(s) active\n` +
        `• **Offline:** ${telemetry.offlineDevices} device(s)\n\n` +
        (telemetry.devices.length > 0
          ? `**Registered Hardware:**\n` +
            telemetry.devices.map((d) => `• **${d.name}** (${d.model}) in *${d.roomName}* — ${d.isOnline ? '🟢 Online' : '🔴 Offline'}`).join('\n')
          : 'No hardware devices configured yet.');
    }
    // 2. Device info / Signal / IP / Diagnostics
    else if (q.includes('device info') || q.includes('info') || q.includes('status') || q.includes('ip') || q.includes('signal') || q.includes('rssi')) {
      if (telemetry.devices.length === 0) {
        reply = `ℹ️ No devices are currently associated with **${telemetry.homeName}**. Tap the **+** button in the top right to pair a device.`;
      } else {
        reply = `📡 **Live Hardware Telemetry & Diagnostics:**\n\n` +
          telemetry.devices.map((d) => 
            `**${d.name}** (${d.model}):\n` +
            `• **Status:** ${d.isOnline ? '🟢 Online (12s heartbeat active)' : '🔴 Offline'}\n` +
            `• **Device ID:** \`${d.deviceId}\`\n` +
            `• **Room:** ${d.roomName}\n` +
            (d.ipAddress ? `• **IP Address:** \`${d.ipAddress}\`\n` : '') +
            (d.rssi ? `• **Wi-Fi RSSI:** \`${d.rssi} dBm\`\n` : '') +
            `• **Active Switches:** ${d.switches.filter((s) => s.isOn).length} of ${d.switches.length} ON`
          ).join('\n\n');
      }
    }
    // 3. Switch ON control
    else if (q.includes('turn on') || q.includes('switch on') || q.includes('lights on')) {
      const targetDev = telemetry.devices.find((d) => d.isOnline) || telemetry.devices[0];
      if (targetDev) {
        action = {
          type: 'control',
          deviceId: targetDev.deviceId,
          channel: 1,
          targetState: 'on',
          label: `Turned ON ${targetDev.switches[0]?.name || 'Switch 1'}`,
        };
        deviceService.controlSwitch(targetDev.deviceId, 1, 'on').catch(() => {});
        reply = `💡 **Command Executed!** Switched **ON** **${targetDev.switches[0]?.name || 'Switch 1'}** on **${targetDev.name}** in *${targetDev.roomName}*.`;
      } else {
        reply = `⚠️ No active online capacitive switch devices were found in **${telemetry.homeName}** to toggle.`;
      }
    }
    // 4. Turn OFF all switches
    else if (q.includes('turn off all') || q.includes('all off') || q.includes('lights off') || q.includes('switch off all')) {
      let toggled = 0;
      for (const dev of telemetry.devices) {
        for (const sw of dev.switches) {
          deviceService.controlSwitch(dev.deviceId, sw.channel, 'off').catch(() => {});
          toggled++;
        }
      }
      action = {
        type: 'control',
        label: 'All Switches OFF',
      };
      reply = `🌙 **All Off Command Sent!** Turned off switches across all rooms in **${telemetry.homeName}** (${toggled} channels updated).`;
    }
    // 5. Run Good Morning / Scene
    else if (q.includes('good morning') || (q.includes('run') && q.includes('scene'))) {
      const routine = telemetry.routines.find((r) => r.type === 'scene' || r.name.toLowerCase().includes('morning')) || telemetry.routines[0];
      if (routine) {
        action = {
          type: 'scene',
          routineId: routine.id,
          label: `Ran ${routine.name}`,
        };
        routineService.executeRoutine(routine.id).catch(() => {});
        reply = `🌅 **Scene Activated!** Executed **${routine.name}** with ${routine.actionCount} automated actions across your home.`;
      } else {
        reply = `🌅 Good morning! Your home is online and responsive. You have not configured a specific "Good Morning" scene yet—tap the **+** button in Routines to create one.`;
      }
    }
    // 6. Generic query fallback
    else {
      reply = `I'm your **Neuro AI Assistant**, connected live to **${telemetry.homeName}** with **${telemetry.totalDevices} device(s)** (${telemetry.onlineDevices} online).\n\nYou can ask me:\n• *"Total devices"* or *"What devices are online?"*\n• *"Device info"* (shows live IPs, signal dBm, and switch states)\n• *"Turn on lights"* or *"Turn off all"*\n• *"Run Good Morning scene"*`;
    }

    return {
      reply,
      action,
      realtimeContext: {
        homeName: telemetry.homeName,
        totalDevices: telemetry.totalDevices,
        onlineDevices: telemetry.onlineDevices,
        offlineDevices: telemetry.offlineDevices,
      },
      provider: 'grounded-engine',
      model: 'neuro-grounded-llama',
    };
  }
}

export const aiService = new AiService();
