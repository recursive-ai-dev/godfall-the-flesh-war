import type { Faction, HudSelection } from './types';
// Decides which command groups the HUD offers for the current selection.
export interface SelectionCommands { worker: boolean; military: boolean; hall: boolean; barracks: boolean; constructing: boolean; }
export function selectionCommands(sel: HudSelection | null, faction: Faction): SelectionCommands {
  const own = !sel || sel.faction === faction || sel.faction === null;
  const units = own && (sel?.kind === 'unit' || sel?.kind === 'mixed');
  // A selection made only of workers (one or many) is a worker selection.
  const worker = units && sel?.unitType === 'worker';
  return {
    worker, military: units && !worker,
    hall: own && sel?.buildingType === 'hall', barracks: own && sel?.buildingType === 'barracks',
    constructing: own && sel?.kind === 'building' && !sel.complete,
  };
}
