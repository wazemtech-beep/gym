import { DietPreferences, MealLog } from '../components/DietActions';
import { Link } from 'expo-router';
import { Text } from 'react-native';
import { Card, ErrorNotice, Heading, LoadingCard, Screen, styles } from '../components/ui';
import { useMemberQuery } from '../hooks/member';

type Diet = { hasPlan: boolean; plan?: { id: string; title: string; goal: string | null; notes: string | null; trainer: { name: string }; mealSlots: { id: string; slotType: string; title: string; foodItems: string; suggestedTiming: string | null; alternatives: string | null; notes: string | null }[] } };
export default function DietScreen() {
  const query = useMemberQuery<Diet>('/api/v1/member/diet/today');
  return <Screen><Link href="/workout" style={styles.text}>← Training</Link><Heading>Your diet</Heading><DietPreferences /><ErrorNotice error={query.error} retry={() => void query.refetch()} />{!query.data ? <><LoadingCard title="Assigned diet" /><LoadingCard title="Meals" /></> : !query.data.hasPlan ? <Card title="No diet plan assigned"><Text style={styles.muted}>Your trainer will publish your meal plan here.</Text></Card> : <><Card title={query.data.plan?.title}><Text style={styles.text}>{query.data.plan?.goal}</Text><Text style={styles.muted}>Assigned by {query.data.plan?.trainer.name}</Text>{query.data.plan?.notes && <Text style={styles.muted}>{query.data.plan.notes}</Text>}</Card>{query.data.plan?.mealSlots.map(meal => <Card key={meal.id} title={meal.title}>{meal.suggestedTiming && <Text style={styles.muted}>{meal.suggestedTiming}</Text>}<Text style={styles.text}>{meal.foodItems}</Text>{meal.alternatives && <Text style={styles.muted}>Alternatives: {meal.alternatives}</Text>}{meal.notes && <Text style={styles.muted}>{meal.notes}</Text>}<MealLog planId={query.data!.plan!.id} meal={meal} /></Card>)}</>}</Screen>;
}

