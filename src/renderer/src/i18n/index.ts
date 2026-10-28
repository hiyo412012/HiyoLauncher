import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import vi from './vi'
import en from './en'

i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: vi },
    en: { translation: en },
  },
  lng: 'vi',
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
})

export { i18n }
export default i18n

export function changeLanguage(lng: string): Promise<any> {
  return i18n.changeLanguage(lng)
}