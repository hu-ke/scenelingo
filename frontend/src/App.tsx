import { AuthProvider, useAuth } from './context/AuthContext';
import { ReviewProvider, useReview } from './context/ReviewContext';
import HomePage from './pages/HomePage';
import ReviewPage from './pages/ReviewPage';
import MergePage from './pages/MergePage';
import WordBookPage from './pages/WordBookPage';
import WordDetailPage from './pages/WordDetailPage';
import LoginPage from './pages/LoginPage';
import './App.css';

function AppContent() {
  const { state: authState } = useAuth();
  const { state: reviewState } = useReview();

  if (authState.loading) {
    return (
      <div className="spinner" />
    );
  }

  switch (reviewState.page) {
    case 'login':
      return <LoginPage />;
    case 'home':
      return <HomePage />;
    case 'review':
      return <ReviewPage />;
    case 'merge':
      return <MergePage />;
    case 'wordbook':
      return <WordBookPage />;
    case 'worddetail':
      return <WordDetailPage />;
    default:
      return <HomePage />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <ReviewProvider>
        <AppContent />
      </ReviewProvider>
    </AuthProvider>
  );
}