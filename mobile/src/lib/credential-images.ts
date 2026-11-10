import type { ImageSourcePropType } from 'react-native';

/**
 * Picks a picture for a credential from words in its title, e.g. "Drone Pilot" shows a drone
 * and "Agricultural Marketing" shows a market. The first matching topic wins, so more specific
 * topics (drones, poultry) are checked before broad ones (crops). Photo sources and licences
 * are listed in assets/images/credentials/CREDITS.md.
 */
type Topic = { label: string; pattern: RegExp; source: ImageSourcePropType };

const TOPICS: Topic[] = [
  { label: 'Agricultural drone', pattern: /\b(drones?|uavs?|rpas|aerial|agridrone)/i, source: require('@/assets/images/credentials/drone.jpg') },
  { label: 'Agricultural market', pattern: /(market|agribusiness|business|trade|trading|sales|selling|value chain|entrepreneur|marketing)/i, source: require('@/assets/images/credentials/market.jpg') },
  { label: 'Poultry', pattern: /(poultry|chicken|broiler|layers?\b|eggs?\b|hatchery)/i, source: require('@/assets/images/credentials/poultry.jpg') },
  { label: 'Livestock', pattern: /(livestock|cattle|cows?\b|dairy|beef|sheep|goats?\b|pigs?\b|piggery|animal|veterinar|herd)/i, source: require('@/assets/images/credentials/livestock.jpg') },
  { label: 'Farm machinery', pattern: /(tractor|machinery|mechani[sz]|equipment|plough|plow|implement|operator)/i, source: require('@/assets/images/credentials/machinery.jpg') },
  { label: 'Irrigation', pattern: /(irrigat|water|drip|sprinkler|hydroponic)/i, source: require('@/assets/images/credentials/irrigation.jpg') },
  { label: 'Crop farming', pattern: /(crops?\b|harvest|vegetable|horticultur|plant|seed|soil|organic|maize|grain|fruit|garden)/i, source: require('@/assets/images/credentials/crops.jpg') },
];

const GENERAL: Topic = {
  label: 'Agricultural studies',
  pattern: /.*/,
  source: require('@/assets/images/welcome-field-study.jpg'),
};

export function credentialImage(title: string): { label: string; source: ImageSourcePropType } {
  const topic = TOPICS.find((item) => item.pattern.test(title)) ?? GENERAL;
  return { label: topic.label, source: topic.source };
}
