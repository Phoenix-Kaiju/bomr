import { Redirect } from 'expo-router';

import { INITIAL_TAB_HREF } from '@/constants/navigation';

export default function Index() {
  return <Redirect href={INITIAL_TAB_HREF} />;
}
