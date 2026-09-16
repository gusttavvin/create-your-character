import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import BuilderPage from './pages/BuilderPage';
import GalleryPage from './pages/GalleryPage';
import CharacterPage from './pages/CharacterPage';
import TeacherPage from './pages/TeacherPage';
import JoinPage from './pages/JoinPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/build/:kind" element={<BuilderPage />} />
        <Route path="/build/:kind/:id" element={<BuilderPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/c/:id" element={<CharacterPage />} />
        <Route path="/teacher" element={<TeacherPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
