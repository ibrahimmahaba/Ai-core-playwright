import { create } from "zustand";
import type { ToastType } from "../types";

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastNotificationStore {
  toasts: ToastMessage[];
  showToast: (message: string, type: ToastType) => void;
  removeToast: (id: number) => void;
}

export const useToastNotificationStore = create<ToastNotificationStore>((set) => ({
  toasts: [],

  showToast: (message: string, type: ToastType) => {
    const id = Date.now();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }]
    }));
  },

  removeToast: (id: number) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    }));
  },
}));

