import fs from 'fs';
import path from 'path';

const backupDir = 'C:/Users/GOKUL/OneDrive/Desktop/hi/unified-aicte-portal/backend/backups/aicte_unified_backup_1793012498951';
const insts = JSON.parse(fs.readFileSync(path.join(backupDir, 'institutions.json'), 'utf-8'));

console.log('Total institutions in backup:', insts.length);

const genuineNames = [
  'Kongu College',
  'Bannari Amman',
  'Sakthi',
  'Bharatiya Institute of Technology',
  'Bharatiya Institute of Technology 2'
];

const genRecords = insts.filter(i => genuineNames.includes(i.name));
console.log('\nGenuine institutions (' + genRecords.length + '):');
genRecords.forEach(i => console.log(`  _id: ${i._id['$oid'] || i._id} | name: ${i.name} | email: ${i.email}`));

const delhiRecords = insts.filter(i => i.name && i.name.startsWith('Delhi Institute of Technology'));
console.log('\nDelhi institutions (' + delhiRecords.length + '):');
delhiRecords.forEach(i => console.log(`  _id: ${i._id['$oid'] || i._id} | name: ${i.name} | email: ${i.email}`));

const apexRecords = insts.filter(i => i.name && (i.name.includes('Apex') || i.name.includes('Zenith')));
console.log('\nApex / Zenith institutions (' + apexRecords.length + '):');
apexRecords.forEach(i => console.log(`  _id: ${i._id['$oid'] || i._id} | name: ${i.name} | email: ${i.email}`));

const alphaOmegaRecords = insts.filter(i => {
  const isGen = genuineNames.includes(i.name);
  const isDelhi = i.name && i.name.startsWith('Delhi Institute of Technology');
  const isApex = i.name && (i.name.includes('Apex') || i.name.includes('Zenith'));
  const isLogout = i.name && i.name.includes('Logout Test');
  return !isGen && !isDelhi && !isApex && !isLogout;
});
console.log('\nAlpha-Omega institutions (' + alphaOmegaRecords.length + '):');

const logoutRecords = insts.filter(i => i.name && i.name.includes('Logout Test'));
console.log('\nLogout Test institutions (' + logoutRecords.length + '):');
logoutRecords.forEach(i => console.log(`  _id: ${i._id['$oid'] || i._id} | name: ${i.name} | email: ${i.email}`));

console.log('\n=======================================');
console.log('SUMMARY OF BACKUP INSTITUTIONS:');
console.log('Total institutions in backup: ' + insts.length);
console.log('Genuine (Kongu, Bannari Amman, Sakthi, Bharatiya 1 & 2): ' + genRecords.length);
console.log('Delhi Institute of Technology: ' + delhiRecords.length);
console.log('Apex / Zenith: ' + apexRecords.length);
console.log('Alpha-Omega: ' + alphaOmegaRecords.length);
console.log('Logout Test: ' + logoutRecords.length);
console.log('Sum of all dummies (Delhi + Apex/Zenith + AlphaOmega + Logout): ' + (delhiRecords.length + apexRecords.length + alphaOmegaRecords.length + logoutRecords.length));
console.log('Sum of non-Delhi dummies (Apex/Zenith + AlphaOmega + Logout): ' + (apexRecords.length + alphaOmegaRecords.length + logoutRecords.length));
console.log('Notice: 6 + 39 + 1 = 46 (non-Delhi test institutes).');
console.log('Plus 4 Delhi = 50.');
console.log('=======================================');
