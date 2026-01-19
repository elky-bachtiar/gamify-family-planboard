import { createContext, useContext, useState, ReactNode } from 'react';

export type ViewType = 'dashboard' | 'family-planboard';

interface ViewContextType {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
}

const ViewContext = createContext<ViewContextType | null>(null);

export function ViewProvider({ children }: { children: ReactNode }) {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  return (
    <ViewContext.Provider value={{ currentView, setCurrentView }}>
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
