const mongoose = require('mongoose');

const LOCAL_URI = 'mongodb://localhost:27017/3d-saas';
const ATLAS_URI = 'mongodb+srv://johncarlodasas19_db_user:uI9Jn4OpI7L49Ppo@cluster0.e9qnmhm.mongodb.net/collab3d?retryWrites=true&w=majority';

// Define schemas temporarily for migration
const userSchema = new mongoose.Schema({}, { strict: false });
const projectSchema = new mongoose.Schema({}, { strict: false });

async function migrate() {
  console.log('Connecting to local database...');
  const localDb = await mongoose.createConnection(LOCAL_URI).asPromise();
  const LocalUser = localDb.model('User', userSchema);
  const LocalProject = localDb.model('Project', projectSchema);

  console.log('Fetching local data...');
  const users = await LocalUser.find().lean();
  const projects = await LocalProject.find().lean();
  console.log(`Found ${users.length} users and ${projects.length} projects.`);

  console.log('Connecting to Atlas database...');
  const atlasDb = await mongoose.createConnection(ATLAS_URI).asPromise();
  const AtlasUser = atlasDb.model('User', userSchema);
  const AtlasProject = atlasDb.model('Project', projectSchema);

  console.log('Clearing existing data in Atlas...');
  await AtlasUser.deleteMany({});
  await AtlasProject.deleteMany({});

  console.log('Inserting data into Atlas...');
  if (users.length > 0) await AtlasUser.insertMany(users);
  if (projects.length > 0) await AtlasProject.insertMany(projects);

  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(console.error);
