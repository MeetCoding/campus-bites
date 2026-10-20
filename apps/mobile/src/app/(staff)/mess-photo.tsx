import { Screen } from '@/components/ui';
import { MessPhotoUploader } from '@/features/mess/MessPhotoUploader';
import { SecretaryScope } from '@/features/mess/SecretaryScope';

/** Mess menu / noticeboard photos (the only mess menu since 020: no typed weekly menu). */
export default function MessPhotoScreen() {
  return (
    <Screen>
      <SecretaryScope role="mess_manager">
        {(bhawan) => <MessPhotoUploader key={bhawan.id} bhawanId={bhawan.id} bhawanName={bhawan.name} kind="menu" />}
      </SecretaryScope>
    </Screen>
  );
}
