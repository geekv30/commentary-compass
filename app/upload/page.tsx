import { isAdmin } from '@/lib/admin-auth';
import { AdminGate } from './admin-gate';
import { UploadForm } from './upload-form';

export const dynamic = 'force-dynamic';

export default async function UploadPage() {
  const admin = await isAdmin();
  return admin ? <UploadForm /> : <AdminGate />;
}
