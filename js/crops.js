/** Tuesday production crops. Days-to-harvest is plant morning → Tuesday cut. */

export const PRODUCTION_CROPS = [
  {
    id: "nasturtium",
    name: "Nasturtium",
    variety: "Empress of India",
    daysToHarvest: 16,
    note: "Extra days so leaves are a little bigger than a standard cut.",
    tone: "gold",
  },
  {
    id: "amaranth",
    name: "Amaranth",
    variety: "Red Garnet",
    daysToHarvest: 10,
    note: "Tuesday restaurant rotation.",
    tone: "garnet",
  },
  {
    id: "cilantro",
    name: "Cilantro",
    variety: "Coriander",
    daysToHarvest: 17,
    note: "Slower crop — plant earlier than the others.",
    tone: "leaf",
  },
];

export function productionCrop(id) {
  return PRODUCTION_CROPS.find((c) => c.id === id) ?? null;
}

export const TRAY_STATUSES = [
  { id: "planned", label: "Plant date set" },
  { id: "planted", label: "Planted / growing" },
  { id: "harvested", label: "Harvested" },
  { id: "delivered", label: "Delivered" },
  { id: "stopped", label: "Stopped" },
];

export function statusLabel(id) {
  return TRAY_STATUSES.find((s) => s.id === id)?.label ?? id;
}
