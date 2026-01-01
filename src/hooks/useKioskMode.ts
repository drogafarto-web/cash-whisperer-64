import { useSearchParams } from 'react-router-dom';

export function useKioskMode() {
  const [searchParams] = useSearchParams();
  const isKiosk = searchParams.get('mode') === 'kiosk';
  
  return { isKiosk };
}
