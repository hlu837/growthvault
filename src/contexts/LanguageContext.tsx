import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { languages, isRTL, LanguageCode } from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface LanguageContextType {
  currentLanguage: LanguageCode;
  changeLanguage: (lang: LanguageCode) => Promise<void>;
  isRTL: boolean;
  languages: typeof languages;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(
    (i18n.language as LanguageCode) || 'en'
  );

  // Apply RTL/LTR direction to document
  useEffect(() => {
    const rtl = isRTL(currentLanguage);
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLanguage;
    
    // Add/remove RTL class for styling
    if (rtl) {
      document.documentElement.classList.add('rtl');
    } else {
      document.documentElement.classList.remove('rtl');
    }
  }, [currentLanguage]);

  // Sync language from i18n changes
  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setCurrentLanguage(lng as LanguageCode);
    };
    
    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  const changeLanguage = async (lang: LanguageCode) => {
    await i18n.changeLanguage(lang);
    setCurrentLanguage(lang);
    
    // Save to localStorage (already handled by i18next-browser-languagedetector)
    localStorage.setItem('i18nextLng', lang);
    
    // Optionally save to user profile if logged in
    if (user) {
      try {
        // We could add a preferred_language column to profiles table
        // For now, just use localStorage
      } catch (error) {
        console.error('Failed to save language preference:', error);
      }
    }
  };

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        changeLanguage,
        isRTL: isRTL(currentLanguage),
        languages,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};
