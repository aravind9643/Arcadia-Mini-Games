/**
 * Word bank with categories, used by Hangman and Word Scramble. Bundled so
 * both games work offline. Lengths range 4–9 so puzzles stay approachable.
 */
export type Entry = { word: string; hint: string }

export const WORDS: Entry[] = [
  { word: 'guitar', hint: 'Six strings and a body' },
  { word: 'volcano', hint: 'It erupts' },
  { word: 'penguin', hint: 'A bird that swims, not flies' },
  { word: 'diamond', hint: 'Hardest natural substance' },
  { word: 'compass', hint: 'It always points north' },
  { word: 'harvest', hint: 'Gathering the crop' },
  { word: 'lantern', hint: 'A carried light' },
  { word: 'kitchen', hint: 'Where meals are made' },
  { word: 'journey', hint: 'A long trip' },
  { word: 'blanket', hint: 'Keeps you warm in bed' },
  { word: 'library', hint: 'Full of borrowed books' },
  { word: 'machine', hint: 'It does the work for you' },
  { word: 'octopus', hint: 'Eight arms, three hearts' },
  { word: 'pyramid', hint: 'Ancient Egyptian tomb' },
  { word: 'rainbow', hint: 'Seven colours after rain' },
  { word: 'sandwich', hint: 'Filling between two slices' },
  { word: 'treasure', hint: 'X marks the spot' },
  { word: 'umbrella', hint: 'Keeps the rain off' },
  { word: 'vacation', hint: 'Time away from work' },
  { word: 'whisper', hint: 'Speak very quietly' },
  { word: 'anchor', hint: 'Holds a ship in place' },
  { word: 'balloon', hint: 'Filled with air or helium' },
  { word: 'candle', hint: 'Wax with a wick' },
  { word: 'dolphin', hint: 'Clever sea mammal' },
  { word: 'engine', hint: 'It powers the car' },
  { word: 'feather', hint: 'Light as a...' },
  { word: 'garden', hint: 'Where things are grown' },
  { word: 'hammer', hint: 'It drives nails' },
  { word: 'island', hint: 'Land surrounded by sea' },
  { word: 'jungle', hint: 'Dense tropical forest' },
  { word: 'kettle', hint: 'It boils the water' },
  { word: 'ladder', hint: 'For climbing up' },
  { word: 'magnet', hint: 'It attracts iron' },
  { word: 'needle', hint: 'It threads and sews' },
  { word: 'orange', hint: 'A fruit and a colour' },
  { word: 'pocket', hint: 'A pouch in your clothes' },
  { word: 'quiver', hint: 'It holds arrows' },
  { word: 'rocket', hint: 'It reaches space' },
  { word: 'silver', hint: 'Second place metal' },
  { word: 'tunnel', hint: 'A passage underground' },
  { word: 'violin', hint: 'Played with a bow' },
  { word: 'window', hint: 'You see through it' },
  { word: 'yellow', hint: 'The colour of lemons' },
  { word: 'zebra', hint: 'Striped and hoofed' },
  { word: 'bridge', hint: 'It spans a river' },
  { word: 'castle', hint: 'Fortified and turreted' },
  { word: 'desert', hint: 'Vast and very dry' },
  { word: 'forest', hint: 'Thick with trees' },
  { word: 'glacier', hint: 'A slow river of ice' },
  { word: 'planet', hint: 'It orbits a star' },
  { word: 'thunder', hint: 'It follows lightning' },
  { word: 'wizard', hint: 'A caster of spells' },
  { word: 'camera', hint: 'It takes the picture' },
  { word: 'pencil', hint: 'Write and then erase' },
  { word: 'button', hint: 'It fastens a shirt' },
  { word: 'pirate', hint: 'Sails and plunders' },
  { word: 'puzzle', hint: 'Pieces that fit together' },
  { word: 'rabbit', hint: 'Long ears, quick hops' },
  { word: 'squirrel', hint: 'It buries nuts' },
  { word: 'butterfly', hint: 'It was once a caterpillar' },
  { word: 'elephant', hint: 'Biggest land animal' },
  { word: 'mountain', hint: 'Climbed because it is there' },
  { word: 'hospital', hint: 'Where the doctors are' },
  { word: 'birthday', hint: 'Cake and candles' },
  { word: 'keyboard', hint: 'You type on it' },
  { word: 'sunlight', hint: 'It comes from the sky' },
  { word: 'football', hint: 'Played with a round ball' },
  { word: 'painting', hint: 'It hangs in a gallery' },
  { word: 'notebook', hint: 'For writing things down' },
  { word: 'airport', hint: 'Where the planes land' },
]

export const randomEntry = (exclude?: string): Entry => {
  let pick = WORDS[Math.floor(Math.random() * WORDS.length)]
  // avoid repeating the word that was just played
  if (exclude && WORDS.length > 1) {
    let guard = 0
    while (pick.word === exclude && guard++ < 12) {
      pick = WORDS[Math.floor(Math.random() * WORDS.length)]
    }
  }
  return pick
}
