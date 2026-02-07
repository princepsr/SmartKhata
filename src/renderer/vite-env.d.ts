/// <reference types="vite/client" />

// Import window.electron types from preload
import type { ElectronAPI } from '../preload/types';

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
