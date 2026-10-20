import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Card, Pill, Screen, Segmented, TextField } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { useBhawans, useOutlets } from '@/features/campus/queries';
import { complaintErrorMessage } from '@/features/complaints/errors';
import { CATEGORY_LABEL, HANDLER_LABEL, type ComplaintCategory, type ComplaintDomain } from '@/features/complaints/logic';
import { MAX_PHOTOS, useRaiseComplaint } from '@/features/complaints/queries';
import { pickImage, type PickedImage } from '@/lib/images';
import { colors } from '@/theme/tokens';

type Place = 'mess' | 'day_canteen' | 'night_canteen' | 'eatery';
const PLACE_DOMAIN: Record<Place, ComplaintDomain> = {
  mess: 'mess',
  day_canteen: 'hostel_canteen',
  night_canteen: 'hostel_canteen',
  eatery: 'campus_eatery',
};
const CATEGORIES = Object.keys(CATEGORY_LABEL) as ComplaintCategory[];

/** Raise a complaint (TASKS M6.8): outlet picker, category chips, description, ≤ 2 photos. */
export default function RaiseComplaint() {
  const { claims } = useSession();
  const params = useLocalSearchParams<{ outlet?: string; category?: string }>();
  const bhawans = useBhawans();
  const outlets = useOutlets();
  const raise = useRaiseComplaint();

  const linked = outlets.data?.find((o) => o.id === params.outlet);
  const [place, setPlace] = useState<Place | null>(null);
  const [bhawanId, setBhawanId] = useState<string | null>(null);
  const [eateryId, setEateryId] = useState<string | null>(null);
  const [category, setCategory] = useState<ComplaintCategory | null>(
    CATEGORIES.includes(params.category as ComplaintCategory) ? (params.category as ComplaintCategory) : null,
  );
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Explicit choices win; otherwise a deep link (e.g. "Report overcharging"), then the student's Bhawan.
  const activePlace: Place = place ?? (linked ? (linked.type as Place) : 'mess');
  const activeBhawan = bhawanId ?? linked?.bhawan_id ?? claims?.bhawan_id ?? null;
  const eateries = outlets.data?.filter((o) => o.type === 'eatery') ?? [];
  const activeEatery = eateryId ?? (linked?.type === 'eatery' ? linked.id : null);
  const outlet =
    activePlace === 'eatery'
      ? eateries.find((o) => o.id === activeEatery)
      : outlets.data?.find((o) => o.type === activePlace && o.bhawan_id === activeBhawan);

  async function addPhoto(source: 'camera' | 'library') {
    try {
      const image = await pickImage(source);
      if (image) setPhotos((prev) => [...prev, image].slice(0, MAX_PHOTOS));
    } catch (error) {
      setFormError(complaintErrorMessage(error));
    }
  }

  function submit() {
    if (!outlet) return setFormError('Pick where it happened.');
    if (!category) return setFormError('Pick a category.');
    if (title.trim().length < 5) return setFormError('Give it a short title (5+ characters).');
    if (body.trim().length < 10) return setFormError('Describe the issue (10+ characters).');
    if (!claims?.sub) return;
    setFormError(null);
    raise.mutate(
      { userId: claims.sub, outletId: outlet.id, category, title: title.trim(), body: body.trim(), photos },
      {
        // `complaint/[id]` lives in the root stack: `replace` would swap out the whole (student) group,
        // leaving no screen to go back to. Close the form, then push the detail on top of the student stack.
        onSuccess: (id) => {
          router.back();
          router.push({ pathname: '/complaint/[id]', params: { id } });
        },
      },
    );
  }

  return (
    <Screen>
      <Card className="gap-space-md">
        <Text className="font-label text-label-md text-on-surface-variant">Where?</Text>
        <Segmented
          options={[
            { value: 'mess', label: 'Mess' },
            { value: 'day_canteen', label: 'Day canteen' },
            { value: 'night_canteen', label: 'Night canteen' },
            { value: 'eatery', label: 'Eatery' },
          ]}
          value={activePlace}
          onChange={setPlace}
        />
        {activePlace === 'eatery' ? (
          <View className="flex-row flex-wrap gap-space-xs">
            {eateries.map((e) => (
              <Pill key={e.id} label={e.name} selected={e.id === activeEatery} onPress={() => setEateryId(e.id)} />
            ))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-space-xs">
            {bhawans.data?.map((b) => (
              <Pill
                key={b.id}
                label={b.name.replace(' Bhawan', '')}
                selected={b.id === activeBhawan}
                onPress={() => setBhawanId(b.id)}
              />
            ))}
          </ScrollView>
        )}
        <Text className="font-body text-body-sm text-on-surface-variant">
          {outlet ? `${outlet.name} · goes to the ${HANDLER_LABEL[PLACE_DOMAIN[activePlace]]}` : 'Pick an outlet.'}
        </Text>
      </Card>

      <Card className="gap-space-md">
        <Text className="font-label text-label-md text-on-surface-variant">Category</Text>
        <View className="flex-row flex-wrap gap-space-xs">
          {CATEGORIES.map((c) => (
            <Pill key={c} label={CATEGORY_LABEL[c]} selected={c === category} onPress={() => setCategory(c)} />
          ))}
        </View>
        <TextField label="Title" placeholder="e.g. Benches broken and dark after 11 PM" value={title} onChangeText={setTitle} maxLength={120} />
        <TextField
          label="What happened?"
          placeholder="When, what you saw, anything that helps fix it"
          value={body}
          onChangeText={setBody}
          maxLength={2000}
          multiline
          textAlignVertical="top"
          style={{ minHeight: 96, paddingTop: 12 }}
        />

        <Text className="font-label text-label-md text-on-surface-variant">Photos (up to {MAX_PHOTOS})</Text>
        <View className="flex-row flex-wrap gap-space-sm">
          {photos.map((p, index) => (
            <View key={p.uri} className="h-20 w-20 overflow-hidden rounded-lg">
              <Image source={{ uri: p.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                className="absolute right-1 top-1 rounded-full bg-inverse-surface/80 p-0.5">
                <X size={14} color={colors['inverse-on-surface']} />
              </Pressable>
            </View>
          ))}
        </View>
        {photos.length < MAX_PHOTOS ? (
          <View className="flex-row gap-space-sm">
            <View className="flex-1">
              <Button label="Camera" variant="secondary" onPress={() => void addPhoto('camera')} />
            </View>
            <View className="flex-1">
              <Button label="Gallery" variant="secondary" onPress={() => void addPhoto('library')} />
            </View>
          </View>
        ) : null}

        {formError || raise.error ? (
          <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
            {formError ?? complaintErrorMessage(raise.error)}
          </Text>
        ) : null}
        <Button label="Submit complaint" onPress={submit} loading={raise.isPending} />
        <Text className="font-body text-body-sm text-on-surface-variant">
          Your name is never shown on the public board. You&apos;ll be notified at every step and can confirm or reopen
          the fix.
        </Text>
      </Card>
    </Screen>
  );
}
