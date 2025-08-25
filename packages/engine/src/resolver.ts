// resolver.ts - improved defense-aware resolver (minimal TypeScript stub)
export function resolvePlay(opts: any): any {
  // This file is a stub for the engine resolvePlay used in the React app.
  // For the static/dist app we implement an equivalent JS function inline.
  const roll = () => Math.floor(Math.random()*6)+1 + Math.floor(Math.random()*6)+1 + Math.floor(Math.random()*6)+1;
  const r = roll();
  return { yards: Math.max(-7, Math.floor((r-8)/2)*3), touchdown: r===18, turnover: null, description: `roll ${r}` , clockRunoffSec: 35 };
}
