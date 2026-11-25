import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import GamesHome from './pages/GamesHome';
import MemoryGame from './pages/MemoryGame';
import MemoryWords from './pages/MemoryWords';
import WheelGame from './pages/WheelGame';
import QuizBoard from './pages/QuizBoard';
import TabooGame from './pages/TabooGame';
import MysteryWord from './pages/MysteryWord';
import WouldYouRather from './pages/WouldYouRather';
import CharacterPicker from './pages/CharacterPicker';
import BuilderPage from './pages/BuilderPage';
import GalleryPage from './pages/GalleryPage';
import CharacterPage from './pages/CharacterPage';
import TeacherPage from './pages/TeacherPage';
import { WelcomeRoute } from './pages/WelcomeRoute';

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<GamesHome />} />
          <Route path="/create-your-character" element={<CharacterPicker />} />
          <Route path="/memory" element={<MemoryGame />} />
          <Route path="/memory/words" element={<MemoryWords />} />
          <Route path="/wheel" element={<WheelGame />} />
          <Route path="/quiz" element={<QuizBoard />} />
          <Route path="/dont-say-it" element={<TabooGame />} />
          <Route path="/mystery-word" element={<MysteryWord />} />
          <Route path="/would-you-rather" element={<WouldYouRather />} />
          <Route path="/build/:kind" element={<BuilderPage />} />
          <Route path="/build/:kind/:id" element={<BuilderPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/c/:id" element={<CharacterPage />} />
          <Route path="/teacher" element={<TeacherPage />} />
          <Route path="/welcome" element={<WelcomeRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
