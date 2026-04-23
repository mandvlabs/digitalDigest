import { useContext } from 'react';
import { PrefsContext } from '../contexts/PrefsContext.jsx';

export function usePrefs() {
  return useContext(PrefsContext);
}
