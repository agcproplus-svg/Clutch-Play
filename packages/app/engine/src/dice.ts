export function rollD6(): number { return 1 + Math.floor(Math.random() * 6); }
export function roll3d6(): number { return rollD6() + rollD6() + rollD6(); }
