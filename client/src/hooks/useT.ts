import { useSharedChat } from '../context/ChatContext.tsx';
import { t, type TKey } from '../i18n.ts';

export function useT() {
  const { lang } = useSharedChat();
  return (key: TKey) => t(lang, key);
}
