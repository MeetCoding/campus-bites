import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { Button, Pill, Screen, TextField } from '@/components/ui';
import { draftFromItems, itemsFromDraft, type MenuDraft } from '@/features/mess/menuDraft';
import {
  MEAL_LABEL,
  MEAL_SLOTS,
  useSaveWeeklyMenu,
  useWeeklyMenu,
  type WeeklyMenuItems,
} from '@/features/mess/queries';
import { SecretaryScope } from '@/features/mess/SecretaryScope';
import { addDays, DAY_KEYS, DAY_LABEL, formatDateRange, istNow, timeAgo, weekStart, type DayKey } from '@/lib/time';

export default function MessMenuScreen() {
  return (
    <Screen>
      <SecretaryScope>{(bhawan) => <WeekPicker key={bhawan.id} bhawanId={bhawan.id} />}</SecretaryScope>
    </Screen>
  );
}

function WeekPicker({ bhawanId }: { bhawanId: string }) {
  const thisWeek = weekStart(istNow().date);
  const [week, setWeek] = useState(thisWeek);
  const menu = useWeeklyMenu(bhawanId, week);

  const weeks = [
    { start: thisWeek, label: 'This week' },
    { start: addDays(thisWeek, 7), label: 'Next week' },
  ];

  return (
    <View className="gap-space-md">
      <View className="flex-row flex-wrap gap-space-xs">
        {weeks.map((w) => (
          <Pill
            key={w.start}
            label={`${w.label} · ${formatDateRange(w.start, addDays(w.start, 6))}`}
            selected={w.start === week}
            onPress={() => setWeek(w.start)}
          />
        ))}
      </View>
      {menu.isPending ? (
        <ActivityIndicator />
      ) : menu.isError ? (
        <Text className="font-body text-body-md text-error">{menu.error.message}</Text>
      ) : (
        // Re-keyed per week and per saved version, so the draft always starts from what's stored.
        <MenuEditor
          key={`${week}:${menu.data?.updated_at ?? 'new'}`}
          bhawanId={bhawanId}
          week={week}
          stored={menu.data?.items}
          updatedAt={menu.data?.updated_at}
        />
      )}
    </View>
  );
}

function MenuEditor({
  bhawanId,
  week,
  stored,
  updatedAt,
}: {
  bhawanId: string;
  week: string;
  stored: WeeklyMenuItems | undefined;
  updatedAt: string | undefined;
}) {
  const [day, setDay] = useState<DayKey>(istNow().dayKey);
  const [draft, setDraft] = useState<MenuDraft>(() => draftFromItems(stored));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveWeeklyMenu();

  function submit() {
    const result = itemsFromDraft(draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    save.mutate({ bhawanId, weekStart: week, items: result.items });
  }

  return (
    <View className="gap-space-md">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-space-xs">
        {DAY_KEYS.map((key) => (
          <Pill key={key} label={DAY_LABEL[key]} selected={key === day} onPress={() => setDay(key)} />
        ))}
      </ScrollView>

      {MEAL_SLOTS.map((slot) => (
        <TextField
          key={`${day}-${slot}`}
          label={`${DAY_LABEL[day]} · ${MEAL_LABEL[slot]}`}
          placeholder="One dish per line"
          multiline
          textAlignVertical="top"
          style={{ minHeight: 96, paddingTop: 12 }}
          value={draft[day][slot]}
          onChangeText={(text) => {
            setDirty(true);
            setDraft((prev) => ({ ...prev, [day]: { ...prev[day], [slot]: text } }));
          }}
        />
      ))}

      {error || save.error ? (
        <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
          {error ?? save.error?.message}
        </Text>
      ) : updatedAt ? (
        <Text className="font-body text-body-sm text-on-surface-variant">
          {dirty ? 'Unsaved changes · ' : ''}Last saved {timeAgo(updatedAt)}
        </Text>
      ) : null}

      <Button label="Save whole week" onPress={submit} loading={save.isPending} />
    </View>
  );
}
