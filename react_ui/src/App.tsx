import { useState } from 'react'
import './App.css'

interface Device {
  id: string
  name: string
  icon: string
  active: boolean
  room: string
  detail: string
}

const initialDevices: Device[] = [
  { id: '1', name: 'Main Lights', icon: '💡', active: true, room: 'Living Room', detail: '80% Warm' },
  { id: '2', name: 'Air Conditioner', icon: '❄️', active: true, room: 'Living Room', detail: '22°C Auto' },
  { id: '3', name: 'Smart TV', icon: '📺', active: false, room: 'Living Room', detail: 'HDMI 1' },
  { id: '4', name: 'Air Purifier', icon: '🍃', active: true, room: 'Living Room', detail: 'Clean air' },
  { id: '5', name: 'Bedside Lamp', icon: '🛋️', active: false, room: 'Bedroom', detail: 'Off' },
  { id: '6', name: 'Coffee Maker', icon: '☕', active: false, room: 'Kitchen', detail: 'Standby' },
]

const rooms = ['Living Room', 'Bedroom', 'Kitchen', 'Office']

function App() {
  const [selectedRoom, setSelectedRoom] = useState('Living Room')
  const [devices, setDevices] = useState<Device[]>(initialDevices)

  const toggleDevice = (id: string) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, active: !d.active } : d))
    )
  }

  const filteredDevices = devices.filter((d) => d.room === selectedRoom)

  return (
    <div className="app-container">
      {/* Top Bar */}
      <header className="top-bar">
        <div>
          <h1 className="greeting-title">Welcome, User</h1>
          <p className="greeting-subtitle">All systems operational</p>
        </div>
        <div className="avatar-badge" title="User Profile">
          👤
        </div>
      </header>

      {/* Main Status Banner */}
      <div className="status-card">
        <div className="status-info">
          <span className="status-label">Indoor Climate</span>
          <span className="status-value">22.5°C • 48% Hum</span>
        </div>
        <div className="status-pill">
          <span className="status-pill-dot" />
          <span>Connected</span>
        </div>
      </div>

      {/* Room Selector */}
      <nav aria-label="Room navigation">
        <h2 className="section-title">Rooms</h2>
        <div className="room-chips">
          {rooms.map((room) => (
            <button
              key={room}
              className={`room-chip ${selectedRoom === room ? 'active' : ''}`}
              onClick={() => setSelectedRoom(room)}
            >
              {room}
            </button>
          ))}
        </div>
      </nav>

      {/* Device Grid */}
      <section>
        <h2 className="section-title">Devices ({filteredDevices.length})</h2>
        <div className="device-grid">
          {filteredDevices.map((device) => (
            <div
              key={device.id}
              className={`device-card ${device.active ? 'active' : ''}`}
              onClick={() => toggleDevice(device.id)}
            >
              <div className="device-top">
                <span className="device-icon">{device.icon}</span>
                <div className={`toggle-switch ${device.active ? 'on' : ''}`}>
                  <div className="toggle-thumb" />
                </div>
              </div>
              <div className="device-info">
                <p className="device-name">{device.name}</p>
                <p className="device-status">
                  {device.active ? device.detail : 'Off'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Native Bridge Indicator */}
      <footer className="native-bridge-footer">
        <span>📱 Flutter Mobile Shell Bridge</span>
        <span style={{ color: '#22c55e' }}>● Active</span>
      </footer>
    </div>
  )
}

export default App
