import { Building2, Dumbbell, ShieldCheck, UsersRound } from 'lucide-react';

export const roles = {
  MEMBER: {
    label: 'Member', path: '/dashboard/member', tone: 'member', icon: Dumbbell,
    summary: 'Follow your training plan, explore movements, and see your progress over time.',
  },
  TRAINER: {
    label: 'Trainer', path: '/dashboard/trainer', tone: 'trainer', icon: UsersRound,
    summary: 'Manage your client roster, build workout splits, and review your class schedule.',
  },
  GYM_OWNER: {
    label: 'Gym owner', path: '/dashboard/owner', tone: 'owner', icon: Building2,
    summary: 'See membership, revenue, occupancy, and check-ins across your gym locations.',
  },
  PLATFORM_ADMIN: {
    label: 'Platform admin', path: '/dashboard/admin', tone: 'admin', icon: ShieldCheck,
    summary: 'Review gym organizations, subscription tiers, and activity across the platform.',
  },
};
