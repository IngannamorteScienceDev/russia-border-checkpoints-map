export const DEFAULT_CAMERA = {
  west: 18,
  south: 35,
  east: 180,
  north: 82
};

const RU = {
  overview: "\u041e\u0431\u0437\u043e\u0440",
  west: "\u0417\u0430\u043f\u0430\u0434",
  south: "\u042e\u0433",
  siberia: "\u0421\u0438\u0431\u0438\u0440\u044c",
  farEast: "\u0414\u0430\u043b\u044c\u043d\u0438\u0439 \u0412\u043e\u0441\u0442\u043e\u043a",
  road: "\u0410\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u044c\u043d\u044b\u0439",
  rail: "\u0416\u0435\u043b\u0435\u0437\u043d\u043e\u0434\u043e\u0440\u043e\u0436\u043d\u044b\u0439",
  air: "\u0412\u043e\u0437\u0434\u0443\u0448\u043d\u044b\u0439",
  sea: "\u041c\u043e\u0440\u0441\u043a\u043e\u0439",
  river: "\u0420\u0435\u0447\u043d\u043e\u0439",
  pedestrian: "\u041f\u0435\u0448\u0435\u0445\u043e\u0434\u043d\u044b\u0439",
  other: "\u0414\u0440\u0443\u0433\u043e\u0435",
  high: "\u0412\u044b\u0441\u043e\u043a\u043e\u0435",
  medium: "\u0421\u0440\u0435\u0434\u043d\u0435\u0435",
  low: "\u041d\u0438\u0437\u043a\u043e\u0435",
  unknown: "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e"
};

export const CAMERA_PRESETS = [
  {
    id: "overview",
    label: RU.overview,
    bounds: DEFAULT_CAMERA
  },
  {
    id: "west",
    label: RU.west,
    bounds: { west: 18, south: 44, east: 43, north: 70 }
  },
  {
    id: "south",
    label: RU.south,
    bounds: { west: 28, south: 41, east: 56, north: 58 }
  },
  {
    id: "siberia",
    label: RU.siberia,
    bounds: { west: 56, south: 48, east: 112, north: 74 }
  },
  {
    id: "far-east",
    label: RU.farEast,
    bounds: { west: 108, south: 41, east: 180, north: 73 }
  }
];

export const CHECKPOINT_TYPES = {
  road: RU.road,
  rail: RU.rail,
  air: RU.air,
  sea: RU.sea,
  river: RU.river,
  pedestrian: RU.pedestrian,
  other: RU.other
};

export const TYPE_COLORS = {
  [CHECKPOINT_TYPES.road]: "#2f80ed",
  [CHECKPOINT_TYPES.rail]: "#27ae60",
  [CHECKPOINT_TYPES.air]: "#9b51e0",
  [CHECKPOINT_TYPES.sea]: "#0097a7",
  [CHECKPOINT_TYPES.river]: "#00a676",
  [CHECKPOINT_TYPES.pedestrian]: "#f2994a",
  [CHECKPOINT_TYPES.other]: "#7b8794"
};

export const QUALITY_LEVELS = {
  high: {
    id: "high",
    label: RU.high,
    color: "#27ae60"
  },
  medium: {
    id: "medium",
    label: RU.medium,
    color: "#f2c94c"
  },
  low: {
    id: "low",
    label: RU.low,
    color: "#eb5757"
  }
};

export const IMAGERY_OPTIONS = [
  {
    id: "satellite",
    label: "Satellite HD"
  },
  {
    id: "street",
    label: "OpenStreetMap"
  },
  {
    id: "natural-earth",
    label: "Natural Earth"
  }
];

export const DEFAULT_IMAGERY_MODE = "satellite";
export const UNKNOWN_VALUE = RU.unknown;
