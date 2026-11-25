import { useNavigate, useSearchParams } from 'react-router-dom';
import WelcomePage from './WelcomePage';

/**
 * The door at /welcome (the Guest chip at the top leads here): when done, home.
 * `?as=teacher` opens straight on the teacher's log in (from the Teacher area).
 */
export function WelcomeRoute() {
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const teacher = query.get('as') === 'teacher';
  return <WelcomePage start={teacher ? { intent: 'login', who: 'teacher' } : undefined} onDone={() => navigate(teacher ? '/teacher' : '/')} />;
}
