import fs from 'fs';

const backupDir = 'C:/Users/GOKUL/OneDrive/Desktop/hi/unified-aicte-portal/backend/backups/aicte_unified_backup_1793012498951';
const payments = JSON.parse(fs.readFileSync(`${backupDir}/payments.json`, 'utf-8'));
const institutions = JSON.parse(fs.readFileSync(`${backupDir}/institutions.json`, 'utf-8'));

const delhiPayments = payments.filter(p => ['6ade85654eaf15daf9ebabec', '6ade85ab1756c044d632899a'].includes(p._id['$oid'] || p._id));
console.log('=== DELHI FDRs IN BACKUP ===');
console.log(JSON.stringify(delhiPayments, null, 2));

console.log('\n=== LINKED INSTITUTIONS FOR THESE FDRs ===');
delhiPayments.forEach(p => {
  const cId = p.collegeId;
  const match = institutions.find(i => i.collegeId === cId || (i._id['$oid'] || i._id) === cId);
  console.log(`Payment collegeId: ${cId} -> Matched institution:`, match ? { _id: match._id, name: match.name, email: match.email, collegeId: match.collegeId } : 'NONE');
});
