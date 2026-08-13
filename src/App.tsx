import { NavLink, Outlet } from 'react-router-dom';
import AlarmBanner from './components/AlarmBanner';
import AlarmScreen from './components/AlarmScreen';
import { useReminderEngine } from './hooks/useReminderEngine';
import { useAlarmController } from './alarm/useAlarmController';

const navItems = [
  { to: '/', label: 'Today', end: true },
  { to: '/medicines', label: 'Medicines', end: false },
  { to: '/history', label: 'History', end: false },
  { to: '/privacy', label: 'Privacy', end: false },
];

export default function App() {
  useReminderEngine();
  useAlarmController();

  return (
    <div className="app">
      <header className="app-header">
        <NavLink to="/" className="app-brand" aria-label="Medicine Reminder home">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width="28" height="28" />
          <span>Medicine Reminder</span>
        </NavLink>
        <nav className="app-nav" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <AlarmBanner />

      <main className="app-main" id="main">
        <Outlet />
      </main>

      <AlarmScreen />
    </div>
  );
}
