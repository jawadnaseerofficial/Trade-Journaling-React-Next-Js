export const AXIS_TICK = { fontSize: 9, fill: "#9AA0B4", fontWeight: 600 } as const;
export const moneyTick = (v: number) => `$${v.toFixed(2)}`;