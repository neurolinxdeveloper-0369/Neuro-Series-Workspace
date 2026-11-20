import { findOwnedDevice } from '../homes/home.access.js';
import { homeService } from '../homes/home.service.js';
import { deviceService } from '../devices/device.service.js';
import { routineService } from '../routines/routine.service.js';

export interface AiChatAction {
  type: 'control' | 'scene' | 'nav' | 'whatsapp_support';
  deviceId?: string;
  channel?: number;
  targetState?: 'on' | 'off';
  routineId?: string;
  tabId?: string;
  phone?: string;
  prefillText?: string;
  label: string;
}

export interface RealtimeTelemetryContext {
  userId: string;
  homeName: string;
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  locationProfile: {
    homeName: string;
    profileStatus: string;
    timezone: string;
    wifiSsid?: string;
    rooms: string[];
  };
  devices: Array<{
    id: string;
    deviceId: string;
    name: string;
    model: string;
    roomName: string;
    isOnline: boolean;
    ipAddress?: string;
    rssi?: number;
    signalRating: 'Excellent' | 'Good' | 'Fair' | 'Weak';
    switches: Array<{
      channel: number;
      name: string;
      isOn: boolean;
      controlledByScenes: string[];
    }>;
  }>;
  routines: Array<{
    id: string;
    name: string;
    type: string;
    actionCount: number;
    actions: Array<{
      deviceId: string;
      channel: number;
      switchName: string;
      targetState: boolean;
    }>;
  }>;
}

export const SUPPORT_WHATSAPP_PHONE = '917995558994';

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
  public async getRealtimeContext(userId: string, requestedHomeId?: string): Promise<RealtimeTelemetryContext> {
    try {
      const homes = await homeService.getHomesByOwner(userId);
      const primaryHome = requestedHomeId ? homes.find(home => home.id === requestedHomeId) : homes[0];
      const homeId = primaryHome?.id;
      const homeName = primaryHome?.name || 'Neurolinx';

      if (!homeId) {
        return {
          userId,
          homeName,
          totalDevices: 0,
          onlineDevices: 0,
          offlineDevices: 0,
          locationProfile: {
            homeName,
            profileStatus: 'Active (Home Profile)',
            timezone: 'Asia/Kolkata (IST)',
            wifiSsid: 'Neurolinx_Smart_2.4G',
            rooms: ['Living room', 'Master Bedroom'],
          },
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
      const roomNames: string[] = [];
      for (const r of roomsRaw) {
        roomMap.set(r.id, r.name);
        roomNames.push(r.name);
      }
      if (roomNames.length === 0) {
        roomNames.push('Living room', 'Master Bedroom');
      }

      // Build mapping of which scene/routine controls which device channel
      const sceneActionMap = new Map<string, string[]>(); // key: `${deviceId}_${channel}` => array of routine names
      const routines = routinesRaw.map((r: any) => {
        const actionList = (r.actions || []).map((a: any) => ({
          deviceId: a.deviceId,
          channel: Number(a.channel),
          switchName: a.switchName || `Switch ${a.channel}`,
          targetState: Boolean(a.targetState),
        }));

        for (const act of actionList) {
          const key = `${act.deviceId}_${act.channel}`;
          const existing = sceneActionMap.get(key) || [];
          if (!existing.includes(r.name)) {
            existing.push(r.name);
          }
          sceneActionMap.set(key, existing);
        }

        return {
          id: r.id,
          name: r.name,
          type: r.type,
          actionCount: actionList.length,
          actions: actionList,
        };
      });

      const now = Date.now();
      const devices = devicesRaw.map((d: any) => {
        const isOnline = Boolean(d.is_online) && d.last_seen_at && (now - new Date(d.last_seen_at).getTime() <= 12000);
        const devRoom = d.room_id ? roomMap.get(d.room_id) || 'Living room' : 'Living room';

        const switchList: Array<{ channel: number; name: string; isOn: boolean; controlledByScenes: string[] }> = [];
        const rawSwitches = d.switches || {};
        const rawConfigs = d.switch_configs || [];

        const count = d.model_code === 'TP6' ? 6 : d.model_code === 'TP4' ? 4 : d.model_code === 'TP2' ? 2 : d.model_code === 'TP1' ? 1 : 8;
        for (let i = 1; i <= count; i++) {
          const cfg = rawConfigs.find((c: any) => c.index === i - 1);
          const channelKey = `${d.device_id || d.id}_${i}`;
          const scenesForChannel = sceneActionMap.get(channelKey) || [];

          switchList.push({
            channel: i,
            name: cfg?.name || `Switch ${i}`,
            isOn: Boolean(rawSwitches[String(i)]),
            controlledByScenes: scenesForChannel,
          });
        }

        const rssiVal = typeof d.rssi === 'number' ? d.rssi : -58;
        const signalRating: 'Excellent' | 'Good' | 'Fair' | 'Weak' =
          rssiVal >= -50 ? 'Excellent' : rssiVal >= -65 ? 'Good' : rssiVal >= -75 ? 'Fair' : 'Weak';

        return {
          id: d.id,
          deviceId: d.device_id || d.id,
          name: d.custom_name || d.device_id,
          model: d.model_code || 'TP8',
          roomName: devRoom,
          isOnline: Boolean(isOnline),
          ipAddress: d.ip_address || undefined,
          rssi: rssiVal,
          signalRating,
          switches: switchList,
        };
      });

      const onlineCount = devices.filter((d) => d.isOnline).length;
      const offlineCount = devices.length - onlineCount;

      return {
        userId,
        homeName,
        totalDevices: devices.length,
        onlineDevices: onlineCount,
        offlineDevices: offlineCount,
        locationProfile: {
          homeName,
          profileStatus: 'Active (Home Profile)',
          timezone: 'Asia/Kolkata (IST)',
          wifiSsid: primaryHome?.default_wifi_ssid || 'Neurolinx_Smart_2.4G',
          rooms: roomNames,
        },
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
        locationProfile: {
          homeName: 'Neurolinx',
          profileStatus: 'Active (Home Profile)',
          timezone: 'Asia/Kolkata (IST)',
          rooms: ['Living room', 'Master Bedroom'],
        },
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
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
    requestedHomeId?: string
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
    const telemetry = await this.getRealtimeContext(userId, requestedHomeId);
    const ollamaCheck = await this.isOllamaAvailable();

    // If Ollama is available locally, run grounded prompt through Ollama
    if (ollamaCheck.available) {
      try {
        const chosenModel = ollamaCheck.models.includes(this.ollamaModel)
          ? this.ollamaModel
          : ollamaCheck.models[0] || 'llama3.2';

        const systemPrompt = `You are Neuro AI, the intelligent voice and smart home assistant for "${telemetry.homeName}", built for the Neuro Series capacitive touch ecosystem.
You have REAL-TIME direct telemetry access to the user's devices, rooms, switches, and scenes.

=== LIVE SMART HOME TELEMETRY ===
Current Home: ${telemetry.homeName}
Location Profile: ${telemetry.locationProfile.profileStatus} | Timezone: ${telemetry.locationProfile.timezone} | Wi-Fi SSID: ${telemetry.locationProfile.wifiSsid || 'Neurolinx_2.4G'}
Configured Rooms: ${telemetry.locationProfile.rooms.join(', ')}
Total Devices: ${telemetry.totalDevices} (${telemetry.onlineDevices} Online, ${telemetry.offlineDevices} Offline)

Connected Hardware & Switch Gangs:
${telemetry.devices.map((d, i) => `
[Device ${i + 1}]
- Custom Name: ${d.name}
- Device ID: ${d.deviceId}
- Model: ${d.model} (${d.switches.length}-Gang Capacitive Touch Panel)
- Room: ${d.roomName}
- Status: ${d.isOnline ? 'Online (Active 12s Heartbeat)' : 'Offline'}
${d.ipAddress ? `- Local IP: ${d.ipAddress}` : ''}
- Wi-Fi RSSI: ${d.rssi} dBm (Quality: ${d.signalRating})
- Switches Breakdown:
  ${d.switches.map((s) => `• ID ${s.channel} (${s.name}): ${s.isOn ? 'ON 🟢' : 'OFF ⚪'}${s.controlledByScenes.length > 0 ? ` [Controlled by Scene: "${s.controlledByScenes.join(', ')}"]` : ''}`).join('\n  ')}
`).join('\n')}

Active Automations & Scenes:
${telemetry.routines.length > 0 ? telemetry.routines.map((r) => `• ${r.name} (${r.type}, ${r.actionCount} actions, id: ${r.id})`).join('\n') : '• No active scenes'}

Support Desk:
- WhatsApp Support Number: +91 79955 58994

=== FORMATTING & RESPONSE RULES ===
1. ROOM & SWITCH STATUS INQUIRIES:
When the user asks how many switches are turned ON or what switches are in a room (e.g. "how many switches are turned on in living room", "what are there in living room", "which switches are on"):
- Give the exact count: e.g. "In Living room, 2 of 8 switches are currently turned ON."
- Detail which switches are ON with ID and name:
  e.g.: "• ID 1 Light 2 was ON 🟢"
  "• ID 4 Fan 1 was ON 🟢"
- Explicitly list the remaining switches in OFF position:
  e.g.: "• Remaining switches are in OFF position: ID 2 (Switch 2), ID 3 (Switch 3), ID 5 (Switch 5)... ⚪"
- If a switch is controlled by a scene, explicitly state it:
  e.g.: "• ID 2 Light 4 was controlled by Scene 'Good Morning' 🌅"

2. WI-FI RSSI & SIGNAL INQUIRIES:
- Report exact RSSI dBm values (e.g. -58 dBm) and rating (Excellent / Good / Fair / Weak).
- Note that capacitive touch panels require stable 2.4 GHz Wi-Fi.

3. LOCATION PROFILE & GROUP CONTROL INQUIRIES:
- Answer with Home Name, Active Profile, Timezone (IST), and configured rooms.
- Support Group Control: explain that rooms or appliance groups can be toggled together as a group.

4. PROBLEM SOLVING & TROUBLESHOOTING (Why device not working, weak strength, device offline, switch unresponsive, raise complaint):
- Provide clear diagnostic steps (1. Check AC 230V mains power, 2. Check 2.4GHz Wi-Fi signal & router distance, 3. Power-cycle the panel).
- ALWAYS provide direct access to WhatsApp contact support so the user can open the chat box to raise a complaint!
- Include the following JSON action at the end:
\`\`\`json
{"action":"whatsapp_support","phone":"917995558994","prefillText":"Hello Neurolinx Support, I am raising a complaint for my device: <Issue description>"}
\`\`\`

5. SWITCH CONTROL & SCENE EXECUTION:
- If toggling a switch, explain what you did and include:
\`\`\`json
{"action":"control","deviceId":"<deviceId>","channel":<channel_number>,"targetState":"on"|"off"}
\`\`\`
- If running a scene, include:
\`\`\`json
{"action":"scene","routineId":"<routineId>"}
\`\`\``;

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
              temperature: 0.25,
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
              if (parsed.action === 'control' && typeof parsed.deviceId === 'string' && Number.isInteger(parsed.channel) &&
                  (parsed.targetState === 'on' || parsed.targetState === 'off')) {
                const device = await findOwnedDevice(userId, parsed.deviceId);
                if (!device || !telemetry.devices.some(item => item.deviceId === device.device_id)) throw new Error('Device not found in the active location');
                await deviceService.controlSwitch(device.device_id, parsed.channel, parsed.targetState);
                action = {
                  type: 'control',
                  deviceId: parsed.deviceId,
                  channel: Number(parsed.channel),
                  targetState: parsed.targetState === 'on' ? 'on' : 'off',
                  label: `${parsed.targetState === 'on' ? 'Turned ON' : 'Turned OFF'} Channel ${parsed.channel}`,
                };
              } else if (parsed.action === 'scene' && typeof parsed.routineId === 'string') {
                if (!telemetry.routines.some(routine => routine.id === parsed.routineId)) throw new Error('Routine not found in the active location');
                const outcome = await routineService.executeRoutine(parsed.routineId, userId);
                if (!outcome.success) throw new Error('Some or all routine commands could not be sent');
                action = {
                  type: 'scene',
                  routineId: parsed.routineId,
                  label: `Executed Scene`,
                };
              } else if (parsed.action === 'whatsapp_support') {
                action = {
                  type: 'whatsapp_support',
                  phone: parsed.phone || SUPPORT_WHATSAPP_PHONE,
                  prefillText: parsed.prefillText || `Hello Neurolinx Support, I am raising a complaint for ${telemetry.homeName}.`,
                  label: 'Raise Complaint via WhatsApp',
                };
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
    return this.generateGroundedResponse(message, telemetry, userId);
  }

  /**
   * Deterministic Real-Time Grounded Engine with full PostgreSQL + EMQX telemetry support
   */
  private async generateGroundedResponse(
    message: string,
    telemetry: RealtimeTelemetryContext,
    userId: string
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

    // A. Room-Specific or General Switch State Breakdown
    // (e.g. "how many switches are turned on in living room", "what are there in living room", "living room switches")
    if (
      q.includes('living room') ||
      q.includes('bedroom') ||
      q.includes('switches are turned on') ||
      q.includes('switches are on') ||
      q.includes('what are there') ||
      q.includes('switch status') ||
      q.includes('how many switches')
    ) {
      // Determine target room if specified
      let matchedRoom = telemetry.locationProfile.rooms.find((r) => q.includes(r.toLowerCase())) || 'Living room';
      let roomDevices = telemetry.devices.filter((d) => d.roomName.toLowerCase() === matchedRoom.toLowerCase());
      if (roomDevices.length === 0 && telemetry.devices.length > 0) {
        roomDevices = [telemetry.devices[0]];
        matchedRoom = roomDevices[0].roomName;
      }

      if (roomDevices.length === 0) {
        reply = `💡 **Switch Status for ${matchedRoom}:**\n\nNo touch switch panels are assigned to **${matchedRoom}** yet in **${telemetry.homeName}**. Tap **+** in Devices to add a room or pair a device.`;
      } else {
        const allSwitches: Array<{
          deviceId: string;
          deviceName: string;
          channel: number;
          name: string;
          isOn: boolean;
          controlledByScenes: string[];
        }> = [];

        for (const dev of roomDevices) {
          for (const s of dev.switches) {
            allSwitches.push({
              deviceId: dev.deviceId,
              deviceName: dev.name,
              channel: s.channel,
              name: s.name,
              isOn: s.isOn,
              controlledByScenes: s.controlledByScenes,
            });
          }
        }

        const onSwitches = allSwitches.filter((s) => s.isOn);
        const offSwitches = allSwitches.filter((s) => !s.isOn);

        reply = `💡 **Real-time Switch Status — ${matchedRoom}:**\n\n` +
          `• **Total Switches:** ${allSwitches.length} capacitive channels\n` +
          `• **Turned ON:** ${onSwitches.length} active\n` +
          `• **Turned OFF:** ${offSwitches.length} idle\n\n`;

        if (onSwitches.length > 0) {
          reply += `🟢 **Active Switches (Turned ON):**\n` +
            onSwitches.map((s) => {
              const sceneNote = s.controlledByScenes.length > 0 
                ? ` *(Controlled by Scene: "${s.controlledByScenes.join(', ')}")*` 
                : '';
              return `• **ID ${s.channel} ${s.name}**: was ON${sceneNote}`;
            }).join('\n') + '\n\n';
        } else {
          reply += `🟢 **Active Switches:** None currently turned ON.\n\n`;
        }

        if (offSwitches.length > 0) {
          reply += `⚪ **Remaining Switches in OFF Position:**\n` +
            offSwitches.map((s) => {
              const sceneNote = s.controlledByScenes.length > 0 
                ? ` *(Automated in Scene: "${s.controlledByScenes.join(', ')}")*` 
                : '';
              return `• **ID ${s.channel} ${s.name}**: in OFF position${sceneNote}`;
            }).join('\n');
        }

        // Highlight any scene-controlled switches
        const sceneControlled = allSwitches.filter((s) => s.controlledByScenes.length > 0);
        if (sceneControlled.length > 0) {
          reply += `\n\n🎬 **Scene Automations:**\n` +
            sceneControlled.map((s) => `• ID ${s.channel} ${s.name} is controlled by Scene **"${s.controlledByScenes.join(', ')}"**`).join('\n');
        }
      }
    }

    // B. Wi-Fi RSSI / Signal Strength Details
    else if (q.includes('rssi') || q.includes('wifi') || q.includes('wi-fi') || q.includes('signal') || q.includes('strength')) {
      if (telemetry.devices.length === 0) {
        reply = `📶 **Wi-Fi Telemetry:** No devices currently connected to report RSSI in **${telemetry.homeName}**.`;
      } else {
        reply = `📶 **Live Wi-Fi Signal Strength & RSSI Telemetry:**\n\n` +
          telemetry.devices.map((d) => {
            const ratingIcon = d.signalRating === 'Excellent' ? '🟢' : d.signalRating === 'Good' ? '🔵' : d.signalRating === 'Fair' ? '🟡' : '🔴';
            return `**${d.name}** (${d.roomName}):\n` +
              `• **Signal Strength:** \`${d.rssi} dBm\` ${ratingIcon} **${d.signalRating}**\n` +
              `• **Frequency Band:** \`2.4 GHz Wi-Fi\` (IEEE 802.11b/g/n)\n` +
              (d.ipAddress ? `• **Local IP:** \`${d.ipAddress}\`\n` : '') +
              `• **EMQX Heartbeat:** ${d.isOnline ? '🟢 Connected (12s interval)' : '🔴 Unreachable'}\n` +
              (d.rssi && d.rssi < -75 ? `⚠️ *Tip: Signal is weak (below -75 dBm). Consider moving your Wi-Fi router closer or using a 2.4 GHz range extender.*` : '✨ *Signal strength is optimal for instant capacitive touch sync.*');
          }).join('\n\n');
      }
    }

    // C. Location Profile & Rooms Details
    else if (q.includes('location') || q.includes('profile') || q.includes('home profile') || q.includes('rooms')) {
      reply = `📍 **Location Profile & Smart Home Configuration:**\n\n` +
        `• **Home Profile:** **${telemetry.locationProfile.homeName}**\n` +
        `• **Profile Status:** 🟢 ${telemetry.locationProfile.profileStatus}\n` +
        `• **Timezone:** \`${telemetry.locationProfile.timezone}\`\n` +
        `• **Wi-Fi SSID:** \`${telemetry.locationProfile.wifiSsid || 'Neurolinx_Smart_2.4G'}\`\n` +
        `• **Configured Rooms (${telemetry.locationProfile.rooms.length}):** ${telemetry.locationProfile.rooms.join(', ')}\n` +
        `• **Total Hardware:** ${telemetry.totalDevices} Touch Panels (${telemetry.onlineDevices} Online)\n` +
        `• **Active Automations:** ${telemetry.routines.length} Scene(s) & Schedulers\n\n` +
        `*Your profile synchronizes room groupings, capacitive sensitivity, and cloud MQTT telemetry in real-time.*`;
    }

    // D. Group Control Queries & Execution
    else if (q.includes('group control') || q.includes('group') || q.includes('all switches in') || q.includes('room control')) {
      reply = `👥 **Group Control Capabilities in ${telemetry.homeName}:**\n\n` +
        `You can control multiple switches simultaneously as a group:\n` +
        `• **By Room:** Command *"Turn on Living room"* or *"Turn off all in Living room"*\n` +
        `• **By Appliance Group:** Command *"Turn on all lights"* or *"Turn off all fans"*\n` +
        `• **Whole Home:** Command *"Turn off all"* to power down all capacitive channels instantly.\n\n` +
        `Currently, you have **${telemetry.locationProfile.rooms.length} Room Groups** (${telemetry.locationProfile.rooms.join(', ')}) and **${telemetry.totalDevices} touch panels** ready for group control.`;
    }

    // E. Problem Solving & Troubleshooting (Device not working, weak strength, offline, raise complaint, support)
    else if (
      q.includes('not working') ||
      q.includes('not respond') ||
      q.includes('offline') ||
      q.includes('weak strength') ||
      q.includes('weak signal') ||
      q.includes('complaint') ||
      q.includes('support') ||
      q.includes('problem') ||
      q.includes('issue') ||
      q.includes('help')
    ) {
      const devName = telemetry.devices[0]?.name || 'Touch Switch Panel';
      const devId = telemetry.devices[0]?.deviceId || 'DEV_UNKNOWN';
      const prefilledComplaint = `Hello Neurolinx Support, I am raising a complaint for my device (${devName}, ID: ${devId}) in ${telemetry.homeName}. Issue: `;

      action = {
        type: 'whatsapp_support',
        phone: SUPPORT_WHATSAPP_PHONE,
        prefillText: prefilledComplaint,
        label: 'Open WhatsApp Support (Raise Complaint)',
      };

      reply = `🛠️ **Neurolinx Diagnostic & Problem Solving Guide:**\n\n` +
        `If your capacitive touch switch is not responding or showing weak strength:\n\n` +
        `1. **Check AC Power:** Verify the touch panel's backlit LED icon is illuminated (solid white or light blue). If dark, check the MCB circuit breaker.\n` +
        `2. **Check 2.4 GHz Wi-Fi:** Ensure your Wi-Fi router is on 2.4 GHz (not 5 GHz only). If signal is weak (RSSI below -75 dBm), move the router closer or eliminate metal obstacles.\n` +
        `3. **Re-sync Heartbeat:** Power cycle the physical switch for 5 seconds to initiate a fresh EMQX MQTT handshake.\n\n` +
        `📞 **Direct Contact Support & Complaint Desk:**\n` +
        `If the issue persists, you can raise an official complaint directly with our support team on WhatsApp at **+91 79955 58994**.\n\n` +
        `Tap the button below to open the WhatsApp chat box with your device diagnostics pre-filled!`;
    }

    // F. Total devices inquiry
    else if (q.includes('total device') || q.includes('how many device') || q.includes('all device') || q === 'devices') {
      reply = `📊 **Real-time Device Summary for ${telemetry.homeName}:**\n\n` +
        `• **Total Devices:** ${telemetry.totalDevices} registered\n` +
        `• **Online Now:** ${telemetry.onlineDevices} device(s) active\n` +
        `• **Offline:** ${telemetry.offlineDevices} device(s)\n\n` +
        (telemetry.devices.length > 0
          ? `**Registered Hardware:**\n` +
            telemetry.devices.map((d) => `• **${d.name}** (${d.model}) in *${d.roomName}* — ${d.isOnline ? '🟢 Online' : '🔴 Offline'}`).join('\n')
          : 'No hardware devices configured yet.');
    }

    // G. Switch ON control
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

    // H. Turn OFF all switches
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

    // I. Run Scene
    else if (q.includes('good morning') || (q.includes('run') && q.includes('scene'))) {
      const routine = telemetry.routines.find(r => r.type === 'scene' && r.name.toLowerCase().includes('morning')) || telemetry.routines.find(r => r.type === 'scene');
      if (routine) {
        action = {
          type: 'scene',
          routineId: routine.id,
          label: `Ran ${routine.name}`,
        };
        const outcome = await routineService.executeRoutine(routine.id, userId).catch(() => null);
        if (outcome?.success) reply = 'Scene commands sent for ' + routine.name + '. Device confirmation updates the controls.';
        else { action = undefined; reply = 'Could not run the scene completely. Check device connections and try again.'; }
      } else {
        reply = `🌅 Good morning! Your home is online and responsive. You have not configured a specific "Good Morning" scene yet—tap the **+** button in Routines to create one.`;
      }
    }

    // J. Default fallback
    else {
      reply = `I'm your **Neuro AI Assistant**, connected live to **${telemetry.homeName}** (${telemetry.totalDevices} devices, ${telemetry.onlineDevices} online).\n\nYou can ask me:\n• *"How many switches are turned on in living room?"* (gives specific IDs and ON/OFF positions)\n• *"Wi-Fi RSSI and signal strength"*\n• *"Location profile & group control"*\n• *"Why is device not working?"* (provides troubleshooting + direct WhatsApp support button)\n• *"Turn on lights"* or *"Turn off all"*`;
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
