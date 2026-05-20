// ── Anonymous identity name generator ──
// Produces memorable two-word handles for zero-friction signup.
// Users can rename once after PARA identity verification.

const FIRST_WORDS = [
  'silent', 'quiet', 'still', 'calm', 'soft', 'gentle', 'mild', 'serene',
  'swift', 'quick', 'fast', 'rapid', 'brisk', 'fleeting',
  'bright', 'luminous', 'radiant', 'vivid', 'brilliant', 'clear',
  'deep', 'vast', 'broad', 'wide', 'grand', 'noble',
  'wild', 'free', 'bold', 'brave', 'fierce', 'keen',
  'ancient', 'old', 'eternal', 'timeless', 'enduring',
  'hidden', 'secret', 'veiled', 'masked', 'shadow',
  'golden', 'silver', 'copper', 'iron', 'steel',
  'blue', 'green', 'red', 'amber', 'violet', 'crimson',
  'northern', 'southern', 'eastern', 'western',
  'distant', 'far', 'remote', 'outer',
  'rising', 'falling', 'setting', 'wandering',
  'broken', 'fractured', 'split', 'twisted',
  'empty', 'hollow', 'bare', 'raw',
  'lucky', 'fortune', 'chance', 'fate',
]

const SECOND_WORDS = [
  'river', 'stream', 'brook', 'creek', 'bay', 'cove', 'harbor',
  'mountain', 'peak', 'ridge', 'cliff', 'valley', 'canyon', 'pass',
  'forest', 'wood', 'grove', 'thicket', 'glade', 'meadow',
  'field', 'plain', 'prairie', 'steppe', 'tundra',
  'stone', 'rock', 'boulder', 'pebble', 'granite', 'obsidian',
  'tree', 'oak', 'pine', 'birch', 'willow', 'cedar', 'elm',
  'flower', 'bloom', 'blossom', 'petal', 'thorn',
  'star', 'moon', 'sun', 'comet', 'nebula', 'galaxy',
  'wind', 'breeze', 'gale', 'storm', 'thunder', 'mist', 'fog',
  'flame', 'ember', 'spark', 'ash', 'smoke',
  'wave', 'tide', 'surf', 'current', 'drift',
  'bird', 'hawk', 'falcon', 'raven', 'crow', 'swan', 'heron',
  'wolf', 'fox', 'bear', 'lynx', 'stag', 'doe', 'hare',
  'drum', 'bell', 'horn', 'flute', 'lyre', 'chant',
  'path', 'road', 'trail', 'way', 'track', 'lane',
  'bridge', 'gate', 'arch', 'tower', 'dome', 'spire',
  'mirror', 'glass', 'lens', 'prism', 'crystal',
  'seed', 'root', 'stem', 'leaf', 'fruit', 'core',
  'thread', 'knot', 'weave', 'loom', 'spindle',
  'sword', 'shield', 'arrow', 'bow', 'spear', 'helm',
  'key', 'lock', 'seal', 'sign', 'mark', 'rune',
  'vessel', 'bowl', 'cup', 'jar', 'urn',
  'book', 'scroll', 'page', 'verse', 'line',
]

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000
  return x - Math.floor(x)
}

export function generateAnonymousHandle(seed?: number): string {
  const s = seed ?? Date.now()
  const firstIndex = Math.floor(seededRandom(s) * FIRST_WORDS.length)
  const secondIndex = Math.floor(seededRandom(s + 1) * SECOND_WORDS.length)
  return `${FIRST_WORDS[firstIndex]}-${SECOND_WORDS[secondIndex]}`
}
