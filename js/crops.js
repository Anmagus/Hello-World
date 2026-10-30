/** Tuesday production crops. Days-to-harvest is plant morning → Tuesday cut. */

export const PRODUCTION_CROPS = [
  {
    id: "nasturtium",
    name: "Nasturtium",
    variety: "Empress of India",
    daysToHarvest: 18,
    note: "Bigger leaves. Planting is never scheduled on Tuesday (harvest and delivery day).",
    tone: "gold",
  },
  {
    id: "amaranth",
    name: "Amaranth",
    variety: "Red Garnet",
    daysToHarvest: 14,
    note: "14 days would fall on a Tuesday, so plant Monday and still cut Tuesday.",
    tone: "garnet",
  },
  {
    id: "cilantro",
    name: "Cilantro",
    variety: "Coriander",
    daysToHarvest: 25,
    note: "Slow crop. Planting is never scheduled on Tuesday (harvest and delivery day).",
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
