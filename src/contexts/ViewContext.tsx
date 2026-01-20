import { createContext, useContext, useState, ReactNode } from 'react';

export type ViewType = 'dashboard' | 'family-planboard' | 'child-mode';

interface ViewContextType {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  isChildMode: boolean;
  toggleChildMode: () => void;
}

const ViewContext = createContext<ViewContextType | null>(null);

export function ViewProvider({ children }: { children: ReactNode }) {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const isChildMode = currentView === 'child-mode';

  const toggleChildMode = () => {
    setCurrentView(currentView === 'child-mode' ? 'dashboard' : 'child-mode');
  };

  return (
    <ViewContext.Provider value={{ currentView, setCurrentView, isChildMode, toggleChildMode }}>
      {children}
    </ViewContext.Provider>
  );
}

export function useView() {
  const context = useContext(ViewContext);
  if (!context) {
    throw new Error('useView must be used within a ViewProvider');
  }
  return context;
}
