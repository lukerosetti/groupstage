import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TopStripe from './components/layout/TopStripe';
import Nav from './components/layout/Nav';
import Footer from './components/layout/Footer';
import HomePage from './pages/HomePage';
import CreatePoolPage from './pages/CreatePoolPage';
import JoinPoolPage from './pages/JoinPoolPage';
import DraftUploadPage from './pages/DraftUploadPage';
import DraftRoomPage from './pages/DraftRoomPage';
import PoolPage from './pages/PoolPage';
import RecoverPage from './pages/RecoverPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen" style={{ background: '#F6F2E9' }}>
        <TopStripe />
        <Nav />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/create" element={<CreatePoolPage />} />
            <Route path="/p/:id/join" element={<JoinPoolPage />} />
            <Route path="/p/:id/draft" element={<DraftUploadPage />} />
            <Route path="/p/:id/room"  element={<DraftRoomPage />} />
            <Route path="/p/:id" element={<PoolPage />} />
            <Route path="/recover" element={<RecoverPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
