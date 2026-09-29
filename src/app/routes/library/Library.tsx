import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/design/components';
import { IconLibrary } from '@/design/icons';

export default function Library() {
  const { t } = useTranslation();
  return <EmptyState className="h-full" icon={<IconLibrary size={28} />} title={t('soon.libraryTitle')} body={t('soon.body')} />;
}
