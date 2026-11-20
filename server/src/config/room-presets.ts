export const ROOM_PRESETS = [
  {
    "name": "Living room",
    "image_path": "Rooms Images/Living Room.png"
  },
  {
    "name": "Bedroom",
    "image_path": "Rooms Images/Bed Room.png"
  },
  {
    "name": "Kitchen",
    "image_path": "Rooms Images/Kitchen.png"
  },
  {
    "name": "Pooja room",
    "image_path": "Rooms Images/Pooja Room.png"
  },
  {
    "name": "Dining area",
    "image_path": "Rooms Images/Dinning Area.png"
  },
  {
    "name": "Kids room",
    "image_path": "Rooms Images/Kids Bed Room.png"
  },
  {
    "name": "Balcony",
    "image_path": "Rooms Images/Balcony.png"
  },
  {
    "name": "Office",
    "image_path": "Rooms Images/Office.png"
  },
  {
    "name": "Industrial unit",
    "image_path": "Rooms Images/Industrial Unit.png"
  },
  {
    "name": "Agriculture / farm control",
    "image_path": "Rooms Images/Agriculture.png"
  },
  {
    "name": "Master Bed Room",
    "image_path": "Rooms Images/Master Bed Room.png"
  },
  {
    "name": "TV Area",
    "image_path": "Rooms Images/TV Area.png"
  },
  {
    "name": "Guest Room",
    "image_path": "Rooms Images/Guest Room.png"
  },
  {
    "name": "Store Room",
    "image_path": "Rooms Images/Store Room.png"
  },
  {
    "name": "Theatre Room",
    "image_path": "Rooms Images/Theater Room.png"
  }
] as const;

const normalize = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
export function getRoomImage(name: string): string | null {
  const key = normalize(name);
  const aliases: Record<string, string> = { masterbedroom: 'masterbedroom', kidsbedroom: 'kidsroom', dining: 'diningarea', dinningarea: 'diningarea', bedroom: 'bedroom', theaterroom: 'theatreroom', agriculture: 'agriculturefarmcontrol', guestbedroom: 'guestroom' };
  return ROOM_PRESETS.find(room => normalize(room.name) === (aliases[key] || key))?.image_path ?? null;
}
