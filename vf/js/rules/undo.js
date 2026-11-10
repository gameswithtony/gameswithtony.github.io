// VF uses a deterministic decision journal, replayed in a fresh worker for undo.
export const newInformation = () => {};
export const pushUndo = () => {};
export const setupUndo = () => {};
export const addUndo = () => {};
export const actionUndo = () => {};
export const undo = async () => { globalThis.vfRewind?.(); };
export const undoTo = undo;
