import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

const firstNames = ['Alex', 'Sarah', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Quinn', 'Avery', 'Peyton', 'Cameron', 'Skyler', 'Dakota', 'Reese', 'Rowan', 'Hayden', 'Emerson', 'Finley', 'River'];
const lastNames = ['M.', 'K.', 'T.', 'R.', 'S.', 'L.', 'B.', 'C.', 'D.', 'W.', 'P.', 'H.', 'V.', 'N.', 'G.', 'F.', 'J.', 'Z.', 'X.', 'Q.'];
const locations = ['Mumbai', 'London', 'New York', 'Tokyo', 'Paris', 'Berlin', 'Sydney', 'Toronto', 'Dubai', 'Singapore', 'Los Angeles', 'Seoul', 'Amsterdam', 'Barcelona', 'Rome'];

async function seed() {
  console.log('Seeding 20 random profiles...');
  for (let i = 0; i < 20; i++) {
    const id = `seeded_user_${Math.random().toString(36).substring(2, 9)}`;
    const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
    const location = locations[Math.floor(Math.random() * locations.length)];
    const photoId = Math.floor(Math.random() * 1000);
    const photoId2 = Math.floor(Math.random() * 1000);
    
    await setDoc(doc(db, 'publicProfiles', id), {
      uid: id,
      displayName: name,
      location: location,
      photos: [
        `https://picsum.photos/seed/${photoId}/800/1000`,
        `https://picsum.photos/seed/${photoId2}/800/1000`
      ],
      reviewsGivenCount: 0,
      averageRating: 0,
      totalRatings: 0,
      ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      createdAt: new Date()
    });
    console.log(`Added ${name} (${location})`);
  }
  console.log('Done seeding!');
  process.exit(0);
}

seed().catch(console.error);
