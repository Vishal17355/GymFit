import { Activity, BookOpen, Building2, CalendarDays, ClipboardList, CreditCard, Dumbbell, House, IdCard, ListChecks, MapPin, ShieldCheck, SlidersHorizontal, UserRound, UsersRound, Utensils } from 'lucide-react';

export const roleWorkspaces = {
  MEMBER: {
    slug: 'member', title: 'Your training week', description: 'Find your next class, check in at the gym, and keep a record of what you do.',
    sections: [
      ['pass', 'Gym pass', IdCard], ['classes', 'Classes', CalendarDays], ['workouts', 'Workout log', Dumbbell],
      ['home', 'Quick workouts', House], ['diet', 'Assigned diet', Utensils], ['progress', 'Progress', Activity],
      ['profile', 'Profile', UserRound], ['billing', 'Billing history', CreditCard],
    ],
  },
  TRAINER: {
    slug: 'trainer', title: 'Coach your clients', description: 'Review individual progress, assign programs, and take attendance for your classes.',
    sections: [['clients', 'Clients', UsersRound], ['plans', 'Plan assignments', ClipboardList], ['attendance', 'Attendance', ListChecks]],
  },
  GYM_OWNER: {
    slug: 'owner', title: 'Run your gym', description: 'Manage memberships, staff, facilities, and payments across your branches.',
    sections: [
      ['members', 'Memberships', UsersRound], ['staff', 'Staff', UserRound], ['branches', 'Branches', MapPin],
      ['pricing', 'Membership pricing', CreditCard], ['schedule', 'Class schedule', CalendarDays],
      ['payments', 'Payments', CreditCard], ['check-in', 'Front desk', IdCard],
    ],
  },
  PLATFORM_ADMIN: {
    slug: 'admin', title: 'Manage the platform', description: 'Onboard gyms, manage subscription tiers, and review operational events.',
    sections: [['gyms', 'Gyms', Building2], ['tiers', 'Subscription tiers', CreditCard], ['audit', 'Audit alerts', ShieldCheck]],
  },
};

export const workspacePath = (role, section) => `/dashboard/${roleWorkspaces[role].slug}${section ? `/${section}` : ''}`;

export const memberFeatureLinks = [
  ['Diet planner', '/member/diet-plan', Utensils],
  ['Nutrition diary', '/member/nutrition-diary', BookOpen],
  ['Nutrition tools', '/member/nutrition-tools', SlidersHorizontal],
  ['Home workouts', '/member/home-workout', House],
];
