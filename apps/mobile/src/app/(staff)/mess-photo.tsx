import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, Screen } from '@/components/ui';
import { MenuPhotoStackEditor, useMenuPhotoStack } from '@/features/mess/components';
import { SecretaryScope } from '@/features/mess/SecretaryScope';
import { useMessOutlet, useUploadMenuPhoto } from '@/features/mess/queries';
import { pickImage } from '@/lib/images';
import { istNow, weekStart } from '@/lib/time';

export default function MessPhotoScreen() {
  return (
    <Screen>
      <SecretaryScope>{(bhawan) => <PhotoUploader bhawanId={bhawan.id} bhawanName={bhawan.name} />}</SecretaryScope>
    </Screen>
  );
}

function PhotoUploader({ bhawanId, bhawanName }: { bhawanId: string; bhawanName: string }) {
  const outlet = useMessOutlet(bhawanId);
  const stack = useMenuPhotoStack(outlet?.id);
  const upload = useUploadMenuPhoto();
  const [message, setMessage] = useState<string | null>(null);

  async function pick(source: 'camera' | 'library') {
    setMessage(null);
    if (!outlet) return;
    try {
      const image = await pickImage(source);
      if (!image) return;
      const today = istNow().date;
      upload.mutate(
        { outletId: outlet.id, source: image, today, weekStart: weekStart(today) },
        {
          onSuccess: ({ sizeBytes }) =>
            setMessage(`Published to students (${(sizeBytes / 1024 / 1024).toFixed(1)} MB after compression).`),
        },
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <View className="gap-space-md">
      <View className="gap-space-xs">
        <Text className="font-headline text-headline-md text-on-surface">{bhawanName} Mess</Text>
        <Text className="font-body text-body-md text-on-surface-variant">
          Photograph the signed weekly chart straight-on in good light. Add one photo per page; students
          swipe through them, newest first. Each is resized to 2560 px and compressed before upload, so
          handwriting stays legible.
        </Text>
      </View>

      {stack.full ? (
        <Card tone="low">
          <Text className="font-body-semibold text-body-md text-on-surface">
            All {stack.limit} photo slots are used. Delete an old photo below to add a new one.
          </Text>
        </Card>
      ) : null}

      <View className="gap-space-sm">
        <Button
          label="Take photo of this week's menu board"
          onPress={() => void pick('camera')}
          loading={upload.isPending}
          disabled={!outlet || stack.full}
        />
        <Button
          label="Choose from gallery"
          variant="secondary"
          onPress={() => void pick('library')}
          disabled={upload.isPending || !outlet || stack.full}
        />
      </View>

      {upload.isError ? (
        <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
          {upload.error.message}
        </Text>
      ) : message ? (
        <Text accessibilityRole="alert" className="font-body text-body-sm text-on-surface">
          {message}
        </Text>
      ) : null}

      {outlet ? <MenuPhotoStackEditor outletId={outlet.id} /> : null}
    </View>
  );
}
