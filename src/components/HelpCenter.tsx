import { Modal } from './Modal';

export type HelpTopic = 'index' | 'account' | 'pairing' | 'devices' | 'sharing' | 'alerts' | 'privacy' | 'contact';

const guides = {
  account: {
    title: 'Sign-in and app lock',
    steps: [
      'Sign in with the same email, WhatsApp number, or Google account you used before.',
      'If a code does not arrive, check your address or number, wait for the resend countdown, and check your spam folder if you used email. Use the newest code.',
      'To protect the installed Android or iOS app, enroll face or fingerprint authentication in system settings, then enable Biometric lock in Neuro Touch Settings. If you cannot unlock it, sign out from the lock screen and use your account to sign in again.',
    ],
  },
  pairing: {
    title: 'Pair a device',
    steps: [
      'Select your location, then choose Add Device. Select the model, scan its QR code, or enter its setup code manually.',
      'Follow the device instructions to activate its setup hotspot, then connect your phone or computer to that hotspot. Enter the name and password for your 2.4 GHz home network.',
      'Stay on the pairing screen until setup and registration complete. If the hotspot disappears before confirmation, check the device and reconnect to its setup hotspot if it remains unpaired.',
      'If the browser blocks local device access, use manual hotspot setup or switch to the installed mobile app.',
    ],
  },
  devices: {
    title: 'Devices and routines',
    steps: [
      'Check the connection badge before changing a switch. An offline reading is the last value sent by the device. No reading yet means the firmware has not supplied a value.',
      'When a command is waiting for the device to confirm, check the physical equipment before sending it again.',
      'In Routines, choose a room and the switch actions. Schedules run in Indian Standard Time. Verify the days and ON and OFF times before saving.',
      'If a device stays offline, check power, Wi-Fi range, and whether it is connected to the same network it was set up on.',
    ],
  },
  sharing: {
    title: 'Invite or join a location',
    steps: [
      'An owner can open the location?s Invite button, create an invitation, then share the link or QR code. Add an email to restrict the invite to that account.',
      'Recipients can open the link in a browser or paste the invite code under Menu ? Join a location. An invitation expires after seven days and can be used once.',
      'Owners can revoke outstanding invitations and remove member access from the invitation screen.',
    ],
  },
  alerts: {
    title: 'Notifications',
    steps: [
      'Open Menu ? Notifications to see recent device connection changes and protection alerts. Mark individual items or the entire visible list as read.',
      'Enable system alerts in Settings to get a notification when the open app detects new activity and the operating system permits it. The in-app list is available after you return.',
      'If system alerts are disabled, check the device or browser notification permissions. A closed app cannot deliver a live push alert in this version.',
    ],
  },
  privacy: {
    title: 'Account and device data',
    steps: [
      'The app uses your account identifier to sign you in and determine which locations and devices you can access.',
      'Location details, device readings, schedules, and notification history are associated with your location in the service. Members can see device activity from locations shared with them.',
      'Camera, microphone, location, and notification permissions can be managed in system or browser settings. The installed app delegates biometric authentication to the operating system.',
    ],
  },
} satisfies Record<Exclude<HelpTopic, 'index' | 'contact'>, { title: string; steps: string[] }>;

export function HelpCenter({ topic, onSelect, onClose }: { topic: HelpTopic; onSelect: (topic: HelpTopic) => void; onClose: () => void }) {
  const guide = topic !== 'index' && topic !== 'contact' ? guides[topic] : undefined;
  return (
    <Modal title={guide?.title ?? (topic === 'contact' ? 'Contact support' : 'Help center')} onClose={onClose}>
      {topic === 'index' ? (
        <div className="grid gap-2">
          {(Object.entries(guides) as [keyof typeof guides, typeof guides.account][]).map(([id, item]) => (
            <button type="button" key={id} className="min-h-11 rounded-xl bg-slate-100 px-4 text-left text-sm font-semibold" onClick={() => onSelect(id)}>{item.title}</button>
          ))}
          <button type="button" className="min-h-11 rounded-xl bg-slate-100 px-4 text-left text-sm font-semibold" onClick={() => onSelect('contact')}>Contact support</button>
        </div>
      ) : (
        <>
          {guide ? (
            <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-700">
              {guide.steps.map(step => <li key={step}>{step}</li>)}
            </ol>
          ) : (
            <div className="space-y-3 text-sm leading-relaxed text-slate-700">
              <p>Include your device model, which step failed, and the error you saw. Keep Wi-Fi passwords and verification codes private.</p>
              <a href="https://wa.me/917995558994" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-sky-700 px-3 font-semibold text-white">Open WhatsApp support</a>
            </div>
          )}
          {topic === 'privacy' && <a href="https://neurolinx.in/neuro-series/privacypolicy" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-sky-700">Read the full Privacy Policy</a>}
          <button type="button" onClick={() => onSelect('index')} className="mt-3 min-h-11 text-sm font-semibold text-sky-700">All help topics</button>
        </>
      )}
    </Modal>
  );
}
