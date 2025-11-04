import ToastNotification from './Toast';
import { useToastNotificationStore } from '../../store/useToastNotificationStore';

function ToastNotificationContainer() {
  const { toasts, removeToast } = useToastNotificationStore();

  return (
    <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 10000, display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {toasts.map((toast) => (
        <ToastNotification
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

export default ToastNotificationContainer;

