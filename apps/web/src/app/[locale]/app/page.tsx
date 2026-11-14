import { redirect } from 'next/navigation';

export default async function AppIndex({ params }: PageProps<'/[locale]/app'>) {
  const { locale } = await params;
  redirect(`/${locale}/app/today`);
}
