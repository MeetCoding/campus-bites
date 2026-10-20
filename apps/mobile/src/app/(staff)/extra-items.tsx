import { Screen } from '@/components/ui';
import { MessPhotoUploader } from '@/features/mess/MessPhotoUploader';
import { SecretaryScope } from '@/features/mess/SecretaryScope';

/** Mess pay-to-get (extra items) price list: photos only since 020, like every menu. */
export default function ExtraItemsScreen() {
  return (
    <Screen>
      <SecretaryScope role="mess_manager">
        {(bhawan) => <MessPhotoUploader key={bhawan.id} bhawanId={bhawan.id} bhawanName={bhawan.name} kind="extras" />}
      </SecretaryScope>
    </Screen>
  );
}
