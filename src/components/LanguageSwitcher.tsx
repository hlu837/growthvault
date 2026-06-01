import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const LanguageSwitcher = () => {
  const { currentLanguage, changeLanguage, languages } = useLanguage();

  const currentLang = languages.find(l => l.code === currentLanguage);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 gap-2 px-3 hover:bg-secondary"
        >
          <Globe className="w-4 h-4" />
          <span className="hidden sm:inline-block text-sm">
            {currentLang?.nativeName || 'English'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-48 bg-popover border border-border z-50"
      >
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={cn(
              'flex items-center justify-between cursor-pointer',
              currentLanguage === lang.code && 'bg-secondary'
            )}
          >
            <span 
              className={cn(
                'text-sm',
                lang.dir === 'rtl' && 'font-arabic'
              )}
            >
              {lang.nativeName}
            </span>
            {currentLanguage === lang.code && (
              <span className="w-2 h-2 rounded-full bg-accent" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
