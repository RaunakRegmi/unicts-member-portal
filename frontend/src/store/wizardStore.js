import { create } from 'zustand';

// Holds cross-step wizard state that isn't worth a server round-trip:
// the category picked on the public /apply page before signup, and the
// last step the member visited.
export const useWizardStore = create((set) => ({
  pendingCategory: sessionStorage.getItem('unicts_pending_category') || null,
  lastStep: null,

  setPendingCategory: (category) => {
    if (category) sessionStorage.setItem('unicts_pending_category', category);
    else sessionStorage.removeItem('unicts_pending_category');
    set({ pendingCategory: category });
  },
  setLastStep: (step) => set({ lastStep: step }),
}));
