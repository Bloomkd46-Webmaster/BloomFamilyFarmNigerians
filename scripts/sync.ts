import ADGA, { Awards, Goats, OwnedGoats } from 'adga';
import * as fs from 'fs';
import { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline/promises';
import * as path from 'path';



const rl = readline.createInterface({ input, output });
const config: { does: (OwnedGoats['result']['items'][number] & { nickname: string; description: string; awards: Awards['result']['items']; })[]; bucks: (OwnedGoats['result']['items'][number] & { nickname: string; description: string; })[]; awards: Awards['result']['items']; } = require('../src/app/goats.json');
const credentials: { username?: string, password?: string, accountId?: number; } = {};
/** Remove the first two irrelevant arguments */
const myArgs = process.argv.slice(2);
/** Ensure that all arguments are present */
if (myArgs.length < 2) {
  if (fs.existsSync(path.join(process.cwd(), 'credentials.txt'))) {
    console.log('Using credentials from', path.join(process.cwd(), 'credentials.txt'));
    const credentialFile = fs.readFileSync(path.join(process.cwd(), 'credentials.txt'), 'utf8');
    const splitCredentials = credentialFile.split('\n');
    Object.assign(credentials, { username: splitCredentials[0], password: splitCredentials[1], accountId: splitCredentials[2] });
  } else {
    console.log('Usage:  <Username> <Password> [Account ID]');
    process.exit(1);
  }
} else {
  Object.assign(credentials, { username: myArgs[0], password: myArgs[1], accountId: myArgs[2] });
}
function titleCase(string: string) {
  var sentence = string.toLowerCase().split(' ');
  for (var i = 0; i < sentence.length; i++) {
    sentence[i] = sentence[i][0].toUpperCase() + sentence[i].slice(1);
  }
  return sentence.join(' ');
}
(async () => {
  console.log('Initializing...');
  const adga = await ADGA.init(credentials.username!, credentials.password!);
  console.log('Downloading Goats...');
  const goats = await adga.getOwnedGoats(credentials.accountId || undefined);
  console.log('Downloaded', goats.totalCount, 'Goats From ADGA');
  for (const goat of goats.items) {
    const awards = (await adga.getAwards(goat.id)).items;
    const doe = config.does.find(configGoat => configGoat.name === goat.name);
    const buck = config.bucks.find(configGoat => configGoat.name === goat.name);
    if (doe) {
      console.log(`Updating ${doe.nickname}...`);
      Object.assign(config.does[config.does.indexOf(doe)], goat, { description: config.does[config.does.indexOf(doe)].description || await rl.question(`What would you like to set the description to for '${doe.nickname}'?\n(optional) `) || '', awards: awards });
    } else if (buck) {
      console.log(`Updating ${buck.nickname}...`);
      Object.assign(config.bucks[config.bucks.indexOf(buck)], goat, { description: config.bucks[config.bucks.indexOf(buck)].description || await rl.question(`What would you like to set the description to for '${buck.nickname}'?\n(optional) `) || '', awards: awards });
    } else {
      console.log('Creating', goat.name);
      const nickname = titleCase(await rl.question(`What would you like to set the nickname to for '${goat.name}'?\n(${titleCase(goat.name.split(' ').pop()!)}) `) || goat.name.split(' ').pop()!);
      config[goat.sex === 'Female' ? 'does' : 'bucks'].push(Object.assign(goat, {
        nickname: nickname,
        description: await rl.question(`What would you like to set the description to for '${nickname}'?\n(optional) `) || '',
        awards: awards
      }));
    }
  }
  console.log('Saving Updates...');
  fs.writeFileSync(path.join(__dirname, '../src/app/goats.json'), JSON.stringify(config, null, 2));
  console.log('Downloading Reference Goats...');
  const newConfig: { does: OwnedGoats['result']['items'] & { nickname: string; description: string; }[]; bucks: OwnedGoats['result']['items'] & { nickname: string; description: string; }[]; references: (Goats['result']['items'][number] & { awards: Awards['result']['items']; })[]; } = require('../src/app/goats.json');
  const ids = newConfig.references.map(reference => reference.id);
  for (const goat of [...newConfig.does, ...newConfig.bucks]) {
    const dam = newConfig.references.find(reference => reference.id === goat.damId);
    const sire = newConfig.references.find(reference => reference.id === goat.sireId);
    if (!dam && !ids.includes(goat.damId)) {
      ids.push(goat.damId);
    }
    if (!sire && !ids.includes(goat.sireId)) {
      ids.push(goat.sireId);
    }
  }
  let referenceGoats = (await adga.getGoats(ids)).items;
  for (const referenceGoat of referenceGoats) {
    if (!ids.includes(referenceGoat.damId)) {
      ids.push(referenceGoat.damId);
    }
    if (!ids.includes(referenceGoat.sireId)) {
      ids.push(referenceGoat.sireId);
    }
  }
  referenceGoats = (await adga.getGoats(ids)).items;
  console.log('Downloaded', referenceGoats.length, 'Reference Goats From ADGA.');
  for (const goat of referenceGoats) {
    const awards = (await adga.getAwards(goat.id)).items;
    const reference = newConfig.references.find(reference => reference.id === goat.id);
    if (reference) {
      console.log(`Updating ${reference.name}...`);
      Object.assign(newConfig.references[newConfig.references.indexOf(reference)], goat, { awards: awards });
    } else {
      console.log(`Creating ${goat.name}...`);
      newConfig.references.push(Object.assign(goat, { awards: awards }));
    }
  }
  console.log('Saving Reference Goats...');
  fs.writeFileSync(path.join(__dirname, '../src/app/goats.json'), JSON.stringify(newConfig, null, 2));
  console.log('Done.');
  process.exit();
})();