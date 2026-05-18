import { PropsWithChildren, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { applyTheme, getTheme } from './utils/theme';
import './app.scss';

function App({ children }: PropsWithChildren) {
  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  return (
    <AuthProvider>
      <AppProvider>
        {children}
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
