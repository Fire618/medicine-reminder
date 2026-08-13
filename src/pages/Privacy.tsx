import { useState } from 'react';
import {
  getNotificationPermission,
  requestNotificationPermission,
  type NotificationPermissionState,
} from '../alarm/notifications';

const PERMISSION_LABELS: Record<NotificationPermissionState, string> = {
  unsupported: 'Not supported by this browser',
  default: 'Not set yet',
  granted: 'Allowed',
  denied: 'Blocked',
};

export default function Privacy() {
  const [permission, setPermission] = useState<NotificationPermissionState>(
    getNotificationPermission,
  );

  const enable = async () => {
    const next = await requestNotificationPermission();
    setPermission(next);
  };

  return (
    <section aria-labelledby="privacy-heading">
      <h1 id="privacy-heading">Privacy</h1>

      <div className="card">
        <h2 className="card-label">Where your data is stored</h2>
        <p>
          Everything — medicines, reminders, history, and photos — is stored in
          your browser's local database (IndexedDB) on this device.
        </p>
        <ul className="plain-list">
          <li className="privacy-row">Photos never leave this device.</li>
          <li className="privacy-row">No account, no login, no server.</li>
          <li className="privacy-row">No analytics or tracking.</li>
          <li className="privacy-row">
            The app only stores the information you enter.
          </li>
        </ul>
        <p className="muted">
          Because data is local, clearing your browser data or site storage will
          delete your medicines and history.
        </p>
      </div>

      <div className="card">
        <h2 className="card-label">Notifications</h2>
        <p>
          Current status: <strong>{PERMISSION_LABELS[permission]}</strong>
        </p>
        {permission === 'default' && (
          <button type="button" className="btn btn--primary" onClick={enable}>
            Enable notifications
          </button>
        )}
        {permission === 'denied' && (
          <p className="muted">
            Notifications are blocked. Allow them in your browser's site settings
            (the lock icon next to the address bar) to enable reminders.
          </p>
        )}
        <p className="muted">
          Notifications can appear while the app is open or running in the
          background. They cannot fire when the app is fully closed — true
          background alarms are not possible in a browser and would require a
          native app or a push server (which this app deliberately avoids).
        </p>
      </div>

      <div className="card">
        <h2 className="card-label">Camera and the visual check</h2>
        <p>
          When you take a photo for a reminder, the image is analyzed entirely
          on this device to compare approximate color, size, and shape against
          the medicine's stored reference photo.
        </p>
        <ul className="plain-list">
          <li className="privacy-row">No photo is uploaded anywhere.</li>
          <li className="privacy-row">
            The check is a convenience consistency check only.
          </li>
          <li className="privacy-row">
            It does not identify, authenticate, or verify a medicine.
          </li>
          <li className="privacy-row">
            It never infers whether a medicine is safe, correct, or correctly
            dosed — the user always decides.
          </li>
        </ul>
      </div>

      <div className="card">
        <h2 className="card-label">Browser limitations</h2>
        <ul className="plain-list">
          <li className="privacy-row">
            Alarms sound while the app is open. Background sound and
            notifications depend on the browser and device.
          </li>
          <li className="privacy-row">
            Installing the app (PWA) makes it work like an app and enables
            offline use. On iPhone/iPad, install from the Share menu → “Add to
            Home Screen”.
          </li>
          <li className="privacy-row">
            Camera, notifications, and PWA installation require a secure
            (HTTPS) connection or localhost.
          </li>
        </ul>
      </div>
    </section>
  );
}
