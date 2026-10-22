const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
 
const mongoose = require('mongoose');
const Event = require('../models/Event');
const rawEvents = require('./events.json');
const { normalizeEvents } = require('./normalizeEvents');
 
const REQUIRED_ENV = ['MONGO_URI'];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key] || !process.env[key].trim());
if (missingEnv.length > 0) {
  console.error(`Missing required environment variable(s): ${missingEnv.join(', ')}`);
  console.error('Add them to BACKEND/.env (see .env.example) and re-run.');
  process.exit(1);
}
const seed = async () => {
  const events = normalizeEvents(rawEvents);
  if (events.length === 0) {
    console.error('No events found in seed/events.json after normalizing - nothing to do.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('MongoDB connected');
  const overwrite = process.argv.includes('--update');
  let created = 0;
  let updated = 0;
  for (const event of events) {
    const result = await Event.updateOne(
      { slug: event.slug },
      overwrite ? { $set: event } : { $setOnInsert: event },
      { upsert: true }
    );
    let status = 'skipped (already exists)';
    if (result.upsertedCount > 0) { created++; status = 'created'; }
    else if (overwrite) { updated++; status = 'updated'; }
    console.log(`  ${status}: ${event.name} (${event.slug})`);
  }
  console.log(`\nDone. ${created} event(s) created, ${updated} event(s) updated, ${events.length} total.`);
  await mongoose.disconnect();
  process.exit(0);
};
 
seed().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);

});