import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, Screen } from '@/components/ui';
import { AccountPanel } from '@/features/auth/AccountPanel';

const SECTIONS = [
  {
    href: '/whitelist',
    title: 'Vendor whitelist',
    detail: 'Link vendor phone numbers to canteens and eateries.',
  },
  {
    href: '/roles',
    title: 'Roles',
    detail: 'Assign Mess / Bhawan Secretaries, Mess Authority, ADoSW and admins.',
  },
  {
    href: '/manage-bhawans',
    title: 'Bhawans',
    detail: 'Add, rename, reorder or remove hostels (each with its Mess and canteens).',
  },
  {
    href: '/manage-eateries',
    title: 'Campus eateries',
    detail: 'Add, rename, relocate or remove campus eateries.',
  },
] as const;

export default function AdminHome() {
  return (
    <Screen>
      <View className="gap-space-xs pt-space-md">
        <Text className="font-label text-label-sm uppercase text-on-surface-variant">System admin</Text>
        <Text className="font-headline text-headline-lg-mobile text-on-surface">Administration</Text>
      </View>

      <View className="gap-space-sm">
        {SECTIONS.map((section) => (
          <Link key={section.href} href={section.href} asChild>
            <Pressable accessibilityRole="link" className="active:opacity-80">
              <Card className="gap-space-xs">
                <Text className="font-body-semibold text-body-lg text-primary">{section.title}</Text>
                <Text className="font-body text-body-sm text-on-surface-variant">{section.detail}</Text>
              </Card>
            </Pressable>
          </Link>
        ))}
      </View>

      <AccountPanel />
    </Screen>
  );
}
