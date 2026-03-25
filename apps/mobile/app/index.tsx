import { Redirect } from 'expo-router'

export default function Index() {
  // TODO: check auth state and redirect accordingly
  return <Redirect href="/(tabs)/dashboard" />
}
