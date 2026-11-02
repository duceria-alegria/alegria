import type {MessageLoaders} from '@/platform/i18n/messages';

export const accountMessageLoaders: MessageLoaders = {
    en: () => import('./messages/en.json'),
    de: () => import('./messages/de.json'),
    es: () => import('./messages/es.json'),
};
