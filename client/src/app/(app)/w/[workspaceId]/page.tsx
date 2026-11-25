import { Suspense } from 'react';
import { PageLoader } from '@/components/ui';
import { WorkspaceView } from './WorkspaceView';

export const metadata = { title: 'Workspace' };

export default function Page({ params }: { params: Promise<{ workspaceId: string }> }) {
  return (
    <Suspense fallback={<PageLoader />}>
      <WorkspaceView params={params} />
    </Suspense>
  );
}
