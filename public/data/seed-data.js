/**
 * seed-data.js — Sample data for Jonaki Pothe
 *
 * HOW TO USE:
 *   1. Open seed.html in a browser while signed in as an admin.
 *   2. Click "Seed Database".
 *   OR run the seedFirestore() function from your console after importing.
 *
 * Run ONCE only. Duplicate entries will appear if run multiple times.
 */

import {
  collection,
  addDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── 10 sample reports around Siliguri ────────────────────────────────────────

export const sampleReports = [
  {
    category:          'dark_street',
    description:       'Streetlights near Sevoke Road and Hill Cart Road junction are broken. The road is very dark after 8 PM and several people have reported feeling unsafe walking here at night.',
    timeOfDay:         'night',
    severity:          'high',
    lat:               26.7301,
    lng:               88.4012,
    status:            'approved',
    confirmationsCount: 7,
    anonymous:         false,
    flagged:           false,
  },
  {
    category:          'stray_dogs',
    description:       'A large group of stray dogs near Bidhan Market becomes aggressive in the early morning hours, especially between 5 AM and 7 AM. Use caution if walking through here.',
    timeOfDay:         'day',
    severity:          'medium',
    lat:               26.7215,
    lng:               88.3901,
    status:            'approved',
    confirmationsCount: 4,
    anonymous:         true,
    flagged:           false,
  },
  {
    category:          'waterlogging',
    description:       'Severe waterlogging at Matigara Chowk during and after rain. The water can be knee-deep and the road becomes completely impassable for pedestrians. Drains are blocked.',
    timeOfDay:         'both',
    severity:          'high',
    lat:               26.7508,
    lng:               88.3827,
    status:            'approved',
    confirmationsCount: 11,
    anonymous:         false,
    flagged:           false,
  },
  {
    category:          'isolated_area',
    description:       'The footpath behind the Siliguri stadium near Gate 3 is very isolated, especially after 7 PM. Poor lighting and no foot traffic. Avoid using this route alone at night.',
    timeOfDay:         'night',
    severity:          'high',
    lat:               26.7194,
    lng:               88.4056,
    status:            'approved',
    confirmationsCount: 5,
    anonymous:         true,
    flagged:           false,
  },
  {
    category:          'broken_road',
    description:       'Deep potholes on Pradhan Nagar Road near the bypass junction. Very dangerous for two-wheelers, especially in rain when the potholes fill with water and are hard to see.',
    timeOfDay:         'both',
    severity:          'medium',
    lat:               26.7389,
    lng:               88.3978,
    status:            'approved',
    confirmationsCount: 9,
    anonymous:         false,
    flagged:           false,
  },
  {
    category:          'safe_spot',
    description:       'The area in front of Siliguri Junction train station is well-lit, has police presence, and 24-hour vendors. A good safe spot if you feel unsafe nearby.',
    timeOfDay:         'both',
    severity:          'low',
    lat:               26.7137,
    lng:               88.3932,
    status:            'approved',
    confirmationsCount: 15,
    anonymous:         false,
    flagged:           false,
  },
  {
    category:          'stray_dogs',
    description:       'Stray dogs near Champasari market have been seen in a pack of around 8–10 animals. They are particularly active in the early morning and evening. Walk in groups if possible.',
    timeOfDay:         'both',
    severity:          'medium',
    lat:               26.7442,
    lng:               88.4089,
    status:            'approved',
    confirmationsCount: 3,
    anonymous:         true,
    flagged:           false,
  },
  {
    category:          'dark_street',
    description:       'The lane connecting Hakimpara to Baghajatin Colony has no street lighting at all. The area is completely dark from sunset to sunrise. Exercise extreme caution.',
    timeOfDay:         'night',
    severity:          'high',
    lat:               26.7268,
    lng:               88.3812,
    status:            'approved',
    confirmationsCount: 6,
    anonymous:         false,
    flagged:           false,
  },
  {
    category:          'broken_road',
    description:       'The footpath on Dagapur Road near the Siliguri College gate has broken tiles and large gaps. Several people have tripped and fallen here. Dangerous for the elderly.',
    timeOfDay:         'both',
    severity:          'low',
    lat:               26.7332,
    lng:               88.4145,
    status:            'approved',
    confirmationsCount: 2,
    anonymous:         false,
    flagged:           false,
  },
  {
    category:          'waterlogging',
    description:       'Underpass near Siliguri Town Station floods completely during heavy rain, making it unusable. The water level can reach 1–2 feet. The situation has persisted for 2 monsoon seasons.',
    timeOfDay:         'both',
    severity:          'high',
    lat:               26.7101,
    lng:               88.3870,
    status:            'approved',
    confirmationsCount: 13,
    anonymous:         false,
    flagged:           false,
  },
];

// ── 8 safe spots ─────────────────────────────────────────────────────────────

export const safeSpots = [
  {
    name:    'Siliguri District Hospital',
    type:    'hospital',
    lat:     26.7198,
    lng:     88.3878,
    phone:   '0353-2690900',
    open24h: true,
  },
  {
    name:    'Siliguri Police Station (Kotwali)',
    type:    'police_station',
    lat:     26.7169,
    lng:     88.3952,
    phone:   '0353-2535001',
    open24h: true,
  },
  {
    name:    'North Bengal Medical College and Hospital',
    type:    'hospital',
    lat:     26.7045,
    lng:     88.3697,
    phone:   '0353-2581006',
    open24h: true,
  },
  {
    name:    'Pradhan Nagar Police Station',
    type:    'police_station',
    lat:     26.7404,
    lng:     88.3975,
    phone:   '0353-2544001',
    open24h: true,
  },
  {
    name:    'Indian Oil Petrol Pump — Hill Cart Road',
    type:    'petrol_pump',
    lat:     26.7290,
    lng:     88.4030,
    phone:   null,
    open24h: true,
  },
  {
    name:    'Apollo Pharmacy — Bidhan Road',
    type:    'pharmacy',
    lat:     26.7221,
    lng:     88.3909,
    phone:   '0353-2531234',
    open24h: true,
  },
  {
    name:    'Medica Superspecialty Hospital',
    type:    'hospital',
    lat:     26.7325,
    lng:     88.4071,
    phone:   '1800-103-5833',
    open24h: true,
  },
  {
    name:    'Bharat Petroleum — Sevoke Road',
    type:    'petrol_pump',
    lat:     26.7355,
    lng:     88.4018,
    phone:   null,
    open24h: true,
  },
];

// ── Seed function ─────────────────────────────────────────────────────────────

/**
 * seedFirestore(db)
 * Writes all sample reports and safe spots to Firestore.
 * Call this once from seed.html as an admin.
 *
 * @param {import('firebase/firestore').Firestore} db
 * @param {function(string): void} [onProgress] - optional progress callback
 */
export default async function seedFirestore(db, onProgress = console.log) {
  onProgress('Starting seed…');

  // Seed reports
  for (let i = 0; i < sampleReports.length; i++) {
    const report = { ...sampleReports[i], createdAt: serverTimestamp() };
    try {
      const ref = await addDoc(collection(db, 'reports'), report);
      onProgress(`✓ Report ${i + 1}/${sampleReports.length} saved (${ref.id})`);
    } catch (err) {
      onProgress(`✗ Report ${i + 1} failed: ${err.message}`);
    }
  }

  // Seed safe spots
  for (let i = 0; i < safeSpots.length; i++) {
    const spot = { ...safeSpots[i], createdAt: serverTimestamp() };
    try {
      const ref = await addDoc(collection(db, 'safe_spots'), spot);
      onProgress(`✓ Safe spot ${i + 1}/${safeSpots.length} saved (${ref.id})`);
    } catch (err) {
      onProgress(`✗ Safe spot ${i + 1} failed: ${err.message}`);
    }
  }

  onProgress('✅ Seeding complete!');
}
