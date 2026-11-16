import type {MessageLoaders} from '@/platform/i18n/messages';

export const favoritesMessageLoaders: MessageLoaders = {
    en: () => import('./messages/en.json'),
    de: () => import('./messages/de.json'),
    es: () => import('./messages/es.json'),
};
