import { create } from "zustand";

interface VttState {
  activeTab: "chat" | "dice" | "dm";
  setActiveTab: (tab: "chat" | "dice" | "dm") => void;
  
  diceInput: string;
  setDiceInput: (input: string) => void;
  
  selectedTokenId: string | null;
  setSelectedTokenId: (id: string | null) => void;
  
  isDmMode: boolean;
  setIsDmMode: (isDm: boolean) => void;
  
  activeTool: "select" | "measure" | "fog-paint" | "fog-erase";
  setActiveTool: (tool: "select" | "measure" | "fog-paint" | "fog-erase") => void;
  
  fogBrushSize: number;
  setFogBrushSize: (size: number) => void;
}

export const useVttStore = create<VttState>((set) => ({
  activeTab: "chat",
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  diceInput: "",
  setDiceInput: (input) => set({ diceInput: input }),
  
  selectedTokenId: null,
  setSelectedTokenId: (id) => set({ selectedTokenId: id }),
  
  isDmMode: false,
  setIsDmMode: (isDm) => set({ isDmMode: isDm }),
  
  activeTool: "select",
  setActiveTool: (tool) => set({ activeTool: tool }),
  
  fogBrushSize: 30,
  setFogBrushSize: (size) => set({ fogBrushSize: size }),
}));
