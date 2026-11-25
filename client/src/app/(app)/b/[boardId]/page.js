import { Suspense } from 'react';
import { PageLoader } from '@/components/ui';
import { BoardView } from './BoardView';

export const metadata = { title: 'Board' };

export default function Page({ params }) {
  return (
    <Suspense fallback={<PageLoader label="Loading board" />}>
      <BoardView params={params} />
    </Suspense>
  );
}
