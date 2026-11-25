import { requireUser } from '@/lib/user';
import PasswordForm from './PasswordForm';

export default async function PasswordPage() {
    const user = await requireUser({ allowMustChange: true });
    return <PasswordForm id={user.id} forced={user.mustChange} />;
}
